import { useMuseumStore } from "@/store/useMuseumStore";

/**
 * Crossing the archway between halls is now an open walk-through, not a
 * doorway — a half-second fade-to-black here would recreate the "flow
 * patah" the archway was built to remove (spec section 9). This is now a
 * near-instant (~150ms) crossfade, just enough to hide the one-frame pop
 * when the new hall's artifacts/geometry mount, with no name card.
 */
/** The crossfade's own length, in ms, at the default speed setting. Exported so
 *  MuseumExperience derives its hall-swap timings from the same number instead
 *  of keeping a second copy of it. */
export const ROOM_CROSSFADE_MS = 150;

/**
 * Resolves the user's "Kecepatan Transisi Ruangan" slider into a duration.
 *
 * The slider has existed in Pengaturan since the settings panel was written and
 * was wired to nothing at all — moving it changed no behaviour anywhere in the
 * app (audit 2026-08-05, P1-4). A control that does nothing is worse than a
 * missing one: it teaches the visitor that the settings panel lies.
 *
 * Higher multiplier = faster, so it divides.
 */
export function roomCrossfadeMs(speed: number): number {
  return Math.round(ROOM_CROSSFADE_MS / Math.max(0.5, Math.min(2, speed)));
}

export function RoomTransition() {
  const isTransitioning = useMuseumStore((s) => s.isTransitioning);
  const speed = useMuseumStore((s) => s.settings.roomTransitionSpeed);
  const durationMs = roomCrossfadeMs(speed);

  return (
    <div
      className={`fixed inset-0 z-40 bg-museum-void pointer-events-none ease-out ${
        isTransitioning ? "opacity-60" : "opacity-0"
      }`}
      // Inline rather than a Tailwind duration class: the value is continuous
      // (the slider is a range, not three presets), so there is no fixed set of
      // classes that could express it.
      style={{ transitionProperty: "opacity", transitionDuration: `${durationMs}ms` }}
    />
  );
}
