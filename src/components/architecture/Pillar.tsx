import { useMemo } from "react";
import * as THREE from "three";

type PillarStyle = "joglo" | "candi" | "kolonial";

interface PillarProps {
  height: number;
  radius: number;
  style: PillarStyle;
  accentColor: string;
  position: [number, number, number];
}

export function Pillar({ height, radius, style, accentColor, position }: PillarProps) {
  const materials = useMemo(() => {
    let bodyMat, baseMat, capMat;
    switch (style) {
      case "joglo":
        bodyMat = new THREE.MeshStandardMaterial({
          color: "#5a4028",
          roughness: 0.85,
        });
        baseMat = new THREE.MeshStandardMaterial({
          color: "#4a3020",
          roughness: 0.88,
        });
        capMat = new THREE.MeshStandardMaterial({
          color: "#5a4028",
          roughness: 0.85,
          emissive: accentColor,
          emissiveIntensity: 0.1,
        });
        break;
      case "candi":
        bodyMat = new THREE.MeshStandardMaterial({
          color: "#4a4438",
          roughness: 0.9,
        });
        baseMat = new THREE.MeshStandardMaterial({
          color: "#3a3428",
          roughness: 0.92,
        });
        capMat = new THREE.MeshStandardMaterial({
          color: "#4a4438",
          roughness: 0.9,
          emissive: accentColor,
          emissiveIntensity: 0.15,
        });
        break;
      case "kolonial":
        bodyMat = new THREE.MeshStandardMaterial({
          color: "#6a6866",
          roughness: 0.6,
          metalness: 0.3,
        });
        baseMat = new THREE.MeshStandardMaterial({
          color: "#5a5856",
          roughness: 0.65,
          metalness: 0.35,
        });
        capMat = new THREE.MeshStandardMaterial({
          color: "#6a6866",
          roughness: 0.6,
          metalness: 0.3,
          emissive: accentColor,
          emissiveIntensity: 0.08,
        });
        break;
    }
    return { bodyMat, baseMat, capMat };
  }, [style, accentColor]);

  const segments = 16;

  return (
    <group position={position}>
      {/* Base (umpak) */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow material={materials.baseMat}>
        <cylinderGeometry args={[radius * 1.4, radius * 1.5, 0.6, segments]} />
      </mesh>
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow material={materials.baseMat}>
        <cylinderGeometry args={[radius * 1.2, radius * 1.3, 0.2, segments]} />
      </mesh>

      {/* Body with decorative rings */}
      <mesh position={[0, 0.9 + height / 2, 0]} castShadow material={materials.bodyMat}>
        <cylinderGeometry args={[radius, radius, height, segments]} />
      </mesh>
      {/* Decorative horizontal rings */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[0, 1.2 + i * (height / 4), 0]}
          castShadow
          material={materials.capMat}
        >
          <cylinderGeometry args={[radius * 1.05, radius * 1.05, 0.08, segments]} />
        </mesh>
      ))}

      {/* Capital (kepala tiang) */}
      {style === "joglo" && (
        <group position={[0, 0.9 + height, 0]}>
          <mesh castShadow material={materials.capMat}>
            <boxGeometry args={[radius * 2.2, 0.3, radius * 2.2]} />
          </mesh>
          <mesh position={[0, 0.25, 0]} castShadow material={materials.capMat}>
            <boxGeometry args={[radius * 1.8, 0.25, radius * 1.8]} />
          </mesh>
          <mesh position={[0, 0.48, 0]} castShadow material={materials.capMat}>
            <boxGeometry args={[radius * 1.4, 0.2, radius * 1.4]} />
          </mesh>
        </group>
      )}
      {style === "candi" && (
        <group position={[0, 0.9 + height, 0]}>
          <mesh castShadow material={materials.capMat}>
            <cylinderGeometry args={[radius * 1.6, radius * 1.3, 0.25, segments]} />
          </mesh>
          <mesh position={[0, 0.2, 0]} castShadow material={materials.capMat}>
            <cylinderGeometry args={[radius * 1.3, radius * 1.1, 0.2, segments]} />
          </mesh>
          <mesh position={[0, 0.38, 0]} castShadow material={materials.capMat}>
            <coneGeometry args={[radius * 0.9, 0.3, segments]} />
          </mesh>
        </group>
      )}
      {style === "kolonial" && (
        <group position={[0, 0.9 + height, 0]}>
          <mesh castShadow material={materials.capMat}>
            <cylinderGeometry args={[radius * 1.5, radius * 1.2, 0.2, segments]} />
          </mesh>
          <mesh position={[0, 0.15, 0]} castShadow material={materials.capMat}>
            <cylinderGeometry args={[radius * 1.2, radius * 1.0, 0.15, segments]} />
          </mesh>
        </group>
      )}
    </group>
  );
}
