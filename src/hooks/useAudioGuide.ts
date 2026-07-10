import { useEffect, useRef } from "react";
import { Howl } from "howler";
import { useMuseumStore } from "@/store/useMuseumStore";
import type { Artifact } from "@/types/artifact";

/**
 * Plays/pauses/stops the audio guide narration for whichever artifact is
 * currently focused. Falls back to a silent no-op if the artifact has no
 * `url_audio` yet (placeholder data), so the UI still works before real
 * narration files are added.
 */
export function useAudioGuide(artifact: Artifact | null) {
  const isGuideAudioPlaying = useMuseumStore((s) => s.isGuideAudioPlaying);
  const setGuideAudioPlaying = useMuseumStore((s) => s.setGuideAudioPlaying);
  const settings = useMuseumStore((s) => s.settings);
  const howlRef = useRef<Howl | null>(null);

  // Calculate target volume
  const targetVolume =
    settings.masterMuted ? 0 : settings.volumeGuide / 100;

  // Update volume whenever target changes
  useEffect(() => {
    if (!howlRef.current) return;
    howlRef.current.volume(targetVolume);
  }, [targetVolume]);

  // (Re)build the Howl instance whenever the focused artifact changes.
  useEffect(() => {
    howlRef.current?.unload();
    howlRef.current = null;
    setGuideAudioPlaying(false);

    if (artifact?.url_audio) {
      howlRef.current = new Howl({
        src: [artifact.url_audio],
        volume: targetVolume,
        html5: true,
        onend: () => setGuideAudioPlaying(false),
      });
    }

    return () => {
      howlRef.current?.unload();
      howlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact?.id]);

  const toggle = () => {
    if (!howlRef.current) return; // no audio file for this artifact yet
    if (targetVolume === 0) return; // don't play if volume is 0
    if (isGuideAudioPlaying) {
      howlRef.current.pause();
      setGuideAudioPlaying(false);
    } else {
      howlRef.current.play();
      setGuideAudioPlaying(true);
    }
  };

  const stop = () => {
    howlRef.current?.stop();
    setGuideAudioPlaying(false);
  };

  const hasAudio = Boolean(artifact?.url_audio);

  return { isPlaying: isGuideAudioPlaying, toggle, stop, hasAudio };
}
