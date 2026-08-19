import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";
import {
  formatGuideTime,
  guideAudio,
  hasPlayableGuide,
  type GuideAudioStatus,
} from "@/audio/guideAudio";
import type { Artifact } from "@/types/artifact";

/**
 * Mounted once, at the app root. Owns everything about the audio guide that is
 * not a button: what volume it plays at, and the four situations in which a
 * narration must stop whether or not anyone pressed anything.
 *
 * Those four are one rule stated four ways — narration belongs to the moment
 * the visitor is standing in front of one object, and the moment is over when:
 *
 *  - they focus a different artifact (a second voice must never start over the
 *    first);
 *  - they close or hide the information panel (the controls go with it, and a
 *    voice with no stop button is the worst outcome here);
 *  - they walk through an archway into the other hall;
 *  - they enter or leave VR (the whole interface changes underneath them).
 *
 * Centralising this is deliberate. Scattered across the panel, the VR overlay
 * and the room transition, each site would have to remember the other three.
 */
export function useGuideAudioLifecycle() {
  const settings = useMuseumStore((s) => s.settings);
  const focusedArtifactId = useMuseumStore((s) => s.focusedArtifact?.id ?? null);
  const isInfoPanelOpen = useMuseumStore((s) => s.isInfoPanelOpen);
  const activeRoom = useMuseumStore((s) => s.activeRoom);
  const isVRMode = useMuseumStore((s) => s.isVRMode);

  // The existing "Volume Pemandu Audio" channel, unchanged. Master mute wins.
  const volume = settings.masterMuted ? 0 : settings.volumeGuide / 100;
  useEffect(() => {
    guideAudio.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    guideAudio.stop();
  }, [focusedArtifactId, isInfoPanelOpen, activeRoom, isVRMode]);

  useEffect(() => () => guideAudio.stop(), []);
}

export interface AudioGuideControls {
  /** Whether to render a control at all. False means render nothing — not a
   * disabled button. See `hasPlayableGuide`. */
  available: boolean;
  status: GuideAudioStatus;
  isPlaying: boolean;
  isLoading: boolean;
  isError: boolean;
  positionSec: number;
  durationSec: number;
  /** 0..1, for a progress bar. */
  progress: number;
  /** e.g. "0:12 / 1:05". */
  timeLabel: string;
  /** The guide volume channel is at zero, so pressing play would be silent. */
  isSilenced: boolean;
  toggle: () => void;
}

/**
 * Binds one artifact to the shared guide player (audio/guideAudio.ts).
 *
 * Read-mostly: several components can call this for the same artifact and they
 * all see one playback. State that belongs to a *different* artifact is
 * reported as idle here, so a panel can never show someone else's progress bar.
 */
export function useAudioGuide(artifact: Artifact | null): AudioGuideControls {
  const state = useSyncExternalStore(guideAudio.subscribe, guideAudio.getState, guideAudio.getState);
  const settings = useMuseumStore((s) => s.settings);

  const available = hasPlayableGuide(artifact);
  const isCurrent = artifact != null && state.artifactId === artifact.id;
  const status: GuideAudioStatus = isCurrent ? state.status : "idle";

  const durationSec =
    (isCurrent && state.durationSec) || artifact?.audioGuide?.durationSec || 0;
  const positionSec = isCurrent ? Math.min(state.positionSec, durationSec) : 0;

  const toggle = useCallback(() => {
    if (artifact) guideAudio.toggle(artifact);
  }, [artifact]);

  return {
    available,
    status,
    isPlaying: status === "playing",
    isLoading: status === "loading",
    isError: status === "error",
    positionSec,
    durationSec,
    progress: durationSec > 0 ? Math.min(1, positionSec / durationSec) : 0,
    timeLabel: `${formatGuideTime(positionSec)} / ${formatGuideTime(durationSec)}`,
    isSilenced: settings.masterMuted || settings.volumeGuide === 0,
    toggle,
  };
}
