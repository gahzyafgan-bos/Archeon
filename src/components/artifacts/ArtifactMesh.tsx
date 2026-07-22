import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useMuseumStore } from "@/store/useMuseumStore";
import type { Artifact } from "@/types/artifact";
import { DustParticles } from "./DustParticles";
import { useGraphicsPreset } from "@/hooks/useGraphicsPreset";
import { objectFootprintRadius } from "@/utils/artifactSize";

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

/** Stable (non-random) hash so the same artifact always picks the same
 * regular-tier pedestal variant across renders/reloads. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Renders one artifact in the scene. Artifacts with a real `.glb` (per spec
 * section 10, `artifact.url_model_3d`) render via `RealArtifactModel`;
 * everything else still falls back to `<PlaceholderGeometry>` so batches
 * without an asset yet keep working. The rest of this component (highlight
 * ring, click handling, pedestal/vitrine/niche staging) stays the same for both.
 *
 * Display staging (spec: "ragam pedestal & mode display", section 2b) is
 * driven by `display_tier` + `display_mode` rather than a single identical
 * black cylinder — see resolveTier/defaultPedestalHeight above. `y` in
 * `koordinat_ruangan` is authored as the artifact's literal world-space
 * center height (eye-level rule), not an offset from a fixed pedestal.
 */
