import type { RoomConfig } from "@/data/roomConfig";
import type { Artifact } from "@/types/artifact";

export interface PlacedObject {
  id: string;
  x: number;
  z: number;
  /** Footprint radius on the XZ plane, in world units. */
  radius: number;
}

/** Minimum breathing-room gap enforced between any two objects' footprints,
 * on top of their own radii (spec: "aturan jarak konkret"). Kept modest
 * (rather than the spec's 0.6-1.0 starting point) because it's calibrated
 * against this project's actual, fairly small placeholder geometry —
 * a looser margin would flag intentionally-tight-but-clear decor. */
export const PLACEMENT_MARGIN = 0.5;

/** Footprint radii, calibrated against each object's real rendered geometry
 * (see the components listed) rather than generic size classes. */
export const FOOTPRINT = {
  // Pedestal top radius is 0.55-0.6 (ArtifactMesh.tsx); matches the
  // collision radius PlayerRig already uses for artifacts.
  artifactRegular: 0.8,
  // Iconic pieces carry extra dressing (Garudeya's glass vitrine is
  // 1.4x1.4, Durga/Ganesha get a wider spotlight cone) — a bit more room.
  artifactIconic: 1.0,
  // Torso + outstretched arms (Dwarapala.tsx: gada at local x=+-0.75).
  dwarapala: 0.8,
  stoneCluster: 0.6,
  pillar: 0.5, // colonnade / threshold candi pillars
  bench: 0.9,
  pottedPlant: 0.45,
  signboardPost: 0.15,
} as const;

/**
 * Dev-only: warns (never throws) about every pair of placed objects whose
 * footprints overlap. Call once per hall mount (see RoomShell's useEffect) —
 * never from inside a per-frame loop.
 */
export function validatePlacement(roomLabel: string, objects: PlacedObject[]): void {
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i];
      const b = objects[j];
      const dist = Math.hypot(a.x - b.x, a.z - b.z);
      const minGap = a.radius + b.radius + PLACEMENT_MARGIN;
      if (dist < minGap) {
        // eslint-disable-next-line no-console
        console.warn(
          `[placement] ${roomLabel}: "${a.id}" overlaps "${b.id}" — dist ${dist.toFixed(2)}m, need >= ${minGap.toFixed(2)}m (short by ${(minGap - dist).toFixed(2)}m)`
        );
      }
    }
  }
}

/**
 * Rebuilds the same fixed placement formulas RoomShell/HallEdgeDecor render
 * from (procedural decor is deterministic, not randomized), so the
 * validator can check them without touching the live scene graph. If you
 * move/add decor in those files, mirror the change here too.
 */
export function buildPlacedObjects(room: RoomConfig, artifacts: Artifact[]): PlacedObject[] {
  const { minX, maxX, minZ, maxZ } = room.bounds;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const depth = maxZ - minZ;
  const objects: PlacedObject[] = [];

  for (const artifact of artifacts) {
    objects.push({
      id: artifact.id,
      x: artifact.koordinat_ruangan.x,
      z: artifact.koordinat_ruangan.z,
      radius: artifact.is_ikonik ? FOOTPRINT.artifactIconic : FOOTPRINT.artifactRegular,
    });
  }

  // Potted plants (RoomShell.tsx, 3 hall-wide fixed positions)
  objects.push({ id: "decor-plant-1", x: minX + 1.3, z: centerZ - depth * 0.28, radius: FOOTPRINT.pottedPlant });
  objects.push({ id: "decor-plant-2", x: maxX - 1.3, z: centerZ + depth * 0.28, radius: FOOTPRINT.pottedPlant });
  objects.push({ id: "decor-plant-3", x: minX + 1.3, z: centerZ + depth * 0.28, radius: FOOTPRINT.pottedPlant });

  // Threshold pillars between adjacent zones (RoomShell.tsx)
  for (let i = 1; i < room.zones.length; i++) {
    const prev = room.zones[i - 1];
    const zone = room.zones[i];
    const midX = (prev.center.x + zone.center.x) / 2;
    const midZ = (prev.center.z + zone.center.z) / 2;
    const dx = zone.center.x - prev.center.x;
    const dz = zone.center.z - prev.center.z;
    const len = Math.hypot(dx, dz) || 1;
    const perpX = (-dz / len) * 2.2;
    const perpZ = (dx / len) * 2.2;
    objects.push({ id: `decor-threshold-${zone.id}-a`, x: midX + perpX, z: midZ + perpZ, radius: FOOTPRINT.pillar });
    objects.push({ id: `decor-threshold-${zone.id}-b`, x: midX - perpX, z: midZ - perpZ, radius: FOOTPRINT.pillar });
  }

  // Zone signboard posts (ZoneSignboard.tsx)
  for (const zone of room.zones) {
    if (zone.id === "welcome") continue;
    objects.push({
      id: `decor-sign-${zone.id}`,
      x: zone.center.x,
      z: zone.center.z + zone.radius * 0.75,
      radius: FOOTPRINT.signboardPost,
    });
  }

  // HallColonnade pillars (HallEdgeDecor.tsx)
  const PILLAR_SPACING = 4.5;
  const PILLAR_INSET = 1.4;
  let ci = 0;
  for (let z = minZ + 3; z <= maxZ - 3; z += PILLAR_SPACING) {
    objects.push({ id: `decor-colonnade-l-${ci}`, x: minX + PILLAR_INSET, z, radius: FOOTPRINT.pillar });
    objects.push({ id: `decor-colonnade-r-${ci}`, x: maxX - PILLAR_INSET, z, radius: FOOTPRINT.pillar });
    ci++;
  }

  // Benches (HallEdgeDecor.tsx)
  for (const zone of room.zones) {
    if (zone.id === "welcome") continue;
    objects.push({
      id: `decor-bench-${zone.id}`,
      x: zone.center.x + zone.radius * 0.45,
      z: zone.center.z - zone.radius * 0.55 - 1.2,
      radius: FOOTPRINT.bench,
    });
  }

  // Zone-specific set dressing (RoomShell.tsx)
  const prasejarah = room.zones.find((z) => z.id === "prasejarah");
  if (prasejarah) {
    const { x: zx, z: zz } = prasejarah.center;
    [
      [zx - 5, zz - 3],
      [zx + 5, zz - 3],
      [zx - 5, zz + 3],
    ].forEach(([x, z], i) => objects.push({ id: `decor-stone-cluster-${i}`, x, z, radius: FOOTPRINT.stoneCluster }));
  }

  const hinduBuddha = room.zones.find((z) => z.id === "hindu-buddha");
  if (hinduBuddha) {
    const { x: zx, z: zz } = hinduBuddha.center;
    objects.push({ id: "decor-dwarapala-left", x: zx - 2.6, z: zz + hinduBuddha.radius * 0.85, radius: FOOTPRINT.dwarapala });
    objects.push({ id: "decor-dwarapala-right", x: zx + 2.6, z: zz + hinduBuddha.radius * 0.85, radius: FOOTPRINT.dwarapala });
  }

  return objects;
}
