import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useMuseumStore } from "@/store/useMuseumStore";
import { hasRealModel } from "@/data/artifactRepository";
import type { Artifact } from "@/types/artifact";
import { DustParticles } from "./DustParticles";
import { useGraphicsPreset } from "@/hooks/useGraphicsPreset";
import { objectFootprintRadius } from "@/utils/artifactSize";
import { DRACO_DECODER_PATH, extendModelLoader, preloadModel } from "@/utils/modelLoader";

interface ArtifactMeshProps {
  artifact: Artifact;
  accentColor: string;
}

const WOOD = "#7A5230";
const BRASS = "#B08D3C";
const STONE_FEATURED = "#6b5f4e";
const STONE_REGULAR = "#8a7d68";

/**
 * The brass cap that finishes each pedestal profile sits ON TOP of the shaft,
 * so the surface an artifact actually rests on is the cap's top face —
 * `pedestal_height + offset + thickness / 2` — not `pedestal_height` itself.
 *
 * Getting this wrong is invisible on a 1.5 m arca and fatal on a small piece.
 * Kapak Persegi is 6.2 cm tall after auto-fit and its source pivot is centred,
 * so placed at the shaft top its highest point landed at y=1.2296 while this
 * cap's top face is at y=1.24 — the entire artifact was inside the brass disc.
 * That is what "pedestal kosong tapi hotspot hidup" actually was: the model
 * loaded and rendered correctly every time, just underneath its own stand.
 *
 * Both numbers are shared with the cap meshes below so the geometry and the
 * resting surface can never drift apart again.
 */
const PEDESTAL_CAP = {
  hero: { offset: 0.03, thickness: 0.06 },
  featured: { offset: 0.025, thickness: 0.05 },
  eyeColumn: { offset: 0.02, thickness: 0.04 },
} as const;

/** Top face of a brass cap sitting on a shaft of height `pedestalH`. */
function capTopY(pedestalH: number, cap: { offset: number; thickness: number }): number {
  return pedestalH + cap.offset + cap.thickness / 2;
}

/** Wood base of the vitrine case: box centred at y=0.15, 0.3 tall — its lid is
 * what a piece inside the case stands on. */
const VITRINE_SURFACE_Y = 0.3;

/** Niche shelf ledge: box centred at `y - 0.3`, 0.1 thick, so its top face is
 * 0.05 above that. Kept next to the mesh that draws it (see the niche branch). */
const NICHE_SHELF_DROP = 0.25;

// DRACO_DECODER_PATH now lives in utils/modelLoader.ts (shared with the
// cross-hall preloader) so every load site keys drei's cache identically —
// see that file. Re-exported locally is unnecessary; import it directly.

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
export function ArtifactMesh(props: ArtifactMeshProps) {
  // Belt-and-suspenders: artifacts still awaiting a real `.glb` are already
  // filtered out upstream (MuseumExperience.renderableArtifacts) so they never
  // reach here — but guard anyway so no future call site can accidentally
  // mount an empty pedestal / phantom `E` anchor for a modelless piece. The
  // check is outside the hook-calling body (a plain wrapper) so the early
  // return doesn't violate the Rules of Hooks.
  if (!hasRealModel(props.artifact)) return null;
  return <ArtifactMeshWithModel {...props} />;
}