export function ArtifactMesh({ artifact, accentColor }: ArtifactMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const modelGroupRef = useRef<THREE.Group>(null);
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

  // Regular tier is 69% of the collection and used to be one universal
  // gray pedestal + one universal flat artifact color everywhere in the
  // museum — the real driver of the "monoton" complaint, more than spacing.
  // Tint both with the zone's own accent so each zone reads distinctly, and
  // alternate the pedestal profile (deterministically, not randomly) so
  // regular pieces aren't all the same silhouette either.
  const regularStoneColor = useMemo(
    () => new THREE.Color(STONE_REGULAR).lerp(new THREE.Color(accentColor), 0.15).getStyle(),
    [accentColor]
  );
  const regularArtifactColor = useMemo(
    () => new THREE.Color("#d7d3ca").lerp(new THREE.Color(accentColor), 0.15).getStyle(),
    [accentColor]
  );
  const useAltRegularProfile = tier === "regular" && hashId(artifact.id) % 2 === 0;
  // Small, valuable regular-tier pieces get lifted to eye level (spec 2c)
  // via a taller pedestal_height in the data — render those as a slender
  // museum plinth instead of the squat drum lower pieces use.
  const isEyeLevelColumn = tier === "regular" && pedestalH >= 1.0;

  // Grow the pedestal's own footprint when the real object (per real_world_size,
  // spec: "fix skala objek") is physically wider than the tier's default stand —
  // a 1.9m motorcycle or a 1.8m guardian statue needs more than the ~0.5-0.95m
  // radius sized for the old uniform placeholders. Never shrinks a pedestal below
  // its tier default; artifacts without real_world_size are unaffected.
  const footprintRadius = objectFootprintRadius(artifact);
  const pedestalScale = (baseRadius: number) => (footprintRadius ? Math.max(1, footprintRadius / baseRadius) : 1);

  // Preload the real model as soon as this artifact mounts (rooms mount all
  // their artifacts up front), so there's no hitch the first time the
  // player walks up and it needs to actually appear.
  useEffect(() => {
    if (artifact.url_model_3d) {
      useGLTF.preload(artifact.url_model_3d);
    }
  }, [artifact.url_model_3d]);

  useFrame((_, delta) => {
    const spin = delta * (isFocused ? 0 : 0.25);
    if (meshRef.current) meshRef.current.rotation.y += spin;
    if (modelGroupRef.current) modelGroupRef.current.rotation.y += spin;
  });

  return (
    <group position={[x, 0, z]} rotation={[0, artifact.rotasi_y ?? 0, 0]}>
      {/* Display stand: pedestal (floor), vitrine (low glass case) or niche
          (wall ledge + backing panel) — never a flat identical black cylinder. */}
      {displayMode === "niche" ? (
        (() => {
          // Shelf/backing grow with the real panel's width/height (spec: pedestal
          // proportional to the object) but never shrink below the old fixed size.
          const size = artifact.real_world_size;
          const shelfW = Math.max(0.8, (size?.width ?? 0) + 0.3);
          const backingW = Math.max(1.1, (size?.width ?? 0) + 0.3);
          const backingH = Math.max(1.1, (size?.height ?? 0) + 0.3);
          return (
            <group>
              {/* Shelf ledge the piece rests on */}
              <mesh position={[0, y - 0.3, 0.12]} castShadow receiveShadow>
                <boxGeometry args={[shelfW, 0.1, 0.4]} />
                <meshStandardMaterial color={WOOD} roughness={0.8} />
              </mesh>
              {/* Backing panel — reads as a shallow wall recess behind the piece */}
              <mesh position={[0, y + 0.1, -0.32]} receiveShadow>
                <boxGeometry args={[backingW, backingH, 0.06]} />
                <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.12} roughness={0.75} />
              </mesh>
            </group>
          );
        })()
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
        (() => {
          const s = pedestalScale(0.95);
          return (
            <group>
              {/* Two-step plinth + wood shaft — hero/signature staging */}
              <mesh position={[0, 0.11, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.9 * s, 0.95 * s, 0.22, 24]} />
                <meshStandardMaterial color={STONE_FEATURED} roughness={0.85} />
              </mesh>
              <mesh position={[0, 0.33, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.68 * s, 0.75 * s, 0.22, 24]} />
                <meshStandardMaterial color={STONE_FEATURED} roughness={0.82} />
              </mesh>
              <mesh position={[0, 0.44 + Math.max(0.1, pedestalH - 0.44) / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.5 * s, 0.55 * s, Math.max(0.1, pedestalH - 0.44), 24]} />
                <meshStandardMaterial color={WOOD} roughness={0.75} />
              </mesh>
              <mesh position={[0, pedestalH + 0.03, 0]} castShadow>
                <cylinderGeometry args={[0.58 * s, 0.58 * s, 0.06, 24]} />
                <meshStandardMaterial color={BRASS} roughness={0.4} metalness={0.6} />
              </mesh>
            </group>
          );
        })()
      ) : tier === "featured" ? (
        (() => {
          const s = pedestalScale(0.63);
          return (
            <group>
              <mesh position={[0, pedestalH / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.58 * s, 0.63 * s, pedestalH, 20]} />
                <meshStandardMaterial color={STONE_FEATURED} roughness={0.82} />
              </mesh>
              <mesh position={[0, pedestalH + 0.025, 0]} castShadow>
                <cylinderGeometry args={[0.6 * s, 0.6 * s, 0.05, 20]} />
                <meshStandardMaterial color={BRASS} roughness={0.45} metalness={0.5} />
              </mesh>
            </group>
          );
        })()
      ) : isEyeLevelColumn ? (
        (() => {
          const s = pedestalScale(0.34);
          return (
            <group>
              <mesh position={[0, pedestalH / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.28 * s, 0.34 * s, pedestalH, 16]} />
                <meshStandardMaterial color={regularStoneColor} roughness={0.85} />
              </mesh>
              <mesh position={[0, pedestalH + 0.02, 0]} castShadow>
                <cylinderGeometry args={[0.32 * s, 0.32 * s, 0.04, 16]} />
                <meshStandardMaterial color={BRASS} roughness={0.45} metalness={0.5} />
              </mesh>
            </group>
          );
        })()
      ) : useAltRegularProfile ? (
        <mesh position={[0, pedestalH / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.95 * pedestalScale(0.475), pedestalH, 0.95 * pedestalScale(0.475)]} />
          <meshStandardMaterial color={regularStoneColor} roughness={0.9} />
        </mesh>
      ) : (
        <mesh position={[0, pedestalH / 2, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[0.5 * pedestalScale(0.55), 0.55 * pedestalScale(0.55), pedestalH, 16]} />
          <meshStandardMaterial color={regularStoneColor} roughness={0.88} />
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

      {/* Dust particles for hero/signature/featured pieces — off at Rendah,
          additive-blended overdraw is real GPU cost on mobile (spec 4b.3). */}
      {isElevated && graphicsPreset.dustParticlesEnabled && (
        <DustParticles position={[0, y + 1.4, 0]} radius={1.2} height={5} />
      )}

      {/* Interactable ring */}
      {isNearby && !isFocused && (
        <mesh position={[0, pedestalH + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.62, 0.72, 32]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.85} />
        </mesh>
      )}

      {/* Artifact mesh: real model when the asset has arrived, placeholder otherwise */}
      {artifact.url_model_3d ? (
        <Suspense
          fallback={
            <mesh position={[0, y, 0]}>
              <PlaceholderGeometry shape={artifact.placeholder_shape} size={artifact.real_world_size} />
              <meshStandardMaterial
                color={isElevated ? accentColor : regularArtifactColor}
                roughness={0.5}
                metalness={isElevated ? 0.35 : 0.05}
                transparent
                opacity={0.35}
              />
            </mesh>
          }
        >
          <group
            ref={modelGroupRef}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              if (!isFocused) focusArtifact(artifact);
            }}
          >
            <RealArtifactModel
              url={artifact.url_model_3d}
              pedestalHeight={pedestalH}
              targetSize={artifact.real_world_size}
              scale={artifact.model_scale}
              yOffset={artifact.model_y_offset}
              rotationY={artifact.model_rotation_y}
            />
          </group>
        </Suspense>
      ) : (
        <mesh
          ref={meshRef}
          position={[0, y, 0]}
          castShadow
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            if (!isFocused) focusArtifact(artifact);
          }}
        >
          <PlaceholderGeometry shape={artifact.placeholder_shape} size={artifact.real_world_size} />
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
              color={isElevated ? accentColor : regularArtifactColor}
              roughness={0.5}
              metalness={isElevated ? 0.35 : 0.05}
              emissive={isNearby ? accentColor : "#000000"}
              emissiveIntensity={isNearby ? 0.1 : 0}
            />
          )}
        </mesh>
      )}

      {/* Iconic spotlights: shadow-casting, since there are only a handful per
          room. Hero tier gets the brightest/tightest pool of light of the
          non-signature pieces — the actual "focal lighting" contrast (spec
          section 6) that makes each zone's hero read as the brightest thing
          in the room, featured pieces a notch down, everything else dimmer
          still (see the shadowless regular spotlight below). */}
      {isElevated && !isGarudeya && (
        <spotLight
          position={[0, y + 3.8, 0.5]}
          angle={isHeroTier ? 0.22 : isDurga ? 0.25 : 0.32}
          penumbra={0.55}
          intensity={isHeroTier ? 42 : isDurga ? 35 : 25}
          color={accentColor}
          castShadow={graphicsPreset.shadowsEnabled}
          shadow-mapSize={[graphicsPreset.shadowMapSize, graphicsPreset.shadowMapSize]}
        />
      )}

      {/* Every regular (non-elevated) artifact gets its own smaller, shadowless
          fill spotlight — kept deliberately dimmer than the elevated tiers above
          so the hero/featured pieces actually read as brighter focal points
          (spec section 6: focal lighting contrast), not just differently staged.
          Gated off at Rendah (spec 4b.4: "batasi jumlah real light di
          mobile") — with 15-19 artifacts mounted per hall at once this was
          15-19 extra always-on lights every material in the scene gets
          shaded against, by far the biggest real-light cost in the app.
          The isNearby emissive tint above still gives regular pieces a cue
          when approached, just not a dedicated dynamic light. */}
      {!isElevated && graphicsPreset.perArtifactFillLights && (
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

/** Loads a real Draco-compressed `.glb` (asset standard: 1 unit = 1 meter,
 * pivot at the object's base) and places it directly on top of the
 * pedestal/vitrine/niche shelf it's staged on, mirroring where a
 * placeholder's base would sit.
 *
 * The model is auto-fit to `targetSize` (`real_world_size`) by measuring its
 * own bounding box and uniformly scaling so its largest dimension matches the
 * real object's largest dimension — this is what actually fixes "sepeda
 * kelihatan kayak mainan" regardless of whatever scale the artist happened to
 * author the source file at, rather than requiring a hand-tuned modelScale
 * per asset. `scale`/`yOffset`/`rotationY` are per-artifact escape hatches on
 * top of that auto-fit, for assets that still need fine-tuning. */
function RealArtifactModel({
  url,
  pedestalHeight,
  targetSize,
  scale = 1,
  yOffset = 0,
  rotationY = 0,
}: {
  url: string;
  pedestalHeight: number;
  targetSize?: { width: number; height: number; depth: number };
  scale?: number;
  yOffset?: number;
  rotationY?: number;
}) {
  const { scene } = useGLTF(url);
  const { model, fitScale } = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    let fit = 1;
    if (targetSize) {
      const box = new THREE.Box3().setFromObject(clone);
      const modelSize = new THREE.Vector3();
      box.getSize(modelSize);
      const modelMax = Math.max(modelSize.x, modelSize.y, modelSize.z, 0.001);
      const targetMax = Math.max(targetSize.width, targetSize.height, targetSize.depth);
      fit = targetMax / modelMax;
    }
    return { model: clone, fitScale: fit };
  }, [scene, targetSize]);

  return (
    <primitive
      object={model}
      position={[0, pedestalHeight + yOffset, 0]}
      rotation={[0, rotationY, 0]}
      scale={fitScale * scale}
    />
  );
}

