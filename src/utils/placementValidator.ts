import type { RoomConfig } from "@/data/roomConfig";
import type { Artifact } from "@/types/artifact";
import { objectFootprintRadius } from "@/utils/artifactSize";

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
  // Pedestal top radius is 0.5-0.55 (ArtifactMesh.tsx); matches the
  // collision radius PlayerRig already uses for artifacts.
  artifactRegular: 0.8,
  // Featured (secondary elevated) pieces get a taller pedestal + brass
  // trim — a bit more room than plain regular.
  artifactFeatured: 0.95,
  // Zone hero: two-step plinth, wider footprint than featured.
  artifactHero: 1.1,
  // Museum-wide signature piece (Garudeya): plinth + glass vitrine —
  // needs the most negative space of anything in the scene.
  artifactSignature: 1.3,
  // Wall-mounted niche pieces (reliefs/inscriptions) are flush against the
  // wall on a shallow ledge — much smaller footprint than a floor pedestal.
  artifactNiche: 0.3,
  // Torso + outstretched arms (Dwarapala.tsx: gada at local x=+-0.75).
  dwarapala: 0.8,
  stoneCluster: 0.6,
  pillar: 0.5, // colonnade / hero-framing candi pillars
  bench: 0.9,
  pottedPlant: 0.45,
  signboardPost: 0.15,
} as const;

/** Mirrors ArtifactMesh's resolveTier() fallback so the validator picks the
 * same footprint radius the renderer actually staged the piece with —
 * including ArtifactMesh's own `pedestalScale` growth for artifacts whose
 * `real_world_size` is physically wider than the tier's default stand
 * (spec: "fix skala objek", footprintRadius harus dihitung ulang dari
 * realWorldSize). Never smaller than the tier default. */
