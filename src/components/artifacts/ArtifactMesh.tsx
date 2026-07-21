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

const WOOD = "#7A5230";
const BRASS = "#B08D3C";
const STONE_FEATURED = "#6b5f4e";
const STONE_REGULAR = "#8a7d68";

/** Resolves the presentational tier: explicit `display_tier` wins; otherwise
 * `is_ikonik` pieces keep their old elevated look ("featured") so existing
 * data that hasn't been retiered doesn't regress to a flat regular pedestal. */
function resolveTier(artifact: Artifact): "signature" | "hero" | "featured" | "regular" {
  return artifact.display_tier ?? (artifact.is_ikonik ? "featured" : "regular");
}

function defaultPedestalHeight(tier: ReturnType<typeof resolveTier>): number {
  switch (tier) {
    case "signature":
    case "hero":
      return 0.95;
    case "featured":
      return 0.7;
    default:
      return 0.5;
  }
}

/**
 * Renders one artifact in the scene. Today this is always a placeholder
 * primitive (per spec section 10: "gunakan placeholder model 3D primitif
 * dulu"); once real assets exist, swap the <PlaceholderGeometry> below for
 * a `useGLTF(artifact.url_model_3d)` call — the rest of this component
 * (highlight ring, click handling, pedestal/vitrine/niche staging) stays
 * the same.
 *
 * Display staging (spec: "ragam pedestal & mode display", section 2b) is
 * driven by `display_tier` + `display_mode` rather than a single identical
 * black cylinder — see resolveTier/defaultPedestalHeight above. `y` in
 * `koordinat_ruangan` is authored as the artifact's literal world-space
 * center height (eye-level rule), not an offset from a fixed pedestal.
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

  const tier = resolveTier(artifact);
  const isHeroTier = tier === "signature" || tier === "hero";
  const isElevated = tier !== "regular";
  const displayMode = artifact.display_mode ?? "pedestal";
  const pedestalH = artifact.pedestal_height ?? defaultPedestalHeight(tier);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * (isFocused ? 0 : 0.25);
  });

  return (
    <group position={[x, 0, z]} rotation={[0, artifact.rotasi_y ?? 0, 0]}>
      {/* Display stand: pedestal (floor), vitrine (low glass case) or niche
          (wall ledge + backing panel) — never a flat identical black cylinder. */}
      {displayMode === "niche" ? (
        <group>
          {/* Shelf ledge the piece rests on */}
          <mesh position={[0, y - 0.3, 0.12]} castShadow receiveShadow>
            <boxGeometry args={[0.8, 0.1, 0.4]} />
            <meshStandardMaterial color={WOOD} roughness={0.8} />
          </mesh>
          {/* Backing panel — reads as a shallow wall recess behind the piece */}
          <mesh position={[0, y + 0.1, -0.32]} receiveShadow>
            <boxGeometry args={[1.1, 1.1, 0.06]} />
            <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.12} roughness={0.75} />
          </mesh>
        </group>
      ) : displayMode === "vitrine" ? (
        <group>
          <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
            <boxGeometry args={[1.0, 0.3, 1.0]} />
            <meshStandardMaterial color={WOOD} roughness={0.75} />
          </mesh>
          <mesh position={[0, 0.15 + 0.02, 0]}>
            <boxGeometry args={[1.04, 0.04, 1.04]} />
            <meshStandardMaterial color={BRASS} roughness={0.5} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[0.9, 0.5, 0.9]} />
            <meshPhysicalMaterial
              color="#ffffff"
              transparent
              opacity={0.12}
              roughness={0.08}
              metalness={0.05}
              transmission={0.7}
              thickness={0.4}
            />
          </mesh>
        </group>
      ) : isHeroTier ? (
        <group>
          {/* Two-step plinth + wood shaft — hero/signature staging */}
          <mesh position={[0, 0.11, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.9, 0.95, 0.22, 24]} />
            <meshStandardMaterial color={STONE_FEATURED} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.33, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.68, 0.75, 0.22, 24]} />
            <meshStandardMaterial color={STONE_FEATURED} roughness={0.82} />
          </mesh>
          <mesh position={[0, 0.44 + Math.max(0.1, pedestalH - 0.44) / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.5, 0.55, Math.max(0.1, pedestalH - 0.44), 24]} />
            <meshStandardMaterial color={WOOD} roughness={0.75} />
          </mesh>
          <mesh position={[0, pedestalH + 0.03, 0]} castShadow>
            <cylinderGeometry args={[0.58, 0.58, 0.06, 24]} />
            <meshStandardMaterial color={BRASS} roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      ) : tier === "featured" ? (
        <group>
          <mesh position={[0, pedestalH / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.58, 0.63, pedestalH, 20]} />
            <meshStandardMaterial color={STONE_FEATURED} roughness={0.82} />
          </mesh>
          <mesh position={[0, pedestalH + 0.025, 0]} castShadow>
            <cylinderGeometry args={[0.6, 0.6, 0.05, 20]} />
            <meshStandardMaterial color={BRASS} roughness={0.45} metalness={0.5} />
          </mesh>
        </group>
      ) : (
        <mesh position={[0, pedestalH / 2, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[0.5, 0.55, pedestalH, 16]} />
          <meshStandardMaterial color={STONE_REGULAR} roughness={0.88} />
        </mesh>
      )}

      {/* Garudeya Showcase */}
      {isGarudeya && (
        <group position={[0, pedestalH, 0]}>
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

      {/* Dust particles for hero/signature/featured pieces */}
      {isElevated && (
        <DustParticles position={[0, y + 1.4, 0]} radius={1.2} height={5} />
      )}

      {/* Interactable ring */}
      {isNearby && !isFocused && (
        <mesh position={[0, pedestalH + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.62, 0.72, 32]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.85} />
        </mesh>
      )}

      {/* Artifact mesh */}
      <mesh
        ref={meshRef}
        position={[0, y, 0]}
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
            color={isElevated ? accentColor : "#d7d3ca"}
            roughness={0.5}
            metalness={isElevated ? 0.35 : 0.05}
            emissive={isNearby ? accentColor : "#000000"}
            emissiveIntensity={isNearby ? 0.1 : 0}
          />
        )}
      </mesh>

      {/* Iconic spotlights: shadow-casting, since there are only a handful per room */}
      {isElevated && !isGarudeya && (
        <spotLight
          position={[0, y + 3.8, 0.5]}
          angle={isDurga ? 0.25 : 0.35}
          penumbra={0.6}
          intensity={isDurga ? 35 : 25}
          color={accentColor}
          castShadow={graphicsPreset.shadowsEnabled}
          shadow-mapSize={[graphicsPreset.shadowMapSize, graphicsPreset.shadowMapSize]}
        />
      )}

      {/* Every regular (non-elevated) artifact gets its own smaller, shadowless
          fill spotlight — kept deliberately dimmer than the elevated tiers above
          so the hero/featured pieces actually read as brighter focal points
          (spec section 6: focal lighting contrast), not just differently staged. */}
      {!isElevated && (
        <spotLight
          position={[0, y + 3, 0.3]}
          angle={0.32}
          penumbra={0.7}
          intensity={7}
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
