import { RoomShell } from "./RoomShell";
import type { RoomConfig } from "@/data/roomConfig";
import type { Artifact } from "@/types/artifact";

/**
 * Ruang 1 (Prasejarah), Ruang 2 (Hindu-Buddha), and Ruang 3 (Transisi IPTEK)
 * all share the same architectural shell and only differ in their config
 * (palette, bounds, doors — see roomConfig.ts) and artifact list. Splitting
 * a bespoke component per room is easy later: just replace the relevant
 * `<GalleryRoom room={ROOM_CONFIGS.roomX} .../>` usage with a custom one.
 */
export function GalleryRoom({ room, artifacts }: { room: RoomConfig; artifacts: Artifact[] }) {
  return <RoomShell room={room} artifacts={artifacts} />;
}
