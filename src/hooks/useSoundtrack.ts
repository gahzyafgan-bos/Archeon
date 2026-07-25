import { useEffect, useRef } from "react";
import { Howl } from "howler";
import { useMuseumStore } from "@/store/useMuseumStore";

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

  const targetVolume =
    settings.masterMuted || isAmbienceMuted ? 0 : settings.volumeAmbience / 100;
  // Read the latest target from inside the once-only setup effect without
  // re-creating the Howl when volume/mute change (that's the other effect's job).
  const targetRef = useRef(targetVolume);
  targetRef.current = targetVolume;

  // Create the track once and keep it alive for the session.
  useEffect(() => {
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

    // Browser autoplay policy blocks sound until the user has interacted. Try
    // once now (covers the case where a gesture, e.g. an onboarding click, has
    // already happened), and arm a one-time listener so the very first
    // interaction anywhere starts it. onplay flips startedRef, so a queued/
    // blocked play() simply gets retried on that gesture — no double-start.
    const start = () => {
      if (!startedRef.current && !track.playing()) track.play();
    };
    const onGesture = () => {
      start();
      if (startedRef.current) detach();
    };
    const detach = () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("touchend", onGesture);
    };
    start();
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    window.addEventListener("touchend", onGesture);

    return () => {
      detach();
      track.fade(track.volume(), 0, 300);
      setTimeout(() => track.unload(), 350);
      howlRef.current = null;
      startedRef.current = false;
    };
  }, []);

  // Follow mute/volume changes with a short fade.
  useEffect(() => {
    const track = howlRef.current;
    if (!track || !startedRef.current) return;
    if (targetVolume > 0 && !track.playing()) track.play();
    track.fade(track.volume(), targetVolume, 400);
  }, [targetVolume]);
}
