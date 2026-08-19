import { Howl } from "howler";
import { useMuseumStore } from "@/store/useMuseumStore";
import type { Artifact } from "@/types/artifact";

/**
 * The museum's audio guide: one narration, playing at most once, anywhere.
 *
 * Deliberately a module-level singleton rather than React state. The guide has
 * to be reachable from three places that share no component subtree — the flat
 * InfoPanel, the in-scene VR panel (inside the R3F canvas), and the gamepad
 * poller (a plain rAF loop with no React in it at all) — and every one of them
 * must be talking to the *same* playback. A hook-owned Howl gives each caller
 * its own, which is how two narrations end up talking over each other.
 * Components read this through `useSyncExternalStore`; see hooks/useAudioGuide.
 *
 * It does not own its volume: `setVolume` is pushed in from the existing
 * "Volume Pemandu Audio" channel in Settings. No new channel was created for
 * this feature and none should be.
 */

export type GuideAudioStatus = "idle" | "loading" | "playing" | "paused" | "error";

export interface GuideAudioState {
  /** Which artifact the current narration belongs to; null when nothing is loaded. */
  artifactId: string | null;
  status: GuideAudioStatus;
  positionSec: number;
  /** Real length once the file is decoded, `durationSec` from the data before that. */
  durationSec: number;
}

const IDLE_STATE: GuideAudioState = {
  artifactId: null,
  status: "idle",
  positionSec: 0,
  durationSec: 0,
};

/**
 * How often the playhead is sampled while a narration runs.
 *
 * Not `requestAnimationFrame`: the position is rendered as `0:12 / 1:05` and a
 * thin progress bar, neither of which can show more than a handful of distinct
 * values per second — driving them at 60Hz would re-render the whole InfoPanel
 * (which owns a live <Canvas>) sixty times a second to move a bar by one pixel.
 */
const PROGRESS_INTERVAL_MS = 200;

/**
 * How far the background music drops while a narration is speaking.
 *
 * Not a nicety. At equal levels the gamelan and the narrator compete for the
 * same attention, and the visitor resolves it by switching one of them off —
 * in practice the narration, because it is the one with a visible button. At
 * ~28% the music is still audibly there, holding the room, and the voice sits
 * clearly on top of it. The fade in and out of this is 400ms, handled by the
 * soundtrack hook's existing volume fade.
 */
export const GUIDE_DUCK_FACTOR = 0.28;

/**
 * Formats seconds as `m:ss`.
 *
 * The batch this was written for runs to 66 seconds, so "1:06" is a case that
 * actually occurs — an `0:${seconds}` shortcut would have printed "0:66".
 */
export function formatGuideTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

