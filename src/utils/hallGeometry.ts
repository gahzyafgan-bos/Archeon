import type { RoomBounds, RoomConfig } from "@/data/roomConfig";

/**
 * The hall's own structural grid, in one place.
 *
 * These numbers used to be inlined at each site that needed them — the beam
 * spacing in RoomShell's ceiling <Instances>, a hardcoded 5.4 m colonnade
 * height in HallEdgeDecor, a hardcoded `wallHeight - 0.5` for the pendant
 * lamps. That is exactly how decor becomes orphaned: both halls were later
 * right-sized (Hall 1 to a 6 m ceiling, Hall 2 to 5.5 m) and every one of
 * those constants stayed where it was, so props ended up crossing the beam
 * grid or poking out through the ceiling.
 *
 * Anything that has to sit against the ceiling structure derives its position
 * from here instead. See utils/decorAudit.ts for the check that keeps it true.
 */

/** Used when a RoomConfig omits `ceilingHeight`. Both shipped halls set their
 * own; this is the fallback RoomShell has always applied, kept here so the
 * decor that hangs from the ceiling resolves the same number the shell does. */
export const DEFAULT_CEILING_HEIGHT = 7;

export const WALL_THICKNESS = 0.3;
/** Half the wall thickness — walls are centred ON the bound, so the room-facing
 * surface sits this far inside it. */
export const WALL_FACE_INSET = WALL_THICKNESS / 2;

export const BEAM_SIZE = 0.3;
/** Distance from the ceiling plane down to a beam's centre. */
export const BEAM_DROP = 0.2;
const BEAM_SPACING = 5;

/** Underside of the ceiling beam grid — the lowest structural surface anything
 * hanging from the ceiling may touch. */
export function beamUnderside(ceilingHeight: number): number {
  return ceilingHeight - BEAM_DROP - BEAM_SIZE / 2;
}

/** Z of each beam running along X. */
export function beamZPositions({ minZ, maxZ }: RoomBounds): number[] {
  const out: number[] = [];
  const depth = maxZ - minZ;
  for (let i = 0; i < Math.ceil(depth / BEAM_SPACING); i++) {
    const z = minZ + 2.5 + i * BEAM_SPACING;
    if (z <= maxZ - 2) out.push(z);
  }
  return out;
}

/** X of each beam running along Z. */
export function beamXPositions({ minX, maxX }: RoomBounds): number[] {
  const out: number[] = [];
  const width = maxX - minX;
  for (let i = 0; i < Math.ceil(width / BEAM_SPACING); i++) {
    const x = minX + 2.5 + i * BEAM_SPACING;
    if (x <= maxX - 2) out.push(x);
  }
  return out;
}

/**
 * Where the pendant lamps hang. Picked FROM the beam grid rather than spread
 * along the hall independently of it, so every lamp has a beam directly above
 * it to hang from — a cord that ends in mid-air, or passes through a beam on
 * its way to the ceiling, is the thing that makes a prop read as a bug.
 * At most three per hall, evenly sampled from whatever beams exist.
 */
export function lampZPositions(bounds: RoomBounds): number[] {
  const beams = beamZPositions(bounds);
  if (beams.length <= 3) return beams;
  return [beams[0], beams[Math.floor(beams.length / 2)], beams[beams.length - 1]];
}

/**
 * Colonnade height, derived so the capital tucks just under the beam grid
 * instead of crossing it. Was a fixed 5.4 m authored against the original 7 m
 * ceiling: after right-sizing that put the capital at 5.68 m in a hall whose
 * ceiling is 5.5 m, i.e. poking straight through it.
 */
export function colonnadeShaftHeight(ceilingHeight: number, capitalHeight: number): number {
  return Math.max(2, beamUnderside(ceilingHeight) - capitalHeight - 0.06);
}

/** Interior extent of the room — inside the wall surfaces, not the bounds. */
export function interiorBounds(room: RoomConfig): RoomBounds {
  return {
    minX: room.bounds.minX + WALL_FACE_INSET,
    maxX: room.bounds.maxX - WALL_FACE_INSET,
    minZ: room.bounds.minZ + WALL_FACE_INSET,
    maxZ: room.bounds.maxZ - WALL_FACE_INSET,
  };
}
