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
  // Museum-wide signature piece (Garudeya): a bare eye-level plinth since the
  // glass vitrine was removed. Deliberately kept well above the plinth's own
  // ~0.52m radius — with no case around it, this generous number is what
  // reserves the piece its object-free pocket, which is now the only thing
  // marking out its territory.
  artifactSignature: 1.3,
  // Wall-mounted niche pieces (reliefs/inscriptions) are flush against the
  // wall on a shallow ledge — much smaller footprint than a floor pedestal.
  artifactNiche: 0.3,
  // Torso + outstretched arms (Dwarapala.tsx: gada at local x=+-0.75).
  dwarapala: 0.8,
  stoneCluster: 0.6,
  pillar: 0.5, // colonnade / hero-framing candi pillars
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
  const objects: PlacedObject[] = [];

  for (const artifact of artifacts) {
    objects.push({
      id: artifact.id,
      x: artifact.koordinat_ruangan.x,
      z: artifact.koordinat_ruangan.z,
      radius: footprintForArtifact(artifact),
    });
  }

  // Potted plants (both the 3 hall-wide fixed ones and the fase-4 gap-fillers)
  // were removed from RoomShell.tsx per revisi desainer — pengguna menilai
  // pohon/pot tanaman sebagai filler generik tanpa nilai. Nothing to place or
  // exclude for them anymore.

  // Hero-framing pillar pairs used to be rendered here (and mirrored) but were
  // removed from RoomShell.tsx — two 3m columns planted in front of each zone
  // hero were the floor-level obstruction the redesign flagged (they buried
  // Garudeya). Heroes now stage via spotlight + wall backdrop + negative space
  // only, so there is nothing to place here anymore.

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
  // a zone's hero/signature focus or a wall-flush niche piece (mirrors
  // RoomShell's colonnadeExclusions).
  // Mirrors RoomShell's colonnadeExclusions: skip a colonnade slot near any
  // zone heroFocus (2.3) or a wall-flush niche piece, plus the signature piece
  // (Garudeya) which needs the widest colonnade-free clearance.
  const heroExclusions = room.zones
    .filter((z) => z.heroFocus)
    .map((z) => ({ x: z.heroFocus!.x, z: z.heroFocus!.z, dist: 2.3 }));
  const nicheExclusions = artifacts
    .filter((a) => a.display_mode === "niche")
    .map((a) => ({ x: a.koordinat_ruangan.x, z: a.koordinat_ruangan.z, dist: footprintForArtifact(a) + 1.0 }));
  // +1.6 (not +1.0) for the signature piece — mirrors RoomShell's widened
  // signature exclusion after the Garudeya vitrine was removed; see the
  // comment there.
  const signatureExclusions = artifacts
    .filter((a) => a.display_tier === "signature")
    .map((a) => ({ x: a.koordinat_ruangan.x, z: a.koordinat_ruangan.z, dist: footprintForArtifact(a) + 1.6 }));
  const colonnadeExclusions = [...heroExclusions, ...nicheExclusions, ...signatureExclusions];
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

  // Benches were removed from HallEdgeDecor.tsx — the per-zone "resting bench"
  // rendered as a featureless brown slab and can't be sat on anyway (see the
  // note where HallBenches used to be). Nothing to place for them.

  // Zone-specific set dressing (RoomShell.tsx) — prasejarah's flavor-rock
  // clusters are hand-placed (not formula-derived from zone center) to clear
  // the hero/featured pieces staged around the Pithecanthropus terminating
  // vista; keep this in sync with the `stoneClusters` array in RoomShell.tsx.
  const prasejarah = room.zones.find((z) => z.id === "prasejarah");
  if (prasejarah) {
    [
      [-11.4, -6.5],
      [-11.4, -3.6],
      [-11.3, -1.6],
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
