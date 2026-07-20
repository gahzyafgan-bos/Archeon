import { useMuseumStore } from "@/store/useMuseumStore";

/**
 * Crossing the archway between halls is now an open walk-through, not a
 * doorway — a half-second fade-to-black here would recreate the "flow
 * patah" the archway was built to remove (spec section 9). This is now a
 * near-instant (~150ms) crossfade, just enough to hide the one-frame pop
 * when the new hall's artifacts/geometry mount, with no name card.
 */
export function RoomTransition() {
  const isTransitioning = useMuseumStore((s) => s.isTransitioning);

  return (
    <div
      className={`fixed inset-0 z-40 bg-museum-void pointer-events-none transition-opacity duration-150 ease-out ${
        isTransitioning ? "opacity-60" : "opacity-0"
      }`}
    />
  );
}
