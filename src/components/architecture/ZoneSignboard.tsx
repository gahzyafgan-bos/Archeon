import { useEffect, useMemo } from "react";
import type { ZoneConfig } from "@/data/roomConfig";
import { createSignPlateTexture } from "@/utils/panelTexture";

/** Plate geometry, in metres. Fixed — signage does not resize with distance. */
const PLATE_W = 1.5;
const PLATE_H = 0.42;
/** 10 cm capitals: the middle of the 8-15 cm band real museum zone signage uses. */
const TITLE_CAP_M = 0.1;
const POST_HEIGHT = 2.2;

/**
 * Standing signboard at a zone's entrance (spec section 8.2) — a painted plate
 * mounted on a wooden post.
 *
 * This used to be a drei <Html> label with `distanceFactor={10}`, i.e. DOM. Two
 * things were wrong with that, and both were reported:
 *
 *  - In Mode VR a DOM overlay is drawn ONCE, across the whole canvas, so it
 *    straddled the seam between the two eye viewports. Each eye then saw a
 *    different half of the words, which the brain cannot fuse (binocular
 *    rivalry) — nauseating, not merely unreadable.
 *  - `distanceFactor` makes a label grow as you walk up to it, which is UI
 *    behaviour, not object behaviour. Walking close to a zone filled the
 *    screen with "KOLEKSI PRASEJARAH".
 *
 * As geometry it is drawn by each eye pass like everything else, holds one
 * real-world size at every distance, and is properly occluded by the walls and
 * artifacts in front of it.
 */
export function ZoneSignboard({ zone }: { zone: ZoneConfig }) {
  const texture = useMemo(
    () =>
      createSignPlateTexture({
        title: zone.label.toUpperCase(),
        widthM: PLATE_W,
        heightM: PLATE_H,
        // Warm wood ground with ivory letters and the zone's own accent as the
        // hairline rule — the museum's signage palette, not a dark UI pill.
        ground: "#7A5230",
        ink: "#F2E9D8",
        accent: zone.accent,
        titleCapM: TITLE_CAP_M,
      }),
    [zone.label, zone.accent]
  );

  useEffect(() => () => texture.dispose(), [texture]);

  if (zone.id === "welcome") return null; // spawn point itself, a sign here is redundant

  // Post planted near the zone's edge closest to the walkway (the +Z side,
  // toward the welcome zone / hall entrance, for every populated zone in this
  // layout) — so the plate's front face (+Z, a plane's default normal) already
  // faces an approaching visitor without any rotation.
  const postX = zone.center.x;
  const postZ = zone.center.z + zone.radius * 0.75;

  return (
    <group position={[postX, 0, postZ]}>
      <mesh position={[0, POST_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, POST_HEIGHT, 8]} />
        <meshStandardMaterial color="#7A5230" roughness={0.8} />
      </mesh>
      {/* Backing board, slightly larger than the printed face, so the plate
          reads as a physical board bolted to the post rather than as a decal
          floating in front of it. */}
      <mesh position={[0, POST_HEIGHT - 0.26, 0]} castShadow>
        <boxGeometry args={[PLATE_W + 0.06, PLATE_H + 0.06, 0.05]} />
        <meshStandardMaterial color="#5E3F26" roughness={0.85} />
      </mesh>
      <mesh position={[0, POST_HEIGHT - 0.26, 0.026]}>
        <planeGeometry args={[PLATE_W, PLATE_H]} />
        <meshStandardMaterial map={texture} roughness={0.6} metalness={0.05} />
      </mesh>
    </group>
  );
}