function footprintForArtifact(artifact: Artifact): number {
  const tier = artifact.display_tier ?? (artifact.is_ikonik ? "featured" : "regular");
  const objectRadius = objectFootprintRadius(artifact) ?? 0;
  if (artifact.display_mode === "niche") return Math.max(FOOTPRINT.artifactNiche, objectRadius);
  const tierRadius = (() => {
    switch (tier) {
      case "signature":
        return FOOTPRINT.artifactSignature;
      case "hero":
        return FOOTPRINT.artifactHero;
      case "featured":
        return FOOTPRINT.artifactFeatured;
      default:
        return FOOTPRINT.artifactRegular;
    }
  })();
  return Math.max(tierRadius, objectRadius);
}

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
      radius: footprintForArtifact(artifact),
    });
  }

  // Potted plants (RoomShell.tsx, 3 hall-wide fixed positions). Inset 1.6
  // (was 1.3) — clears the colonnade's own 1.4 wall inset with margin.
  const plantPts = [
    { id: "decor-plant-1", x: minX + 1.6, z: centerZ - depth * 0.28 },
    { id: "decor-plant-2", x: maxX - 1.6, z: centerZ + depth * 0.28 },
    { id: "decor-plant-3", x: minX + 1.6, z: centerZ + depth * 0.28 },
  ];
  for (const p of plantPts) objects.push({ id: p.id, x: p.x, z: p.z, radius: FOOTPRINT.pottedPlant });

  // Hero-framing pillar pairs (RoomShell.tsx) — a former "threshold pillar"
  // pair between adjacent zone centers used to be mirrored here too, but it
  // was removed outright from RoomShell.tsx (never framed anything, sat
  // 6-12m from any wall in open floor). Must match HERO_FRAME_FORWARD/
  // HERO_FRAME_PERP/HERO_FRAME_MAX_WALL_DIST in RoomShell.tsx.
  const heroFramePoints: Array<{ x: number; z: number }> = [];
  for (const zone of room.zones) {
    if (!zone.heroFocus) continue;
    const dx = zone.heroFocus.x - zone.center.x;
    const dz = zone.heroFocus.z - zone.center.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    const frameX = zone.heroFocus.x - ux * 1.6;
    const frameZ = zone.heroFocus.z - uz * 1.6;
    const wallDist = Math.min(frameX - minX, maxX - frameX, frameZ - minZ, maxZ - frameZ);
    if (wallDist > 5) continue;
    heroFramePoints.push({ x: zone.heroFocus.x, z: zone.heroFocus.z });
    const perpX = -uz * 1.8;
    const perpZ = ux * 1.8;
    objects.push({ id: `decor-hero-frame-${zone.id}-a`, x: frameX + perpX, z: frameZ + perpZ, radius: FOOTPRINT.pillar });
    objects.push({ id: `decor-hero-frame-${zone.id}-b`, x: frameX - perpX, z: frameZ - perpZ, radius: FOOTPRINT.pillar });
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

  // HallColonnade pillars (HallEdgeDecor.tsx) — skips any slot too close to
  // a zone's hero/signature focus, a wall-flush niche piece, or a potted
  // plant corner (mirrors RoomShell's colonnadeExclusions).
  const nicheExclusions = artifacts
    .filter((a) => a.display_mode === "niche")
    .map((a) => ({ x: a.koordinat_ruangan.x, z: a.koordinat_ruangan.z, dist: footprintForArtifact(a) + 1.0 }));
  const colonnadeExclusions = [
    ...heroFramePoints.map((h) => ({ x: h.x, z: h.z, dist: 2.3 })),
    ...nicheExclusions,
    ...plantPts.map((p) => ({ x: p.x, z: p.z, dist: 1.45 })),
  ];
  const PILLAR_SPACING = 4.5;
  const PILLAR_INSET = 1.4;
  let ci = 0;
  for (let z = minZ + 3; z <= maxZ - 3; z += PILLAR_SPACING) {
    const lx = minX + PILLAR_INSET;
    const rx = maxX - PILLAR_INSET;
    if (!colonnadeExclusions.some((e) => Math.hypot(e.x - lx, e.z - z) < e.dist)) {
      objects.push({ id: `decor-colonnade-l-${ci}`, x: lx, z, radius: FOOTPRINT.pillar });
    }
    if (!colonnadeExclusions.some((e) => Math.hypot(e.x - rx, e.z - z) < e.dist)) {
      objects.push({ id: `decor-colonnade-r-${ci}`, x: rx, z, radius: FOOTPRINT.pillar });
    }
    ci++;
  }

  // Benches (HallEdgeDecor.tsx) — offset away from the zone's own
  // hero/signature side, not always +x (mirrors HallBenches' offsetDir).
  for (const zone of room.zones) {
    if (zone.id === "welcome") continue;
    const offsetDir = zone.heroFocus ? -Math.sign(zone.heroFocus.x - zone.center.x) || 1 : 1;
    objects.push({
      id: `decor-bench-${zone.id}`,
      x: zone.center.x + offsetDir * zone.radius * 0.45,
      z: zone.center.z - zone.radius * 0.55 - 1.2,
      radius: FOOTPRINT.bench,
    });
  }

  // Zone-specific set dressing (RoomShell.tsx) — prasejarah's flavor-rock
  // clusters are hand-placed (not formula-derived from zone center) to clear
  // the hero/featured pieces staged around the Pithecanthropus terminating
  // vista; keep this in sync with the `stoneClusters` array in RoomShell.tsx.
  const prasejarah = room.zones.find((z) => z.id === "prasejarah");
  if (prasejarah) {
    [
      [-11.05, -1.74],
      [-12.5, -2.74],
      [-12.68, -0.12],
    ].forEach(([x, z], i) => objects.push({ id: `decor-stone-cluster-${i}`, x, z, radius: FOOTPRINT.stoneCluster }));
  }

  const hinduBuddha = room.zones.find((z) => z.id === "hindu-buddha");
  if (hinduBuddha) {
    const { x: zx, z: zz } = hinduBuddha.center;
    objects.push({ id: "decor-dwarapala-left", x: zx - 2.6, z: zz + hinduBuddha.radius * 0.9, radius: FOOTPRINT.dwarapala });
    objects.push({ id: "decor-dwarapala-right", x: zx + 2.6, z: zz + hinduBuddha.radius * 0.9, radius: FOOTPRINT.dwarapala });
  }

  // Center installation (RoomShell.tsx CenterInstallation) — flanking pillars.
  if (room.centerFocus) {
    objects.push({ id: "decor-center-pillar-a", x: room.centerFocus.x - 1.8, z: room.centerFocus.z, radius: FOOTPRINT.pillar });
    objects.push({ id: "decor-center-pillar-b", x: room.centerFocus.x + 1.8, z: room.centerFocus.z, radius: FOOTPRINT.pillar });
  }

  return objects;
}