function ArtifactMeshWithModel({ artifact, accentColor }: ArtifactMeshProps) {
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

  // World-space Y of the face this artifact's underside rests on. Mirrors the
  // stand branches in the JSX below one-for-one and reads the same PEDESTAL_CAP
  // constants they do, so there is exactly one definition of "the top of this
  // stand" — see PEDESTAL_CAP for why placing a model at `pedestalH` instead
  // buried the small pieces inside their own brass cap.
  const surfaceY =
    displayMode === "niche"
      ? y - NICHE_SHELF_DROP
      : displayMode === "vitrine"
        ? VITRINE_SURFACE_Y
        : isHeroTier
          ? capTopY(pedestalH, PEDESTAL_CAP.hero)
          : tier === "featured"
            ? capTopY(pedestalH, PEDESTAL_CAP.featured)
            : isEyeLevelColumn
              ? capTopY(pedestalH, PEDESTAL_CAP.eyeColumn)
              : // plain box / cylinder regular tier carries no cap
                pedestalH;

  // Grow the pedestal's own footprint when the real object (per real_world_size,
  // spec: "fix skala objek") is physically wider than the tier's default stand —
  // a 1.9m motorcycle or a 1.8m guardian statue needs more than the ~0.5-0.95m
  // radius sized for the old uniform placeholders. Never shrinks a pedestal below
  // its tier default; artifacts without real_world_size are unaffected.
  const footprintRadius = objectFootprintRadius(artifact);
  // Size the pedestal to the object's real footprint (~30% overhang margin,
  // per the "alas ~20-30% lebih lebar dari footprint objek" rule) instead of a
  // fixed tier minimum. The old `Math.max(1, …)` could only grow the stand, so
  // a slender 0.4m-wide arca sat marooned on a ~1.2m-wide drum sized for the
  // generic placeholder — the "figurine mini di alas besar" look. Now it also
  // shrinks toward the object, floored at 55% of the tier default so a stand
  // never becomes unstably tiny. Artifacts without real_world_size are
  // unaffected (keep the tier default).
  const pedestalScale = (baseRadius: number) =>
    footprintRadius ? Math.max(0.55, (footprintRadius * 1.3) / baseRadius) : 1;

  useFrame((_, delta) => {
    const spin = delta * (isFocused ? 0 : 0.25);
    if (meshRef.current) meshRef.current.rotation.y += spin;
    if (modelGroupRef.current) modelGroupRef.current.rotation.y += spin;
  });

  // Eager-load every artifact's real model as soon as its hall mounts, so the
  // arca/artefak are already there the moment the room opens — not popped in
  // only after the player walks up to each one (explicit product requirement:
  // "dari awal dibuka arca dan artefak lain harus sudah ada"). Only the active
  // hall's artifacts are mounted at a time, so this preloads one hall's set,
  // not the whole museum. (The old per-distance gate that deferred this is
  // gone; if mobile download cost becomes a concern, reintroduce it behind a
  // device/graphics-preset check rather than for every client.)
  useEffect(() => {
    preloadModel(artifact.url_model_3d);
  }, [artifact.url_model_3d]);

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
              <mesh position={[0, pedestalH + PEDESTAL_CAP.hero.offset, 0]} castShadow>
                <cylinderGeometry args={[0.58 * s, 0.58 * s, PEDESTAL_CAP.hero.thickness, 24]} />
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
              <mesh position={[0, pedestalH + PEDESTAL_CAP.featured.offset, 0]} castShadow>
                <cylinderGeometry args={[0.6 * s, 0.6 * s, PEDESTAL_CAP.featured.thickness, 20]} />
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
              <mesh position={[0, pedestalH + PEDESTAL_CAP.eyeColumn.offset, 0]} castShadow>
                <cylinderGeometry args={[0.32 * s, 0.32 * s, PEDESTAL_CAP.eyeColumn.thickness, 16]} />
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

      {/* Garudeya Showcase — deliberately WITHOUT any physical barrier.
          The glass vitrine + iron bars that used to stand here were removed on
          the designer's call: once the piece was enlarged so its detail reads
          from walking distance, caging it behind translucent geometry was the
          one thing still hiding that detail. Its "this is the signature piece"
          reading now comes entirely from non-barrier cues — the tall plinth,
          the light below, the indigo backdrop + floor medallion (RoomShell's
          GarudeyaStage) and the wide clear pocket the layout keeps around it.
          Do NOT reintroduce a cage/rail here if it ever feels under-staged;
          push the lighting and negative space instead. */}
      {isGarudeya && (
        <group position={[0, pedestalH, 0]}>
          {/* Key light. Tighter and considerably stronger than the vitrine-era
              version: the glass used to catch and scatter this light, which
              did half the work of making the corner read as special. With the
              glass gone that has to come from the beam itself, so this is now
              a hard marigold pool on the piece rather than a soft glow.
              Group already sits at pedestalH, so +4 lands ~5.45m world —
              still under the hall's 6m ceiling. */}
          <spotLight
            position={[0, 4, 0]}
            angle={0.2}
            penumbra={0.35}
            intensity={85}
            color="#E8A020"
            castShadow={graphicsPreset.shadowsEnabled}
            shadow-mapSize={[graphicsPreset.shadowMapSize, graphicsPreset.shadowMapSize]}
          />
          {/* Front fill, angled in from the approach side, so the gold reads as
              gold from where visitors actually stand instead of going to
              silhouette under a purely top-down key. Shadowless and
              short-range — one cheap light, and still a net saving versus the
              transmissive glass box this replaces. */}
          <spotLight
            position={[0, 1.5, 2.2]}
            angle={0.5}
            penumbra={0.8}
            intensity={16}
            distance={6}
            decay={2}
            color="#F0C070"
            castShadow={false}
          />
          {/* Close warm bounce at plinth level — keeps the underside of the
              artifact from going black now that nothing around it reflects. */}
          <pointLight position={[0, 0.35, 0]} intensity={4} distance={2.4} decay={2} color="#E8A020" />
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

      {/* Artifact mesh: real model once loaded (and in range), placeholder otherwise.
          The ErrorBoundary is essential: <Suspense> only catches the loading
          promise, NOT a rejection. If a `.glb` fails to decode (bad asset, missing
          Draco decoder, 404) the thrown error would otherwise propagate past this
          Suspense and unmount the whole artifact — the piece vanishes entirely
          instead of degrading to a placeholder. The boundary keeps the placeholder
          as a real fallback (spec constraint) and logs the concrete cause. */}
      {artifact.url_model_3d ? (
        <ModelErrorBoundary
          url={artifact.url_model_3d}
          fallback={
            <mesh position={[0, y, 0]}>
              <PlaceholderGeometry shape={artifact.placeholder_shape} size={artifact.real_world_size} />
              <meshStandardMaterial
                color={isElevated ? accentColor : regularArtifactColor}
                roughness={0.5}
                metalness={isElevated ? 0.35 : 0.05}
              />
            </mesh>
          }
        >
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
                surfaceY={surfaceY}
                targetSize={artifact.real_world_size}
                scale={artifact.model_scale}
                yOffset={artifact.model_y_offset}
                rotationY={artifact.model_rotation_y}
                materialOverride={artifact.material_override}
              />
            </group>
          </Suspense>
        </ModelErrorBoundary>
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

/** Catches a `.glb` load/decode failure so one bad model degrades to its
 * placeholder instead of throwing past <Suspense> and unmounting the artifact
 * (or, worse, the surrounding scene). Logs the concrete URL + error so the real
 * cause (404, missing Draco decoder, corrupt asset) is visible in the console
 * rather than manifesting only as an invisible/absent piece. */
class ModelErrorBoundary extends Component<
  { url: string; fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(`[ArtifactModel] gagal memuat "${this.props.url}" — fallback ke placeholder.`, error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
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
  surfaceY,
  targetSize,
  scale = 1,
  yOffset = 0,
  rotationY = 0,
  materialOverride,
}: {
  url: string;
  /** World Y of the face the model's base rests on — the top of the brass cap,
   * vitrine lid or niche ledge, not the pedestal shaft height. See PEDESTAL_CAP. */
  surfaceY: number;
  targetSize?: { width: number; height: number; depth: number };
  scale?: number;
  yOffset?: number;
  rotationY?: number;
  materialOverride?: Artifact["material_override"];
}) {
  const { scene } = useGLTF(url, DRACO_DECODER_PATH, true, extendModelLoader);
  useEffect(() => {
    // Dev only. This shipped ungated and produced 35 console entries per
    // session in the production build (audit 2026-08-05, P2-1) — noise that
    // buries the messages that actually matter, in the one place a museum
    // technician would look when something is wrong. The failure path below
    // (componentDidCatch) stays loud in production on purpose; success does
    // not need announcing.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info(`[ArtifactModel] ✓ termuat & ter-decode: ${url}`);
    }
  }, [url]);
  const { model, fitScale, ownedMaterials } = useMemo(() => {
    const clone = scene.clone(true);
    // Object3D.clone() shares materials with the source by reference, and the
    // source here is drei's cached GLTF — shared by every mount of this model.
    // Anything recoloured therefore has to be cloned first, and disposed on
    // unmount, or the edit leaks into the cache and into other instances.
    const owned: THREE.Material[] = [];
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (!materialOverride) return;
      const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const recoloured = sources.map((source) => {
        const copy = source.clone();
        if ("color" in copy) (copy as THREE.MeshStandardMaterial).color.set(materialOverride.color);
        if (materialOverride.metalness !== undefined && "metalness" in copy) {
          (copy as THREE.MeshStandardMaterial).metalness = materialOverride.metalness;
        }
        if (materialOverride.roughness !== undefined && "roughness" in copy) {
          (copy as THREE.MeshStandardMaterial).roughness = materialOverride.roughness;
        }
        owned.push(copy);
        return copy;
      });
      mesh.material = Array.isArray(mesh.material) ? recoloured : recoloured[0];
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
    return { model: clone, fitScale: fit, ownedMaterials: owned };
  }, [scene, targetSize, materialOverride]);

  useEffect(() => () => ownedMaterials.forEach((m) => m.dispose()), [ownedMaterials]);

  return (
    <primitive
      object={model}
      position={[0, surfaceY + yOffset, 0]}
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
