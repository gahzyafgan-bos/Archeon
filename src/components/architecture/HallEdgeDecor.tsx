import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import type { RoomConfig } from "@/data/roomConfig";
import { colonnadeShaftHeight, DEFAULT_CEILING_HEIGHT } from "@/utils/hallGeometry";

const WOOD_COLOR = "#7A5230";
const PILLAR_SPACING = 4.5;
const PILLAR_INSET = 1.4;
/** Capital block sitting on top of the shaft, and the base ring under it. */
const CAPITAL_H = 0.28;
const BASE_H = 0.3;

/** Hero/signature focus points and wall-flush niche artifacts read as
 * clutter if a colonnade pillar lands right on top of them — this was
 * latent even before the Hall 1 right-size (the old 40x24 hall just
 * happened to have enough slack that no pillar landed close enough to
 * notice). A pillar slot is skipped whenever it's inside `dist` of any
 * exclusion point. */
export interface ColonnadeExclusion {
  x: number;
  z: number;
  dist: number;
}

/**
 * Colonnade running along both long walls of a hall — the main "isi sudut
 * biar megah" element (spec section 6/7). One InstancedMesh per part (shaft,
 * capital) regardless of how many pillars there are, so a dozen-plus pillars
 * cost the same 2 draw calls as a handful would.
 */
export function HallColonnade({ room, exclude = [] }: { room: RoomConfig; exclude?: ColonnadeExclusion[] }) {
  const { minX, maxX, minZ, maxZ } = room.bounds;

  // Derived per hall instead of the fixed 5.4 m this used to carry. That
  // constant was authored against the original 7 m ceiling; once Hall 2 was
  // right-sized to 5.5 m the capital's top sat at 5.68 m, i.e. through the
  // ceiling plane. See utils/hallGeometry.ts.
  const shaftHeight = colonnadeShaftHeight(room.ceilingHeight ?? DEFAULT_CEILING_HEIGHT, CAPITAL_H);

  const positions = useMemo(() => {
    const pts: Array<[number, number]> = [];
    for (let z = minZ + 3; z <= maxZ - 3; z += PILLAR_SPACING) {
      const lx = minX + PILLAR_INSET;
      const rx = maxX - PILLAR_INSET;
      if (!exclude.some((e) => Math.hypot(e.x - lx, e.z - z) < e.dist)) pts.push([lx, z]);
      if (!exclude.some((e) => Math.hypot(e.x - rx, e.z - z) < e.dist)) pts.push([rx, z]);
    }
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minX, maxX, minZ, maxZ, exclude]);

  return (
    <group>
      {/* frustumCulled=false: drei's <Instances> never recomputes the parent
          InstancedMesh's bounding sphere after placing instances, so it stays
          the tiny sphere around the base geometry at local origin — once the
          camera frustum stops containing world-origin (which happens as soon
          as the player walks away from hall-center to approach a pillar),
          three.js wrongly culls the *entire* batch and every pillar vanishes.
          These are large, prominent, reasonably-counted props (a dozen-ish
          per hall), so disabling culling outright is cheap and correct here —
          see spec: don't do this for small/numerous props. frames=1 stops the
          otherwise-continuous per-frame matrix rebuild for props that never move. */}
      <Instances limit={positions.length} castShadow frustumCulled={false} frames={1}>
        <cylinderGeometry args={[0.26, 0.32, shaftHeight, 12]} />
        <meshStandardMaterial color={WOOD_COLOR} roughness={0.85} />
        {positions.map(([x, z], i) => (
          <Instance key={i} position={[x, shaftHeight / 2, z]} />
        ))}
      </Instances>
      <Instances limit={positions.length} castShadow frustumCulled={false} frames={1}>
        <cylinderGeometry args={[0.42, 0.48, CAPITAL_H, 12]} />
        <meshStandardMaterial color={room.accentColor} roughness={0.55} metalness={0.25} />
        {positions.map(([x, z], i) => (
          <Instance key={i} position={[x, shaftHeight + CAPITAL_H / 2, z]} />
        ))}
      </Instances>
      <Instances limit={positions.length} frustumCulled={false} frames={1}>
        <cylinderGeometry args={[0.36, 0.4, BASE_H, 12]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
        {positions.map(([x, z], i) => (
          <Instance key={i} position={[x, BASE_H / 2, z]} />
        ))}
      </Instances>
    </group>
  );
}

/**
 * `HallBenches` used to live here: one "resting bench" per non-welcome zone,
 * placed at `zone.center + radius*0.45` across and `radius*0.55 + 1.2` back,
 * which in Hall 1's prehistoric zone put it at (-4.16, -6.06) — alone, 1.4 m
 * off the blank south wall.
 *
 * It was removed rather than restyled. Two reasons, and the first is the one
 * that matters:
 *
 *  1. It never read as a bench. The seat was a single 1.6 x 0.5 x 0.45 m box
 *     in flat `#7A5230`, and the two "legs" (0.1 x 0.4 x 0.4) sat at y 0-0.4,
 *     i.e. INSIDE the seat box, which spans y 0.175-0.625 and is deeper than
 *     they are. Only the bottom 17 cm of each leg was ever visible, hidden
 *     behind the seat's own overhang. What actually rendered was a featureless
 *     brown slab floating just off the floor — with no back, no armrest, no
 *     slats, no label, and nothing on it.
 *  2. Nothing in this museum can be sat on. It was decor pretending to be
 *     furniture, taking up floor area in front of the wall.
 *
 * There is deliberately no replacement object. The emptiness it stood in was
 * the wall's problem, not the floor's — see the baked wall system in
 * utils/wallTexture.ts. No collider was ever registered for it (PlayerRig only
 * collides with artifacts, greeters and the room bounds), so nothing invisible
 * is left behind; the mirror entry in utils/placementValidator.ts is gone too.
 */
