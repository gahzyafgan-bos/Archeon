import { useMemo } from "react";
import * as THREE from "three";

interface HangingLampProps {
  position: [number, number, number];
  accentColor: string;
  scale?: number;
}

/**
 * How far above `position.y` the fixture reaches — the cord's top end, i.e.
 * the point that has to meet a ceiling beam. Exported because the caller is
 * the one that knows where the beam grid is (utils/hallGeometry.ts); a lamp
 * that positions itself from a guessed ceiling height is exactly how the cord
 * ended up poking out through the roof.
 */
export const LAMP_CORD_TOP = 0.8;

/**
 * Purely decorative pendant lamp — a visual "reason" for the room's warm
 * ambient light rather than an actual light source. Adding a real light per
 * lamp on top of the per-artifact spotlights (see ArtifactMesh) would push
 * the simultaneous real-time light count too high for mobile; an emissive
 * glass globe reads as "lit" against the already-bright base lighting
 * (section 1) without any per-fragment lighting cost.
 */
export function HangingLamp({ position, accentColor, scale = 1 }: HangingLampProps) {
  const globeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#fff4d6",
        emissive: accentColor,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      }),
    [accentColor]
  );

  return (
    <group position={position} scale={scale}>
      {/* Suspension cord */}
      <mesh position={[0, LAMP_CORD_TOP / 2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, LAMP_CORD_TOP, 6]} />
        <meshStandardMaterial color="#3a2e20" roughness={0.8} />
      </mesh>
      {/* Canopy where the cord meets the shade — no cast: it's a small ceiling
          fixture right next to the beam grid, casting it just adds another
          stray mark to the same floor area the beam-shadow fix is cleaning up. */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 0.12, 12]} />
        <meshStandardMaterial color="#4a3a26" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* Glass globe, glowing */}
      <mesh position={[0, -0.22, 0]} material={globeMaterial}>
        <sphereGeometry args={[0.16, 16, 16]} />
      </mesh>
      {/* Bottom cap */}
      <mesh position={[0, -0.38, 0]}>
        <coneGeometry args={[0.08, 0.1, 12]} />
        <meshStandardMaterial color="#4a3a26" roughness={0.7} metalness={0.3} />
      </mesh>
    </group>
  );
}
