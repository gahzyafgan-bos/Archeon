interface PottedPlantProps {
  position: [number, number, number];
  potColor?: string;
  leafColor?: string;
  scale?: number;
}

// Fixed offsets for a small foliage cluster — good enough to read as "a
// plant" from museum-visitor distance without pulling in a real asset or
// paying for per-mount randomness.
const LEAF_OFFSETS: Array<[number, number, number, number]> = [
  [0, 0.55, 0, 0.28],
  [0.18, 0.42, 0.12, 0.2],
  [-0.16, 0.45, -0.1, 0.22],
  [0.05, 0.38, -0.2, 0.18],
];

/**
 * Simple corner ornament (potted plant / decorative urn) — plain primitives
 * only, no texture, to stay cheap. Used a handful of times per room (spec
 * section 3.2: "2-3 tanaman... jangan lebih"), so a plain per-instance
 * `<mesh>` is simpler than InstancedMesh for this few a count.
 */
export function PottedPlant({
  position,
  potColor = "#5a4030",
  leafColor = "#4a6b3a",
  scale = 1,
}: PottedPlantProps) {
  return (
    <group position={position} scale={scale}>
      {/* Pot */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.16, 0.44, 12]} />
        <meshStandardMaterial color={potColor} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.44, 0]} castShadow>
        <torusGeometry args={[0.22, 0.03, 8, 16]} />
        <meshStandardMaterial color={potColor} roughness={0.8} />
      </mesh>
      {/* Foliage cluster */}
      {LEAF_OFFSETS.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 0]} />
          <meshStandardMaterial color={leafColor} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
}
