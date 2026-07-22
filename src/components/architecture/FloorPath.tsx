import { useMemo } from "react";
import type { RoomConfig } from "@/data/roomConfig";

interface PathNode {
  x: number;
  z: number;
  accent: string;
}

function getPathNodes(room: RoomConfig): PathNode[] {
  const zones = [...room.zones].sort((a, b) => a.pathOrder - b.pathOrder);
  // Route through each zone's hero (if it has one) rather than its bare
  // center — the wayfinding line should flow toward the staged piece and
  // pause there (spec 2c "berhenti sejenak di depan hero"), not stop short
  // at an empty midpoint.
  const nodes: PathNode[] = zones.map((z) => ({
    x: z.heroFocus?.x ?? z.center.x,
    z: z.heroFocus?.z ?? z.center.z,
    accent: z.accent,
  }));

  // Hall 2 has no "welcome" zone of its own to start the route from — lead
  // in from the archway arrival point instead.
  if (room.id === "hall-2") {
    nodes.unshift({ x: room.spawn.x, z: room.spawn.z, accent: zones[0]?.accent ?? room.accentColor });
  }

  // Route through the hall's center installation (if any) right after the
  // first node — the wayfinding line should visibly cross the middle of
  // the room on its way to the side zones, not skip straight past it
  // (spec 3.3: "alurkan sirkulasi melewati tengah").
  if (room.centerFocus) {
    nodes.splice(1, 0, { x: room.centerFocus.x, z: room.centerFocus.z, accent: room.accentColor });
  }

  // Continue the line to the outgoing archway, if this hall has one, so the
  // path visibly hands off rather than dead-ending at the last zone —
  // and one step further, past the wall into the peek zone (matches
  // RoomShell's ArchwayGlimpse), so it visibly crosses the opening instead
  // of just touching its threshold (spec: "lantai wayfinding menembus arch").
  const outDoor = room.doors[0];
  if (outDoor) {
    const last = zones[zones.length - 1];
    const accent = last?.accent ?? room.accentColor;
    nodes.push({ x: outDoor.position.x, z: outDoor.position.z, accent });
    const { minZ, maxZ } = room.bounds;
    const wallZ = Math.abs(outDoor.position.z - minZ) < 2 ? minZ : maxZ;
    const outwardSign = wallZ === minZ ? -1 : 1;
    nodes.push({ x: outDoor.position.x, z: wallZ + outwardSign * 1.6, accent });
  }

  return nodes;
}

/**
 * Floor inlay + low-opacity arrows connecting zones in `pathOrder` (spec
 * section 8.1) — the main "don't get lost" cue now that there's no
 * corridor-and-doors structure forcing a route.
 */
export function FloorPath({ room }: { room: RoomConfig }) {
  const nodes = useMemo(() => getPathNodes(room), [room]);

  return (
    <group>
      {nodes.slice(0, -1).map((a, i) => {
        const b = nodes[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.5) return null;
        const angle = Math.atan2(dx, dz);
        const midX = (a.x + b.x) / 2;
        const midZ = (a.z + b.z) / 2;
        return (
          <group key={i} position={[midX, 0.02, midZ]} rotation={[0, angle, 0]}>
            <mesh>
              <boxGeometry args={[0.45, 0.015, len]} />
              <meshStandardMaterial color={a.accent} transparent opacity={0.5} />
            </mesh>
            <mesh position={[0, 0.01, len * 0.28]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.28, 0.6, 3]} />
              <meshStandardMaterial color={a.accent} transparent opacity={0.75} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
