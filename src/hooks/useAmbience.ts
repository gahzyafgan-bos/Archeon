import { useEffect, useRef } from "react";
import { Howl } from "howler";
import { useMuseumStore } from "@/store/useMuseumStore";
import type { RoomId } from "@/store/useMuseumStore";

/**
 * Panduan karakter musik ambience per hall:
 * - Aula Nusantara Kuno (Hall 1): gamelan Jawa Timuran hangat di zona Welcome,
 *   melebur ke nuansa gua/purba & gamelan pelog magis di zona koleksinya.
 * - Aula Transisi & IPTEK (Hall 2): ambience mekanis-industrial ringan
 *   dipadukan sedikit musik string sederhana.
 */
const AMBIENCE_TRACKS: Record<RoomId, string> = {
  "hall-1": "/audio/ambience-hall-1.mp3",
  "hall-2": "/audio/ambience-hall-2.mp3",
};

export function useAmbience(activeRoom: RoomId) {
  const isAmbienceMuted = useMuseumStore((s) => s.isAmbienceMuted);
  const settings = useMuseumStore((s) => s.settings);
  const howlRef = useRef<Howl | null>(null);

  const targetVolume =
    settings.masterMuted || isAmbienceMuted ? 0 : settings.volumeAmbience / 100;

  // Update volume whenever target changes
  useEffect(() => {
    if (!howlRef.current) return;
    howlRef.current.fade(howlRef.current.volume(), targetVolume, 400);
  }, [targetVolume]);

  useEffect(() => {
    howlRef.current?.fade(howlRef.current.volume(), 0, 400);
    const prev = howlRef.current;
    const timeout = setTimeout(() => prev?.unload(), 450);

    const track = new Howl({
      src: [AMBIENCE_TRACKS[activeRoom]],
      loop: true,
      volume: 0,
      html5: true,
      onloaderror: () => {
        // Placeholder track missing — safe to ignore until real assets exist.
      },
    });
    howlRef.current = track;

    if (targetVolume > 0) {
      track.play();
      track.fade(0, targetVolume, 800);
    }

    return () => {
      clearTimeout(timeout);
      track.fade(track.volume(), 0, 300);
      setTimeout(() => track.unload(), 350);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom]);
}
