import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useMuseumStore } from "@/store/useMuseumStore";
import type { Artifact } from "@/types/artifact";
import { DustParticles } from "./DustParticles";
import { useGraphicsPreset } from "@/hooks/useGraphicsPreset";

interface ArtifactMeshProps {
  artifact: Artifact;
  accentColor: string;
}

/**
 * Renders one artifact in the scene. Today this is always a placeholder
 * primitive (per spec section 10: "gunakan placeholder model 3D primitif
 * dulu"); once real assets exist, swap the <PlaceholderGeometry> below for
 * a `useGLTF(artifact.url_model_3d)` call — the rest of this component
 * (highlight ring, click handling, pedestal) stays the same.
 */
export function ArtifactMesh({ artifact, accentColor }: ArtifactMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const graphicsPreset = useGraphicsPreset();
  const nearbyId = useMuseumStore((s) => s.nearbyArtifact?.id);
  const focusedId = useMuseumStore((s) => s.focusedArtifact?.id);
  const focusArtifact = useMuseumStore((s) => s.focusArtifact);

  const isNearby = nearbyId === artifact.id;
  const isFocused = focusedId === artifact.id;
  const { x, y, z } = artifact.koordinat_ruangan;
  const isGarudeya = artifact.id === "r2-garudeya-emas";
  const isDurga = artifact.id === "r2-arca-durga-mahisasuramardhini";

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * (isFocused ? 0 : 0.25);
  });

  return (
    <group position={[x, 0, z]} rotation={[0, artifact.rotasi_y ?? 0, 0]}>
      {/* Pedestal */}
      <mesh position={[0, 0.5, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.55, 0.6, 1, artifact.is_ikonik ? 24 : 16]} />
        <meshStandardMaterial color={artifact.is_ikonik ? "#3a3025" : "#2a2826"} roughness={0.8} />
      </mesh>

      {/* Garudeya Showcase */}
      {isGarudeya && (
        <group position={[0, 1.1, 0]}>
          {/* Brankas kaca vitrine */}
          <mesh position={[0, 0.8, 0]} castShadow>
            <boxGeometry args={[1.4, 1.7, 1.4]} />
            <meshPhysicalMaterial
              color="#ffffff"
              transparent
              opacity={0.15}
              roughness={0.1}
              metalness={0.05}
              transmission={0.6}
              thickness={0.5}
            />
          </mesh>

          {/* Jeruji besi vertikal */}
          {[-0.5, -0.3, -0.1, 0.1, 0.3, 0.5].map((posX, i) => (
            <mesh key={`left-${i}`} position={[posX, 0.8, -0.7]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 1.7, 8]} />
              <meshStandardMaterial color="#3a332a" roughness={0.7} metalness={0.8} />
            </mesh>
          ))}
          {[-0.5, -0.3, -0.1, 0.1, 0.3, 0.5].map((posX, i) => (
            <mesh key={`right-${i}`} position={[posX, 0.8, 0.7]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 1.7, 8]} />
              <meshStandardMaterial color="#3a332a" roughness={0.7} metalness={0.8} />
            </mesh>
          ))}
          {[-0.5, -0.3, -0.1, 0.1, 0.3, 0.5].map((posZ, i) => (
            <mesh key={`front-${i}`} position={[-0.7, 0.8, posZ]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 1.7, 8]} />
              <meshStandardMaterial color="#3a332a" roughness={0.7} metalness={0.8} />
            </mesh>
          ))}
          {[-0.5, -0.3, -0.1, 0.1, 0.3, 0.5].map((posZ, i) => (
            <mesh key={`back-${i}`} position={[0.7, 0.8, posZ]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 1.7, 8]} />
              <meshStandardMaterial color="#3a332a" roughness={0.7} metalness={0.8} />
            </mesh>
          ))}

          {/* Garudeya spotlight (adjusted for brighter base) */}
          <spotLight
            position={[0, 6, 0]}
            angle={0.25}
            penumbra={0.5}
            intensity={50}
            color="#e6c76e"
            castShadow={graphicsPreset.shadowsEnabled}
            shadow-mapSize={[graphicsPreset.shadowMapSize, graphicsPreset.shadowMapSize]}
          />
        </group>
      )}

      {/* Dust particles for iconic artifacts */}
      {artifact.is_ikonik && (
        <DustParticles position={[0, 2, 0]} radius={1.2} height={5} />
      )}

      {/* Interactable ring */}
      {isNearby && !isFocused && (
        <mesh position={[0, 1.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.62, 0.72, 32]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.85} />
        </mesh>
      )}

      {/* Artifact mesh */}
      <mesh
        ref={meshRef}
        position={[0, y + 0.55, 0]}
        castShadow
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (!isFocused) focusArtifact(artifact);
        }}
      >
        <PlaceholderGeometry shape={artifact.placeholder_shape} />
        {isGarudeya ? (
          <meshPhysicalMaterial
            color="#e6c76e"
            roughness={0.15}
            metalness={0.9}
            clearcoat={0.5}
            clearcoatRoughness={0.1}
            emissive={isNearby ? "#e6c76e" : "#000000"}
            emissiveIntensity={isNearby ? 0.1 : 0}
          />
        ) : (
          <meshStandardMaterial
            color={artifact.is_ikonik ? accentColor : "#d7d3ca"}
            roughness={0.5}
            metalness={artifact.is_ikonik ? 0.35 : 0.05}
            emissive={isNearby ? accentColor : "#000000"}
            emissiveIntensity={isNearby ? 0.1 : 0}
          />
        )}
      </mesh>

      {/* Iconic spotlights: shadow-casting, since there are only a handful per room */}
      {artifact.is_ikonik && !isGarudeya && (
        <spotLight
          position={[0, 5, 0.5]}
          angle={isDurga ? 0.25 : 0.35}
          penumbra={0.6}
          intensity={isDurga ? 35 : 25}
          color={accentColor}
          castShadow={graphicsPreset.shadowsEnabled}
          shadow-mapSize={[graphicsPreset.shadowMapSize, graphicsPreset.shadowMapSize]}
        />
      )}

      {/* Every regular (non-iconic) artifact gets its own spotlight too, so the
          "disorot" pool-of-light effect isn't limited to the handful of iconic
          pieces. Shadows are deliberately left off here — a room can have a
          dozen-plus regular artifacts, and a shadow map per light is what
          actually costs frame rate; the soft pool from a shadowless spotlight
          reads just as well at this scale. */}
      {!artifact.is_ikonik && (
        <spotLight
          position={[0, 4.2, 0.3]}
          angle={0.32}
          penumbra={0.7}
          intensity={12}
          distance={6}
          decay={2}
          color="#e8c877"
          castShadow={false}
        />
      )}
    </group>
  );
}

function PlaceholderGeometry({ shape }: { shape: Artifact["placeholder_shape"] }) {
  switch (shape) {
    case "sphere":
      return <sphereGeometry args={[0.4, 24, 24]} />;
    case "cylinder":
      return <cylinderGeometry args={[0.15, 0.15, 1.1, 16]} />;
    case "cone":
      return <coneGeometry args={[0.42, 0.9, 20]} />;
    case "torus":
      return <torusGeometry args={[0.35, 0.14, 16, 32]} />;
    case "box":
    default:
      return <boxGeometry args={[0.6, 0.4, 0.6]} />;
  }
}
