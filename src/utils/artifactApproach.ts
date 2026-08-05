import type { RoomConfig } from "@/data/roomConfig";
import type { Artifact } from "@/types/artifact";
import { objectFootprintRadius } from "@/utils/artifactSize";

/** Clear floor the player's own body needs — mirrors PLAYER_RADIUS in
 *  PlayerRig, plus a little so a landing never starts already overlapping a
 *  wall and getting shoved by the collision pass on the first frame. */
const PLAYER_CLEARANCE = 0.8;

/** How far in front of the object the visitor is put down.
 *
 *  Has to clear the piece's own footprint (otherwise the collision pass pushes
 *  them backwards the instant they arrive, which reads as the museum shoving
 *  them) while staying inside the interaction radius PlayerRig uses, so the
 *  "Lihat …" prompt is already showing when the view settles. Anything larger
 *  lands them looking at the artifact from across the room, which defeats the
 *  point of having asked to be taken to it. */
const STANDOFF = 1.4;

/** Fallback footprint for pieces whose `real_world_size` is not filled in. */
const DEFAULT_FOOTPRINT = 0.6;

/**
 * Where to stand, and which way to look, to be face to face with an artifact.
 *
 * Used by the artifact list ("Kunjungi") to put a visitor in front of a piece
 * they picked by name. This exists because of P0-6 in the 2026-08-05 audit:
 * walking straight in from the entrance passes through the whole of Hall 1
 * without a single artifact entering interaction range, so the app's default
 * behaviour was to walk the visitor out of the exhibition. Being able to name
 * a thing and be taken to it is the direct answer to that.
 *
 * The approach direction is "from the middle of the room". Almost everything
 * here is staged against a wall, in a niche, or on a pedestal read from the
 * hall's interior, so the room's centre is a reliable stand-in for "the side
 * the visitor is meant to look from" without hand-authoring an angle for all
 * 32 pieces. A piece standing exactly at the centre has no such direction, so
 * it is approached from the entrance side instead — the way someone walking in
 * would have met it anyway.
 */
export function approachPose(
  artifact: Artifact,
  room: RoomConfig
): { x: number; z: number; facingY: number } {
  const ax = artifact.koordinat_ruangan.x;
  const az = artifact.koordinat_ruangan.z;

  const centerX = (room.bounds.minX + room.bounds.maxX) / 2;
  const centerZ = (room.bounds.minZ + room.bounds.maxZ) / 2;

  let dx = centerX - ax;
  let dz = centerZ - az;
  const len = Math.hypot(dx, dz);
  if (len < 0.001) {
    // Dead centre: approach from the entrance side (+Z), which is where the
    // hall's spawn points all sit.
    dx = 0;
    dz = 1;
  } else {
    dx /= len;
    dz /= len;
  }

  const standoff = (objectFootprintRadius(artifact) ?? DEFAULT_FOOTPRINT) + STANDOFF;
  const rawX = ax + dx * standoff;
  const rawZ = az + dz * standoff;

  // Never land outside the room. The hard clamp in PlayerRig would do this
  // anyway, but doing it here means the yaw below is computed from where the
  // visitor actually ends up rather than from a point in the wall.
  const x = clamp(rawX, room.bounds.minX + PLAYER_CLEARANCE, room.bounds.maxX - PLAYER_CLEARANCE);
  const z = clamp(rawZ, room.bounds.minZ + PLAYER_CLEARANCE, room.bounds.maxZ - PLAYER_CLEARANCE);

  // PlayerRig's forward vector is (-sin(yaw), 0, -cos(yaw)) — see the movement
  // block there. Solving that for "forward points at the artifact" gives the
  // negated arguments below; getting this backwards puts the visitor in the
  // right spot facing the opposite wall.
  const facingY = Math.atan2(-(ax - x), -(az - z));

  return { x, z, facingY };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