/** Placeholder dimensions derive from `real_world_size` (spec: "fix skala objek
 * & artefak" — one universal box/cylinder/cone size regardless of what the
 * artifact actually is was the root cause of things like Garudeya Emas
 * rendering bigger than the bicycles). Falls back to the old fixed sizes for
 * any artifact that doesn't have real_world_size yet. */
function PlaceholderGeometry({
  shape,
  size,
}: {
  shape: Artifact["placeholder_shape"];
  size?: { width: number; height: number; depth: number };
}) {
  if (!size) {
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

  const { width, height, depth } = size;
  switch (shape) {
    case "sphere": {
      const radius = Math.max(width, height, depth) / 2;
      return <sphereGeometry args={[radius, 24, 24]} />;
    }
    case "cylinder": {
      const radius = Math.max(width, depth) / 2;
      return <cylinderGeometry args={[radius, radius, height, 16]} />;
    }
    case "cone": {
      const radius = Math.max(width, depth) / 2;
      return <coneGeometry args={[radius, height, 20]} />;
    }
    case "torus": {
      const radius = (Math.max(width, depth) / 2) * 0.75;
      const tube = Math.max(height / 3, radius * 0.25);
      return <torusGeometry args={[radius, tube, 16, 32]} />;
    }
    case "box":
    default:
      return <boxGeometry args={[width, height, depth]} />;
  }
}
