import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import type { RoomConfig } from "@/data/roomConfig";

const WOOD_COLOR = "#7A5230";
const PILLAR_HEIGHT = 5.4;
const PILLAR_SPACING = 4.5;
const PILLAR_INSET = 1.4;

/**
 * Colonnade running along both long walls of a hall — the main "isi sudut
 * biar megah" element (spec section 6/7). One InstancedMesh per part (shaft,
 * capital) regardless of how many pillars there are, so a dozen-plus pillars
 * cost the same 2 draw calls as a handful would.
 */
export function HallColonnade({ room }: { room: RoomConfig }) {
  const { minX, maxX, minZ, maxZ } = room.bounds;

  const positions = useMemo(() => {
    const pts: Array<[number, number]> = [];
    for (let z = minZ + 3; z <= maxZ - 3; z += PILLAR_SPACING) {
      pts.push([minX + PILLAR_INSET, z]);
      pts.push([maxX - PILLAR_INSET, z]);
    }
    return pts;
  }, [minX, maxX, minZ, maxZ]);

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
        <cylinderGeometry args={[0.26, 0.32, PILLAR_HEIGHT, 12]} />
        <meshStandardMaterial color={WOOD_COLOR} roughness={0.85} />
        {positions.map(([x, z], i) => (
          <Instance key={i} position={[x, PILLAR_HEIGHT / 2, z]} />
        ))}
      </Instances>
      <Instances limit={positions.length} castShadow frustumCulled={false} frames={1}>
        <cylinderGeometry args={[0.42, 0.48, 0.28, 12]} />
        <meshStandardMaterial color={room.accentColor} roughness={0.55} metalness={0.25} />
        {positions.map(([x, z], i) => (
          <Instance key={i} position={[x, PILLAR_HEIGHT + 0.14, z]} />
        ))}
      </Instances>
      <Instances limit={positions.length} frustumCulled={false} frames={1}>
        <cylinderGeometry args={[0.36, 0.4, 0.3, 12]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
        {positions.map(([x, z], i) => (
          <Instance key={i} position={[x, 0.15, z]} />
        ))}
      </Instances>
    </group>
  );
}

const BENCH_COLOR = "#7A5230";

/**
 * One simple resting bench per non-welcome zone, off to the side of the
 * zone's floor motif so it never sits in the walking path. Instanced for
 * consistency with the rest of this file even though counts are small here —
 * the geometry/material are already defined, so it's free.
 */
export function HallBenches({ room }: { room: RoomConfig }) {
  const benches = useMemo(
    () =>
      room.zones
        .filter((z) => z.id !== "welcome")
        .map((z) => ({
          // Back edge of the zone's own floor motif (away from the entrance
          // signboard, which sits on the +Z side) — clear of both the
          // colonnade (that lines the X walls) and neighboring zones.
          x: z.center.x,
          z: z.center.z - z.radius * 0.55 - 1.2,
          rotationY: 0,
        })),
    [room.zones]
  );

  if (benches.length === 0) return null;

  return (
    <group>
      {/* Same frustum-culling fix as HallColonnade above — benches are large
          enough and few enough per hall that always-render is the safe call. */}
      <Instances limit={benches.length} castShadow receiveShadow frustumCulled={false} frames={1}>
        <boxGeometry args={[1.6, 0.45, 0.5]} />
        <meshStandardMaterial color={BENCH_COLOR} roughness={0.8} />
        {benches.map((b, i) => (
          <Instance key={i} position={[b.x, 0.4, b.z]} rotation={[0, b.rotationY, 0]} />
        ))}
      </Instances>
      <Instances limit={benches.length * 2} frustumCulled={false} frames={1}>
        <boxGeometry args={[0.1, 0.4, 0.4]} />
        <meshStandardMaterial color="#3a2818" roughness={0.85} />
        {benches.flatMap((b, i) => [
          <Instance key={`${i}-a`} position={[b.x - 0.65, 0.2, b.z]} rotation={[0, b.rotationY, 0]} />,
          <Instance key={`${i}-b`} position={[b.x + 0.65, 0.2, b.z]} rotation={[0, b.rotationY, 0]} />,
        ])}
      </Instances>
    </group>
  );
}