class GuideAudioController {
  private state: GuideAudioState = IDLE_STATE;
  private listeners = new Set<() => void>();
  private howl: Howl | null = null;
  private timer: number | null = null;
  private volume = 1;
  /**
   * Bumped on every load and every stop.
   *
   * A Howl's load/play callbacks fire asynchronously, so a narration the
   * visitor abandoned mid-download can still call back after the panel has
   * closed and a different artifact has been opened. Every callback checks the
   * token it was created under and does nothing if the world has moved on.
   */
  private token = 0;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): GuideAudioState => this.state;

  /** Follows the "Volume Pemandu Audio" slider and "Matikan Semua Suara". */
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.howl?.volume(this.volume);
  }

  /** Play, pause, or resume — whichever the current state makes it mean. */
  toggle(artifact: Artifact) {
    const guide = artifact.audioGuide;
    if (!guide || !guide.contentVerified) return;

    if (this.state.artifactId === artifact.id && this.howl) {
      if (this.state.status === "playing") {
        this.howl.pause();
        this.patch({ status: "paused" });
        return;
      }
      if (this.state.status === "paused") {
        this.howl.play();
        // "playing" is published from the onplay callback rather than here: on
        // a resume the browser refuses, the button must not claim to be running
        // when nothing is.
        return;
      }
      if (this.state.status === "loading") {
        // Pressed again while it was still fetching. Read that as "never mind"
        // and stop, so the control can never sit stuck in a state the visitor
        // has no way out of.
        this.stop();
        return;
      }
    }

    this.load(artifact, guide);
  }

  /** Stop, release the decoded audio, and go quiet. Safe to call at any time. */
  stop() {
    this.token += 1;
    this.stopTimer();
    const howl = this.howl;
    this.howl = null;
    if (howl) {
      howl.off();
      howl.stop();
      // unload() is the whole point of D.2.2: without it, ten artifacts opened
      // in a row leave ten decoded buffers alive for the rest of the session.
      howl.unload();
    }
    this.publish(IDLE_STATE);
  }

  private load(artifact: Artifact, guide: NonNullable<Artifact["audioGuide"]>) {
    this.stop();
    const token = this.token;

    const howl = new Howl({
      src: [guide.src],
      /**
       * Howler picks a decoder from the file extension, and `.m4a` is one it
       * does not reliably recognise on its own — without this it can refuse a
       * perfectly playable AAC file. Both spellings of the same container are
       * listed because browsers disagree about which one they answer
       * `canPlayType` for.
       */
      format: ["m4a", "mp4"],
      /**
       * Nothing is fetched until the visitor asks for it. Eleven narrations is
       * ~2.5 MB, and preloading them would add all of that to the first load of
       * a museum where most visitors will listen to none.
       */
      preload: false,
      /**
       * Web Audio rather than an <audio> element, on purpose. These files are
       * ~130-350 kB each, so the decode is cheap and paid once — and in return
       * the position readout is accurate, and the service worker can actually
       * cache the file (an HTML5 <audio> element fetches with `Range:` and gets
       * 206s, which public/sw.js passes straight through uncached by design).
       */
      html5: false,
      volume: this.volume,
      onplay: () => {
        if (token !== this.token) return;
        this.startTimer();
        this.patch({
          status: "playing",
          durationSec: howl.duration() || guide.durationSec,
        });
      },
      onpause: () => {
        if (token !== this.token) return;
        this.stopTimer();
        this.patch({ status: "paused" });
      },
      onend: () => {
        if (token !== this.token) return;
        // Finished narrations are released rather than kept warm for a replay:
        // the bytes are still in the HTTP/service-worker cache, so pressing
        // play again costs a decode, not a download.
        this.stop();
      },
      onloaderror: () => {
        if (token !== this.token) return;
        this.fail();
      },
      onplayerror: () => {
        if (token !== this.token) return;
        this.fail();
      },
    });

    this.howl = howl;
    this.publish({
      artifactId: artifact.id,
      status: "loading",
      positionSec: 0,
      // Shown while the file is still in flight — the whole reason the length
      // is recorded in the data instead of read off the decoded audio.
      durationSec: guide.durationSec,
    });

    /**
     * `load()` before `play()`, and both are required.
     *
     * With `preload: false` Howler never fetches on its own, and `play()` on an
     * unloaded sound does not trigger a fetch either — it pushes the play onto
     * an internal queue that is drained by the `load` event, and then waits for
     * an event that will never arrive. The symptom is silent and total: no
     * network request, no error, no callback, and a button that sits on
     * "Memuat…" until the visitor gives up. Calling `load()` here is what fires
     * the request; the queued `play()` runs itself the moment the buffer is
     * decoded.
     */
    howl.load();
    howl.play();
  }

  /**
   * Give up on the current narration without leaving the button mid-press.
   *
   * The visitor sees a short message and a play control that works again; the
   * failure is almost always the network, and the next press is a fair retry.
   */
  private fail() {
    this.stopTimer();
    const howl = this.howl;
    this.howl = null;
    if (howl) {
      howl.off();
      howl.unload();
    }
    this.patch({ status: "error", positionSec: 0 });
  }

  private startTimer() {
    this.stopTimer();
    this.timer = window.setInterval(() => {
      const howl = this.howl;
      if (!howl) return;
      const seek = howl.seek();
      const position = typeof seek === "number" ? seek : 0;
      if (Math.abs(position - this.state.positionSec) < 0.1) return;
      this.patch({ positionSec: position });
    }, PROGRESS_INTERVAL_MS);
  }

  private stopTimer() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private patch(next: Partial<GuideAudioState>) {
    this.publish({ ...this.state, ...next });
  }

  private publish(next: GuideAudioState) {
    const current = this.state;
    if (
      next.artifactId === current.artifactId &&
      next.status === current.status &&
      next.positionSec === current.positionSec &&
      next.durationSec === current.durationSec
    ) {
      return;
    }
    this.state = next;
    // The background music ducks off this flag — see useSoundtrack. Written
    // only on a real transition, so the store is not woken by progress ticks.
    const wasPlaying = current.status === "playing";
    const isPlaying = next.status === "playing";
    if (wasPlaying !== isPlaying) {
      useMuseumStore.getState().setGuideAudioPlaying(isPlaying);
    }
    for (const listener of this.listeners) listener();
  }
}

export const guideAudio = new GuideAudioController();

/**
 * Whether this artifact should show a play control at all.
 *
 * Two conditions, both hard: there has to be a recording, and its content has
 * to have been confirmed to describe this object. A narration held back for
 * verification is treated exactly like one that does not exist — see
 * `contentVerified` in types/artifact.ts.
 */
export function hasPlayableGuide(artifact: Artifact | null | undefined): boolean {
  return Boolean(artifact?.audioGuide?.contentVerified);
}
