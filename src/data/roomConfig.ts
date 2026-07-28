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
   * pillars RoomShell stages independently of any zone's hero, so the open
   * circulation spine between side zones still has a destination. Doesn't
   * touch artifacts.json; purely architectural set dressing. Floor-only,
   * deliberately no wall-mounted piece — see CenterInstallation's doc
   * comment for why (it used to double as the Hall 1 -> Hall 2 archway's
   * backdrop, blocking the doorway). */
  centerFocus?: { x: number; z: number };
}

export const ROOM_CONFIGS: Record<RoomId, RoomConfig> = {
  "hall-1": {
    id: "hall-1",
    name: "Aula Nusantara Kuno",
    // Right-sized again from 30x18 down to 24x15 (audit: only 9 renderable
    // artifacts across 3 zones -> ~60 m2/objek, 3-4x too sparse for a gallery
    // read). 24x15 brings it to ~40 m2/objek while still leaving Garudeya its
    // >=2.5m clear (now barrier-free) pocket, each arca its 1.5m breathing room, a >=2m
    // circulation spine, and the welcome orientation buffer. Ceiling stays
    // tall relative to the smaller floor (rapat di lantai, tinggi di atas);
    // >=5m keeps Surya Stambha (2.15m + pedestal) from feeling boxed in.
    bounds: { minX: -12, maxX: 12, minZ: -7.5, maxZ: 7.5 },
    ceilingHeight: 6,
    // The prompt's own example spawn used facingY: Math.PI with a comment
    // saying "facing into the hall" — but PlayerRig's forward vector at
    // yaw=Math.PI actually points toward +Z (out of the hall, since zones
    // sit at z<=8 relative to spawn z=10). Using facingY: 0 instead so the
    // player actually faces into the hall on arrival, matching the old
    // (working) lobby spawn convention.
    spawn: { x: 0, z: 6, facingY: 0 },
    wallColor: "#F2E9D8",
    floorColor: "#E4D5B7",
    accentColor: "#B08D3C",
    doors: [
      {
        position: { x: 0, z: -7 },
        radius: 2.5,
        targetRoom: "hall-2",
        // Land near Hall 2's entrance but clear of its own return-door
        // trigger (radius 2.3 around z=5.6 after Hall 2's right-size) — z=3.0
        // keeps a comfortable margin so the player doesn't bounce straight back.
        targetSpawn: { x: 0, z: 3.0, facingY: 0 },
        label: "Aula Transisi & IPTEK",
      },
    ],
    zones: [
      { id: "welcome", label: "Selamat Datang", center: { x: 0, z: 5.2 }, accent: "#B08D3C", pathOrder: 0, radius: 3.5 },
      {
        id: "prasejarah",
        label: "Koleksi Prasejarah",
        center: { x: -6.5, z: -2 },
        accent: "#C56A3A",
        pathOrder: 1,
        radius: 5.2,
        // Manusia-purba terminating vista (the configured Pithecanthropus hero
        // has no .glb, so the visible hero is manusia-purba at this spot).
        heroFocus: { x: -9.5, z: -5 },
      },
      {
        id: "hindu-buddha",
        label: "Galeri Hindu-Buddha",
        center: { x: 6.5, z: -2 },
        accent: "#2E4A7D",
        pathOrder: 2,
        radius: 5.2,
        // Zone hero = Arca Durga (promoted to hero tier); Garudeya Emas is
        // staged separately as the museum-wide signature piece (see RoomShell
        // GarudeyaStage + ArtifactMesh showcase), so it is NOT the zone
        // heroFocus — that keeps the generic framing/backdrop off Garudeya.
        heroFocus: { x: 5.5, z: -4.5 },
      },
    ],
    // Sits on the direct sightline from spawn, between the two side zones —
    // previously an empty aisle leading to a bare back wall (spec section
    // 3: "titik tengah kosong... mata tidak punya tujuan"). See RoomShell's
    // CenterInstallation.
    centerFocus: { x: 0, z: -3 },
  },
  "hall-2": {
    id: "hall-2",
    name: "Aula Transisi & IPTEK",
    // Right-sized again from 22x16 down to 18x12 (audit: 4 renderable
    // artifacts -> ~88 m2/objek, the sparsest hall). Single-zone, so it can be
    // packed tighter than Hall 1; 18x12 still fits the Sepeda Motor Uap hero as
    // a terminating vista + the asymmetric daily-life cluster + a >=2m walkway.
    // Ceiling 5.5 keeps >=5m headroom.
    bounds: { minX: -9, maxX: 9, minZ: -6, maxZ: 6 },
    ceilingHeight: 5.5,
    spawn: { x: 0, z: 3.0, facingY: 0 },
    wallColor: "#F2E9D8",
    floorColor: "#E4D5B7",
    accentColor: "#1F7A6E",
    doors: [
      {
        position: { x: 0, z: 5.6 },
        radius: 2.3,
        targetRoom: "hall-1",
        // Land clear of Hall 1's own archway trigger (radius 2.5 around
        // z=-7) — z=-4.0 keeps >3 units of margin and drops the arriving
        // player in Hall 1's center aisle, right by centerFocus.
        targetSpawn: { x: 0, z: -4.0, facingY: Math.PI },
        label: "Kembali ke Aula Nusantara Kuno",
      },
    ],
    zones: [
      {
        id: "transisi-iptek",
        label: "Transisi ke IPTEK",
        center: { x: 0, z: -0.4 },
        accent: "#1F7A6E",
        pathOrder: 3,
        radius: 6,
        heroFocus: { x: 0, z: -4.3 },
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
