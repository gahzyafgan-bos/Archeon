import { useMuseumStore } from "@/store/useMuseumStore";
import { ROOM_CONFIGS } from "@/data/roomConfig";

export function RoomTransition() {
  const isTransitioning = useMuseumStore((s) => s.isTransitioning);
  const activeRoom = useMuseumStore((s) => s.activeRoom);

  return (
    <div
      className={`fixed inset-0 z-40 bg-museum-void pointer-events-none transition-opacity duration-500 ease-museum flex items-center justify-center ${
        isTransitioning ? "opacity-100" : "opacity-0"
      }`}
    >
      <p
        className={`font-display text-museum-gold text-xl tracking-[0.25em] uppercase transition-opacity duration-300 ${
          isTransitioning ? "opacity-100 delay-300" : "opacity-0"
        }`}
      >
        {ROOM_CONFIGS[activeRoom].name}
      </p>
    </div>
  );
}
