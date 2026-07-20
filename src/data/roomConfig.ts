import type { RoomId, ZoneId } from "@/types/artifact";

export interface RoomBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** An open archway trigger between the two halls — same shape as the old
 * door record (position/radius/targetRoom/targetSpawn) so PlayerRig's
 * proximity-trigger logic and the room-switch plumbing in
 * MuseumExperience.tsx didn't need to change, only what it visually looks
 * like (see RoomShell's archway geometry) did. */
export interface Door {
  position: { x: number; z: number };
  radius: number;
  targetRoom: RoomId;
  targetSpawn: { x: number; z: number; facingY: number };
  label: string;
}

export interface ZoneConfig {
  id: ZoneId;
  label: string;
  center: { x: number; z: number };
  accent: string;
  /** Route order used by the floor-path/arrow wayfinding (section 8). */
  pathOrder: number;
  /** Rough footprint radius — used for the zone's floor motif and for
   * nearest-zone lookups (active-zone highlight, ambience). */
  radius: number;
}

export interface RoomConfig {
  id: RoomId;
  name: string;
  bounds: RoomBounds;
  spawn: { x: number; z: number; facingY: number };
  doors: Door[];
  wallColor: string;
  floorColor: string;
  /** Hall-wide accent used where a single color is needed (frame trim, minimap tint) — zones carry their own, more specific accent for decor/signage. */
  accentColor: string;
  zones: ZoneConfig[];
}

export const ROOM_CONFIGS: Record<RoomId, RoomConfig> = {
  "hall-1": {
    id: "hall-1",
    name: "Aula Nusantara Kuno",
    bounds: { minX: -20, maxX: 20, minZ: -12, maxZ: 12 },
    // The prompt's own example spawn used facingY: Math.PI with a comment
    // saying "facing into the hall" — but PlayerRig's forward vector at
    // yaw=Math.PI actually points toward +Z (out of the hall, since zones
    // sit at z<=8 relative to spawn z=10). Using facingY: 0 instead so the
    // player actually faces into the hall on arrival, matching the old
    // (working) lobby spawn convention.
    spawn: { x: 0, z: 10, facingY: 0 },
    wallColor: "#F2E9D8",
    floorColor: "#E4D5B7",
    accentColor: "#B08D3C",
    doors: [
      {
        position: { x: 0, z: -11.5 },
        radius: 3.2,
        targetRoom: "hall-2",
        targetSpawn: { x: 0, z: 9, facingY: 0 },
        label: "Aula Transisi & IPTEK",
      },
    ],
    zones: [
      { id: "welcome", label: "Selamat Datang", center: { x: 0, z: 8 }, accent: "#B08D3C", pathOrder: 0, radius: 6 },
      { id: "prasejarah", label: "Koleksi Prasejarah", center: { x: -12, z: -4 }, accent: "#C56A3A", pathOrder: 1, radius: 9 },
      { id: "hindu-buddha", label: "Galeri Hindu-Buddha", center: { x: 12, z: -4 }, accent: "#2E4A7D", pathOrder: 2, radius: 9 },
    ],
  },
  "hall-2": {
    id: "hall-2",
    name: "Aula Transisi & IPTEK",
    bounds: { minX: -16, maxX: 16, minZ: -12, maxZ: 12 },
    spawn: { x: 0, z: 9, facingY: 0 },
    wallColor: "#F2E9D8",
    floorColor: "#E4D5B7",
    accentColor: "#1F7A6E",
    doors: [
      {
        position: { x: 0, z: 11.5 },
        radius: 3.2,
        targetRoom: "hall-1",
        targetSpawn: { x: 0, z: -9, facingY: Math.PI },
        label: "Kembali ke Aula Nusantara Kuno",
      },
    ],
    zones: [
      { id: "transisi-iptek", label: "Transisi ke IPTEK", center: { x: 0, z: -2 }, accent: "#1F7A6E", pathOrder: 3, radius: 10 },
    ],
  },
};

export const ALL_ZONES: ZoneConfig[] = Object.values(ROOM_CONFIGS).flatMap((r) => r.zones);

/** Nearest zone (in the given hall) to a world position — used for the
 * active-zone highlight (minimap/signage) and per-zone ambience. */
export function getNearestZone(room: RoomConfig, x: number, z: number): ZoneConfig {
  let closest = room.zones[0];
  let closestDist = Infinity;
  for (const zone of room.zones) {
    const dx = x - zone.center.x;
    const dz = z - zone.center.z;
    const dist = dx * dx + dz * dz;
    if (dist < closestDist) {
      closestDist = dist;
      closest = zone;
    }
  }
  return closest;
}

/** Archway opening size (world units), shared by RoomShell's wall-gap
 * geometry and the decorative arch frame — see spec section 3. */
export const ARCHWAY_WIDTH = 6;
export const ARCHWAY_HEIGHT = 5;
