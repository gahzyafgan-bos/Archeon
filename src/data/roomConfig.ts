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
  /** World position of this zone's hero artifact (see artifacts.json
   * `display_tier: "hero"`/`"signature"`), if any — RoomShell uses this to
   * plant a symmetric pair of framing pillars between the zone center and
   * the hero, so the hero reads as deliberately "framed" rather than just
   * another grid item (design spec section 1/2c: framed view + terminating
   * vista). Zones with no artifacts (welcome) omit this. */
  heroFocus?: { x: number; z: number };
}

export interface RoomConfig {
  id: RoomId;
  name: string;
  bounds: RoomBounds;
  /** Ceiling/wall height, world units. Falls back to 7 (RoomShell) when
   * omitted — kept tall even where the floor footprint (bounds) is
   * right-sized smaller, so a compact hall still reads as grande rather
   * than cramped (spec: "rapat di lantai, tinggi di atas"). */
  ceilingHeight?: number;
  spawn: { x: number; z: number; facingY: number };
  doors: Door[];
  wallColor: string;
  floorColor: string;
  /** Hall-wide accent used where a single color is needed (frame trim, minimap tint) — zones carry their own, more specific accent for decor/signage. */
  accentColor: string;
  zones: ZoneConfig[];
  /** Non-artifact centerpiece for the hall's otherwise-empty geometric
   * middle (spec: "isi titik tengah yang kosong") — a floor medallion +
   * wall crest RoomShell stages independently of any zone's hero, so the
   * open circulation spine between side zones still has a destination.
   * Doesn't touch artifacts.json; purely architectural set dressing. */
  centerFocus?: { x: number; z: number };
}

export const ROOM_CONFIGS: Record<RoomId, RoomConfig> = {
  "hall-1": {
    id: "hall-1",
    name: "Aula Nusantara Kuno",
    // Right-sized from the original 40x24 (bounds: { minX: -20, maxX: 20,
    // minZ: -12, maxZ: 12 }) down to 30x18 — a uniform 0.75 scale of the
    // floor footprint, spec section 1/2a: the old room was big enough that
    // (a) every zone read as far apart with an empty middle and (b) more
    // floor/objects sat in the render frustum than needed on mobile.
    // Ceiling height is NOT scaled down with it (see ceilingHeight below) —
    // rapat di lantai, tinggi di atas, so it still reads as grande.
    bounds: { minX: -15, maxX: 15, minZ: -9, maxZ: 9 },
    ceilingHeight: 6.5,
    // The prompt's own example spawn used facingY: Math.PI with a comment
    // saying "facing into the hall" — but PlayerRig's forward vector at
    // yaw=Math.PI actually points toward +Z (out of the hall, since zones
    // sit at z<=8 relative to spawn z=10). Using facingY: 0 instead so the
    // player actually faces into the hall on arrival, matching the old
    // (working) lobby spawn convention.
    spawn: { x: 0, z: 7.5, facingY: 0 },
    wallColor: "#F2E9D8",
    floorColor: "#E4D5B7",
    accentColor: "#B08D3C",
    doors: [
      {
        position: { x: 0, z: -8.5 },
        radius: 3.2,
        targetRoom: "hall-2",
        // Must land clearly outside Hall 2's own return-door trigger (below,
        // radius 3.2 around z=11.5) or the player bounces straight back the
        // instant its cooldown clears — z=6 keeps ~5.5 units of margin.
        targetSpawn: { x: 0, z: 6, facingY: 0 },
        label: "Aula Transisi & IPTEK",
      },
    ],
    zones: [
      { id: "welcome", label: "Selamat Datang", center: { x: 0, z: 6 }, accent: "#B08D3C", pathOrder: 0, radius: 4.5 },
      {
        id: "prasejarah",
        label: "Koleksi Prasejarah",
        center: { x: -9, z: -3 },
        accent: "#C56A3A",
        pathOrder: 1,
        radius: 6.75,
        heroFocus: { x: -11.2, z: -6.7 },
      },
      {
        id: "hindu-buddha",
        label: "Galeri Hindu-Buddha",
        center: { x: 9, z: -3 },
        accent: "#2E4A7D",
        pathOrder: 2,
        radius: 6.75,
        heroFocus: { x: 12.3, z: -5.7 },
      },
    ],
    // Sits on the direct sightline from spawn, between the two side zones —
    // previously an empty aisle leading to a bare back wall (spec section
    // 3: "titik tengah kosong... mata tidak punya tujuan"). See RoomShell's
    // CenterInstallation.
    centerFocus: { x: 0, z: -5.5 },
  },
  "hall-2": {
    id: "hall-2",
    name: "Aula Transisi & IPTEK",
    bounds: { minX: -16, maxX: 16, minZ: -12, maxZ: 12 },
    spawn: { x: 0, z: 6, facingY: 0 },
    wallColor: "#F2E9D8",
    floorColor: "#E4D5B7",
    accentColor: "#1F7A6E",
    doors: [
      {
        position: { x: 0, z: 11.5 },
        radius: 3.2,
        targetRoom: "hall-1",
        // Same margin fix as Hall 1's door above — must clear Hall 1's own
        // archway trigger (now radius 3.2 around z=-8.5 after the Hall 1
        // right-size; z=-4.5 keeps >3.2 units of margin and lands the
        // arriving player in Hall 1's own center aisle, right by
        // centerFocus, instead of retracing the old scaled-down gap alone).
        targetSpawn: { x: 0, z: -4.5, facingY: Math.PI },
        label: "Kembali ke Aula Nusantara Kuno",
      },
    ],
    zones: [
      {
        id: "transisi-iptek",
        label: "Transisi ke IPTEK",
        center: { x: 0, z: -2 },
        accent: "#1F7A6E",
        pathOrder: 3,
        radius: 10,
        heroFocus: { x: 0, z: -8 },
      },
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
