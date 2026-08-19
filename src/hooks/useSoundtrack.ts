import { useEffect, useRef, useState } from "react";
import { Howl } from "howler";
import { useMuseumStore } from "@/store/useMuseumStore";
import { GUIDE_DUCK_FACTOR } from "@/audio/guideAudio";

/**
 * Single looping background soundtrack for the whole experience ("Suling
 * Pavilion"). Unlike useAmbience — which swaps a per-hall track and reloads on
 * every room change — this mounts once at the app root and plays continuously,
 * uninterrupted across hall transitions, for as long as the player is inside.
 *
 * It reuses the existing "Musik Latar" controls so nothing new is needed in the
 * UI: the HUD mute button (isAmbienceMuted), the Settings "Volume Musik Latar"
 * slider (volumeAmbience), and "Matikan Semua Suara" (masterMuted) all drive it.
 */
const SOUNDTRACK_SRC = "/audio/suling-pavilion.mp3";

export function useSoundtrack() {
  const isAmbienceMuted = useMuseumStore((s) => s.isAmbienceMuted);
  const settings = useMuseumStore((s) => s.settings);
  const howlRef = useRef<Howl | null>(null);
  // Playback has actually begun (survived the browser autoplay gate).
  const startedRef = useRef(false);
  /**
   * Whether the visitor has interacted with the page at least once.
   *
   * Nothing to do with whether the music *may* play — it's about when the
   * AudioContext may be built at all. Howler creates it inside the very first
   * `new Howl()` (howler.js `Howl.init` → `setupAudioContext`), and a context
   * created before any interaction is born suspended: Chrome logs "The
   * AudioContext was not allowed to start. It must be resumed (or created)
   * after a user gesture on the page." for the creation itself, and again for
   * every `resume()` Howler's autoUnlock/_autoResume then attempts — six
   * warnings on a plain page load (audit P3-4).
   *
   * So the Howl isn't built until this flips. The document has sticky user
   * activation by then, so the context is created running and no warning is
   * ever printed. Nothing is lost by waiting: the sound was inaudible until
   * that first gesture regardless, and onboarding guarantees several clicks
   * before the visitor is ever inside the museum.
   */
  const [hasUserGesture, setHasUserGesture] = useState(false);

  /**
   * Music ducks under the audio guide.
   *
   * Both channels are set by the visitor and both are correct, but they cannot
   * both be at their setting at the same time: a narrator and a gamelan at
   * equal level fight for the same attention, and the visitor settles it by
   * muting one of them. Dropping the music to ~28% for the length of the
   * narration and restoring it afterwards means neither has to be switched off.
   *
   * The fade is the existing 400ms volume fade below — nothing extra is needed,
   * because `targetVolume` changing is exactly what that effect already
   * responds to. `isGuideAudioPlaying` is written by audio/guideAudio.ts, and
   * only on a real start/stop, so this does not re-run on progress ticks.
   */
  const isGuidePlaying = useMuseumStore((s) => s.isGuideAudioPlaying);
  const settingVolume =
    settings.masterMuted || isAmbienceMuted ? 0 : settings.volumeAmbience / 100;
  const targetVolume = isGuidePlaying ? settingVolume * GUIDE_DUCK_FACTOR : settingVolume;
  // Read the latest target from inside the once-only setup effect without
  // re-creating the Howl when volume/mute change (that's the other effect's job).
  const targetRef = useRef(targetVolume);
  targetRef.current = targetVolume;

  // Wait for the first interaction anywhere on the page.
  useEffect(() => {
    if (hasUserGesture) return;
    const onGesture = () => setHasUserGesture(true);
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", onGesture, opts);
    window.addEventListener("keydown", onGesture, opts);
    window.addEventListener("touchend", onGesture, opts);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("touchend", onGesture);
    };
  }, [hasUserGesture]);

  // Create the track once that gesture has happened, and keep it alive for the
  // rest of the session.
  useEffect(() => {
    if (!hasUserGesture) return;

    const track = new Howl({
      src: [SOUNDTRACK_SRC],
      loop: true,
      volume: 0,
      html5: true, // stream a multi-MB music file instead of decoding it whole
      onplay: () => {
        startedRef.current = true;
        track.fade(track.volume(), targetRef.current, 800);
      },
      onloaderror: () => {
        // Soundtrack asset missing — fail silent, the museum still works.
      },
    });
    howlRef.current = track;
    track.play();

    return () => {
      track.fade(track.volume(), 0, 300);
      setTimeout(() => track.unload(), 350);
      howlRef.current = null;
      startedRef.current = false;
    };
  }, [hasUserGesture]);

  // Follow mute/volume changes with a short fade.
  useEffect(() => {
    const track = howlRef.current;
    if (!track || !startedRef.current) return;
    if (targetVolume > 0 && !track.playing()) track.play();
    track.fade(track.volume(), targetVolume, 400);
  }, [targetVolume, hasUserGesture]);
}
