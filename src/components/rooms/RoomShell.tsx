import { ReactNode, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Instances, Instance, Html } from "@react-three/drei";
import * as THREE from "three";
import type { RoomConfig, RoomBounds, Door, ZoneConfig } from "@/data/roomConfig";
import { ARCHWAY_WIDTH, ARCHWAY_HEIGHT, ROOM_CONFIGS } from "@/data/roomConfig";
import type { Artifact, ZoneId } from "@/types/artifact";
import { ArtifactMesh } from "@/components/artifacts/ArtifactMesh";
import { Dwarapala } from "@/components/artifacts/Dwarapala";
import { Pillar } from "@/components/architecture/Pillar";
import { HangingLamp } from "@/components/architecture/HangingLamp";
import { HangingBanner } from "@/components/architecture/HangingBanner";
import { PottedPlant } from "@/components/architecture/PottedPlant";
import { HallColonnade, HallBenches, type ColonnadeExclusion } from "@/components/architecture/HallEdgeDecor";
import { CenterInstallation } from "@/components/architecture/CenterInstallation";
import { FloorPath } from "@/components/architecture/FloorPath";
import { ZoneFloorMotif } from "@/components/architecture/ZoneFloorMotif";
import { ZoneSignboard } from "@/components/architecture/ZoneSignboard";
import { createBatikPattern } from "@/utils/batikPatterns";
import { useGraphicsPreset } from "@/hooks/useGraphicsPreset";
import { buildPlacedObjects, validatePlacement, FOOTPRINT } from "@/utils/placementValidator";
import { objectFootprintRadius } from "@/utils/artifactSize";

const WALL_THICKNESS = 0.3;
const WOOD_COLOR = "#7A5230";
// Hero-framing pillar geometry (see the heroFocus block below) — kept as
// named constants because placementValidator.ts mirrors this exact formula
// and must stay in lockstep.
const HERO_FRAME_FORWARD = 1.6;
const HERO_FRAME_PERP = 1.8;
// Above this distance from the nearest perimeter wall, a hero-framing pillar
// pair no longer reads as "framing a wall-staged hero" — it reads as two
// stray columns in open floor. See distanceToNearestWall's call site below.
const HERO_FRAME_MAX_WALL_DIST = 5;

interface RoomShellProps {
  room: RoomConfig;
  artifacts: Artifact[];
  children?: ReactNode;
}

/** Which perimeter wall (if any) a door's position sits on — only Z-facing
 * archways exist in this layout (Hall 1 <-> Hall 2), so X walls are always solid. */
function findGapDoor(doors: Door[], wallZ: number): Door | null {
  return doors.find((d) => Math.abs(d.position.z - wallZ) < 2) ?? null;
}

/** A perimeter wall running along X at a fixed Z — solid, or split around an
 * open archway (no door leaf) when a door record sits on this wall. */
function ZWall({
  z,
  minX,
  maxX,
  wallHeight,
  color,
  gapDoor,
}: {
  z: number;
  minX: number;
  maxX: number;
  wallHeight: number;
  color: string;
  gapDoor: Door | null;
}) {
  if (!gapDoor) {
    return (
      <mesh position={[(minX + maxX) / 2, wallHeight / 2, z]} receiveShadow>
        <boxGeometry args={[maxX - minX, wallHeight, WALL_THICKNESS]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    );
  }

  const gapHalf = ARCHWAY_WIDTH / 2;
  const leftWidth = gapDoor.position.x - gapHalf - minX;
  const rightWidth = maxX - (gapDoor.position.x + gapHalf);

  return (
    <group>
      {leftWidth > 0.2 && (
        <mesh position={[minX + leftWidth / 2, wallHeight / 2, z]} receiveShadow>
          <boxGeometry args={[leftWidth, wallHeight, WALL_THICKNESS]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
      )}
      {rightWidth > 0.2 && (
        <mesh position={[maxX - rightWidth / 2, wallHeight / 2, z]} receiveShadow>
          <boxGeometry args={[rightWidth, wallHeight, WALL_THICKNESS]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
      )}
      {/* Lintel above the opening */}
      <mesh position={[gapDoor.position.x, ARCHWAY_HEIGHT + (wallHeight - ARCHWAY_HEIGHT) / 2, z]}>
        <boxGeometry args={[ARCHWAY_WIDTH + 0.6, Math.max(0.1, wallHeight - ARCHWAY_HEIGHT), WALL_THICKNESS]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Decorative candi/joglo-style frame — no door leaf, purely an open threshold */}
      <mesh position={[gapDoor.position.x - gapHalf - 0.2, ARCHWAY_HEIGHT / 2, z]} castShadow>
        <boxGeometry args={[0.4, ARCHWAY_HEIGHT, 0.5]} />
        <meshStandardMaterial color={WOOD_COLOR} roughness={0.7} />
      </mesh>
      <mesh position={[gapDoor.position.x + gapHalf + 0.2, ARCHWAY_HEIGHT / 2, z]} castShadow>
        <boxGeometry args={[0.4, ARCHWAY_HEIGHT, 0.5]} />
        <meshStandardMaterial color={WOOD_COLOR} roughness={0.7} />
      </mesh>
      <mesh position={[gapDoor.position.x, ARCHWAY_HEIGHT + 0.25, z]} castShadow>
        <boxGeometry args={[ARCHWAY_WIDTH + 0.8, 0.5, 0.5]} />
        <meshStandardMaterial color={WOOD_COLOR} roughness={0.7} />
      </mesh>
    </group>
  );
}

/** Which of the 4 perimeter walls a point sits closest to — used to plant
 * each zone's hero backdrop panel against whichever wall it's actually near,
 * without hardcoding "west wall" vs "east wall" per zone. */
function nearestWallFor(
  point: { x: number; z: number },
  bounds: RoomBounds
): { axis: "x" | "z"; coord: number; faceSign: 1 | -1 } {
  const dMinX = point.x - bounds.minX;
  const dMaxX = bounds.maxX - point.x;
  const dMinZ = point.z - bounds.minZ;
  const dMaxZ = bounds.maxZ - point.z;
  const closest = Math.min(dMinX, dMaxX, dMinZ, dMaxZ);
  if (closest === dMinX) return { axis: "x", coord: bounds.minX + 0.15, faceSign: 1 };
  if (closest === dMaxX) return { axis: "x", coord: bounds.maxX - 0.15, faceSign: -1 };
  if (closest === dMinZ) return { axis: "z", coord: bounds.minZ + 0.15, faceSign: 1 };
  return { axis: "z", coord: bounds.maxZ - 0.15, faceSign: -1 };
}

/** Raw distance from a point to the nearest perimeter wall — used to decide
 * whether a candidate "hero-framing" pillar pair actually reads as framing
 * (close to the wall the hero itself is staged against) or as two stray
 * columns floating in open floor (single-zone halls, where "between zone
 * center and hero" can land further from any wall than the hero itself). */
function distanceToNearestWall(point: { x: number; z: number }, bounds: RoomBounds): number {
  return Math.min(
    point.x - bounds.minX,
    bounds.maxX - point.x,
    point.z - bounds.minZ,
    bounds.maxZ - point.z
  );
}

/**
 * Wood-framed batik backdrop planted directly behind a zone's hero artifact
 * (spec section 2b "latar/backdrop kontras" + section 1 "terminating vista"
 * closed off by something, not a bare wall). Sized to read at a glance, not
 * to fill the whole wall — this is staging for one piece, not a mural.
 */
function HeroBackdrop({
  wallAxis,
  wallCoord,
  faceSign,
  along,
  accent,
}: {
  wallAxis: "x" | "z";
  wallCoord: number;
  faceSign: 1 | -1;
  along: number;
  accent: string;
}) {
  const texture = useMemo(() => createBatikPattern("kawung", "#EDE0C4", accent, 128), [accent]);
  const width = 3;
  const height = 4.2;
  const centerY = 0.4 + height / 2;
  const framePos: [number, number, number] = wallAxis === "x" ? [wallCoord, centerY, along] : [along, centerY, wallCoord];
  const facePos: [number, number, number] =
    wallAxis === "x" ? [wallCoord + faceSign * 0.07, centerY, along] : [along, centerY, wallCoord + faceSign * 0.07];
  const frameArgs: [number, number, number] = wallAxis === "x" ? [0.14, height, width] : [width, height, 0.14];
  const faceArgs: [number, number, number] =
    wallAxis === "x" ? [0.02, height - 0.4, width - 0.4] : [width - 0.4, height - 0.4, 0.02];
  return (
    <group>
      <mesh position={framePos} receiveShadow>
        <boxGeometry args={frameArgs} />
        <meshStandardMaterial color={WOOD_COLOR} roughness={0.8} />
      </mesh>
      <mesh position={facePos}>
        <boxGeometry args={faceArgs} />
        <meshStandardMaterial map={texture} emissive={accent} emissiveIntensity={0.1} roughness={0.55} />
      </mesh>
    </group>
  );
}

/**
 * Reinforces an archway as a passage rather than a dead-end wall (spec:
 * "gerbang tertutup hiasan" fix — bingkai gerbangnya, jangan tutup
 * gerbangnya). Only one hall is ever mounted at a time (spec: lazy-load),
 * so the target hall's actual geometry can't literally be visible beyond
 * the opening — these are cheap stand-ins for that glimpse instead: a
 * peek floor strip and spill light tinted with the destination's own
 * palette (so it reads as "a different space", not just more of this
 * hall), plus a small destination label above the lintel.
 */
function ArchwayGlimpse({ door, wallZ, outwardSign }: { door: Door; wallZ: number; outwardSign: 1 | -1 }) {
  const target = ROOM_CONFIGS[door.targetRoom];
  const targetLabel = target.zones[0]?.label ?? target.name;
  const peekDepth = 2.4;
  const peekZ = wallZ + outwardSign * (peekDepth / 2 + 0.05);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[door.position.x, 0.01, peekZ]} receiveShadow>
        <planeGeometry args={[ARCHWAY_WIDTH - 0.6, peekDepth]} />
        <meshStandardMaterial
          color={target.floorColor}
          emissive={target.accentColor}
          emissiveIntensity={0.25}
          roughness={0.6}
        />
      </mesh>
      <pointLight
        position={[door.position.x, 2.4, wallZ + outwardSign * 1.6]}
        intensity={7}
        distance={9}
        decay={2}
        color={target.accentColor}
      />
      <Html position={[door.position.x, ARCHWAY_HEIGHT + 0.55, wallZ]} center distanceFactor={10} occlude={false}>
        <div
          className="rounded-full px-3 py-1 text-center whitespace-nowrap pointer-events-none"
          style={{
            background: "rgba(30, 24, 16, 0.68)",
            border: `1px solid ${target.accentColor}`,
            color: "#F2E9D8",
            fontSize: "11px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Menuju {targetLabel} →
        </div>
      </Html>
    </group>
  );
}

export function RoomShell({ room, artifacts, children }: RoomShellProps) {
  const { minX, maxX, minZ, maxZ } = room.bounds;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const wallHeight = room.ceilingHeight ?? 7;
  const { scene } = useThree();
  const graphicsPreset = useGraphicsPreset();

  useMemo(() => {
    // Warm, light fog matching the Batik Modern base palette — closes off
    // the far end of the (now much bigger) hall cheaply instead of rendering
    // full detail all the way to the walls. Rendah tints it a shade warmer —
    // cheap stand-in for the saturation the (now-disabled) color-grading
    // composer would otherwise add, so the hall doesn't read as gersang/pucat.
    scene.fog = new THREE.FogExp2(graphicsPreset.postProcessingEnabled ? "#E4D5B7" : "#E8D0A0", 0.018);
    return () => {
      scene.fog = null;
    };
  }, [scene, graphicsPreset.postProcessingEnabled]);

  // Dev-only placement sanity check — runs once whenever this hall (re)mounts
  // or its artifact list changes, never per frame. Warns in the console about
  // any two objects (artifacts + procedural decor) whose footprints overlap,
  // so a numpuk/tembus regression like the Dwarapala-vs-Durga one shows up
  // immediately instead of needing a manual screenshot audit.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    validatePlacement(room.name, buildPlacedObjects(room, artifacts));
  }, [room, artifacts]);

  const zoneAccentById = useMemo(() => {
    const map: Partial<Record<ZoneId, string>> = {};
    for (const zone of room.zones) map[zone.id] = zone.accent;
    return map;
  }, [room.zones]);

  const gapDoorMinZ = findGapDoor(room.doors, minZ);
  const gapDoorMaxZ = findGapDoor(room.doors, maxZ);

  // Colonnade pillar slots to skip — a pillar landing on top of a hero's
  // framing/backdrop or a wall-flush niche piece reads as clutter, not
  // architecture (see HallColonnade's own doc comment). Mirrors the potted
  // plant positions below too, so those don't get clipped by an adjacent
  // pillar either.
  const colonnadeExclusions = useMemo<ColonnadeExclusion[]>(() => {
    const points: ColonnadeExclusion[] = [];
    for (const zone of room.zones) {
      if (zone.heroFocus) points.push({ x: zone.heroFocus.x, z: zone.heroFocus.z, dist: 2.3 });
    }
    for (const artifact of artifacts) {
      if (artifact.display_mode === "niche") {
        const r = objectFootprintRadius(artifact) ?? FOOTPRINT.artifactNiche;
        points.push({ x: artifact.koordinat_ruangan.x, z: artifact.koordinat_ruangan.z, dist: r + 1.0 });
      }
    }
    const plantPts: Array<{ x: number; z: number }> = [
      { x: minX + 1.6, z: centerZ - depth * 0.28 },
      { x: maxX - 1.6, z: centerZ + depth * 0.28 },
      { x: minX + 1.6, z: centerZ + depth * 0.28 },
    ];
    for (const p of plantPts) points.push({ x: p.x, z: p.z, dist: 1.45 });
    return points;
  }, [room.zones, artifacts, minX, maxX, centerZ, depth]);

  // Floor border batik motif — one per hall for a bit of variety, tinted with
  // the hall's own accent rather than any single zone's.
  const floorBorderTexture = useMemo(
    () => createBatikPattern(room.id === "hall-1" ? "kawung" : "artDeco", "#EDE0C4", room.accentColor),
    [room.id, room.accentColor]
  );

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0, centerZ]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshPhysicalMaterial color={room.floorColor} roughness={0.55} clearcoat={0.25} clearcoatRoughness={0.25} />
      </mesh>
      {/* Floor border, subtle batik trim along the long walls only (keeps it
          from fighting with the zone floor motifs near the short walls/archway) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0.01, minZ + 1.2]} receiveShadow>
        <planeGeometry args={[width - 2, 1.6]} />
        <meshStandardMaterial map={floorBorderTexture} roughness={0.8} transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0.01, maxZ - 1.2]} receiveShadow>
        <planeGeometry args={[width - 2, 1.6]} />
        <meshStandardMaterial map={floorBorderTexture} roughness={0.8} transparent opacity={0.5} />
      </mesh>

      {/* Zone floor motifs — the main way zones read as distinct without a wall in sight */}
      {room.zones.map((zone) => (
        <ZoneFloorMotif key={zone.id} zone={zone} />
      ))}
      <FloorPath room={room} />

      {/* Ceiling: joglo beam grid, consistent style across both halls.
          Instanced (2 draw calls total instead of one mesh per beam) —
          every beam-x shares one box geometry/material, every beam-z
          shares another, only position differs (spec 4b.2: "merge geometry
          statik... elemen arsitektur"). */}
      <group position={[0, wallHeight, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[centerX, 0, centerZ]}>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color="#5a4a38" roughness={0.92} />
        </mesh>
        {/* castShadow off: a directional key light through a full grid of
            these casts a hard diagonal lattice across the whole floor
            (spec: "hilangkan bayangan atap/hiasan langit-langit"). */}
        <Instances limit={Math.ceil(depth / 5) + 1} frustumCulled={false} frames={1}>
          <boxGeometry args={[width - 2, 0.3, 0.3]} />
          <meshStandardMaterial color={WOOD_COLOR} roughness={0.85} />
          {Array.from({ length: Math.ceil(depth / 5) }).map((_, i) => {
            const zPos = minZ + 2.5 + i * 5;
            if (zPos > maxZ - 2) return null;
            return <Instance key={`beam-x-${i}`} position={[centerX, -0.2, zPos]} />;
          })}
        </Instances>
        <Instances limit={Math.ceil(width / 5) + 1} frustumCulled={false} frames={1}>
          <boxGeometry args={[0.3, 0.3, depth - 2]} />
          <meshStandardMaterial color={WOOD_COLOR} roughness={0.85} />
          {Array.from({ length: Math.ceil(width / 5) }).map((_, i) => {
            const xPos = minX + 2.5 + i * 5;
            if (xPos > maxX - 2) return null;
            return <Instance key={`beam-z-${i}`} position={[xPos, -0.2, centerZ]} />;
          })}
        </Instances>
      </group>

      {/* Perimeter walls — collision-relevant sides only; no internal walls between zones */}
      <ZWall z={minZ} minX={minX} maxX={maxX} wallHeight={wallHeight} color={room.wallColor} gapDoor={gapDoorMinZ} />
      <ZWall z={maxZ} minX={minX} maxX={maxX} wallHeight={wallHeight} color={room.wallColor} gapDoor={gapDoorMaxZ} />
      <mesh position={[minX, wallHeight / 2, centerZ]} receiveShadow>
        <boxGeometry args={[WALL_THICKNESS, wallHeight, depth]} />
        <meshStandardMaterial color={room.wallColor} roughness={0.88} />
      </mesh>
      <mesh position={[maxX, wallHeight / 2, centerZ]} receiveShadow>
        <boxGeometry args={[WALL_THICKNESS, wallHeight, depth]} />
        <meshStandardMaterial color={room.wallColor} roughness={0.88} />
      </mesh>

      {/* Lighting System — ambient/hemisphere are now just a soft fill floor
          (no direction, so on their own they flatten everything to the same
          brightness); a single directional key light is the actual source of
          form/shadow, mimicking sun coming through the joglo roof. Kept low
          enough that highlights don't clip to white at exposure 0.95 (see
          MuseumExperience) but still leaves visible tonal range top-to-bottom. */}
      {/* Rendah nudges these up slightly — cheap compensation for the
          disabled color-grading composer (BrightnessContrast/HueSaturation),
          so the hall doesn't read flatter/paler than Sedang/Tinggi. */}
      <ambientLight intensity={graphicsPreset.postProcessingEnabled ? 0.4 : 0.46} color="#FFF6E6" />
      <hemisphereLight args={["#FFF6E6", "#C9B48A", graphicsPreset.postProcessingEnabled ? 0.42 : 0.48]} />
      {graphicsPreset.shadowsEnabled ? (
        <directionalLight
          position={[centerX + width * 0.18, wallHeight + 6, centerZ + depth * 0.22]}
          intensity={1.4}
          color="#FFDFA6"
          castShadow
          shadow-mapSize={[graphicsPreset.shadowMapSize, graphicsPreset.shadowMapSize]}
          shadow-camera-left={-width / 2 - 2}
          shadow-camera-right={width / 2 + 2}
          shadow-camera-top={depth / 2 + 2}
          shadow-camera-bottom={-depth / 2 - 2}
          shadow-camera-near={0.5}
          shadow-camera-far={wallHeight + 24}
          shadow-bias={-0.0005}
        />
      ) : (
        <directionalLight
          position={[centerX + width * 0.18, wallHeight + 6, centerZ + depth * 0.22]}
          intensity={1.4}
          color="#FFDFA6"
        />
      )}
      {/* Accent fill lights — one per collection zone, tinted with that
          zone's own accent (spec 2b "warna cahaya per zona": prasejarah
          warmer/terracotta, hindu-buddha indigo) instead of a single fixed
          hall-wide amber, so the light itself reads as a zone-identity cue
          on top of the floor motif/signage. Count still follows graphics
          quality (spec 4b "jumlah spotLight aksen"). */}
      {room.zones
        .filter((z) => z.id !== "welcome")
        .slice(0, graphicsPreset.accentLightCount)
        .map((zone) => (
          <pointLight
            key={zone.id}
            position={[zone.center.x, 4.5, zone.center.z]}
            intensity={8}
            distance={14}
            decay={2}
            color={zone.accent}
          />
        ))}

      {/* Contact shadows: the cheap, always-on way to "ground" every object —
          a single baked-once (frames=1, nothing here moves) shadow plane
          under the whole hall floor, resolution scaling with graphics quality. */}
      <ContactShadows
        // Re-key on artifact count: frames=1 bakes once and stops, so this
        // forces one fresh bake after the (async-loaded) artifacts actually
        // mount instead of baking an empty floor on first render.
        key={`contact-shadows-${artifacts.length}`}
        position={[centerX, 0.015, centerZ]}
        opacity={0.45}
        scale={[width, depth]}
        blur={2.2}
        far={6}
        resolution={graphicsPreset.contactShadowResolution}
        color="#2a2015"
        frames={1}
      />

      {/* Soft indoor env map — improves how metal/glossy materials (Garudeya
          vitrine, pillar caps) respond to light without adding a real light.
          Kept at low intensity + gated off on Rendah so it can't tip back
          into overexposed. */}
      {graphicsPreset.environmentMap && (
        <Environment preset="apartment" environmentIntensity={graphicsPreset.environmentIntensity} />
      )}

      {/* Hero-framing pillar pairs — a slender, intimate pair planted between
          each zone's center and its hero artifact (ZoneConfig.heroFocus), so
          the hero reads as deliberately framed/staged rather than another
          grid item (spec section 1 "berpasangan simetris membingkai hero" +
          2c "framed reveal"). Only rendered when the resulting frame point
          actually lands near the wall the hero itself is staged against
          (<= HERO_FRAME_MAX_WALL_DIST) — otherwise "between zone center and
          hero" can land further from any wall than the hero itself (this
          happens in single-zone halls, where the center-to-hero line runs
          straight down the middle of the room), which reads as two stray
          columns rather than a frame. A former "threshold pillar" pair that
          used to sit between adjacent zone centers has been removed outright
          for the same reason — it never framed anything and sat 6-12m from
          any wall, squarely in the open floor (see HangingBanner markers
          added in its place instead). */}
      {room.zones.map((zone) => {
        if (!zone.heroFocus) return null;
        const dx = zone.heroFocus.x - zone.center.x;
        const dz = zone.heroFocus.z - zone.center.z;
        const len = Math.hypot(dx, dz) || 1;
        const ux = dx / len;
        const uz = dz / len;
        // Frame point sits 1.5m back from the hero toward the zone center —
        // between the approaching visitor and the piece itself.
        const frameX = zone.heroFocus.x - ux * HERO_FRAME_FORWARD;
        const frameZ = zone.heroFocus.z - uz * HERO_FRAME_FORWARD;
        if (distanceToNearestWall({ x: frameX, z: frameZ }, room.bounds) > HERO_FRAME_MAX_WALL_DIST) return null;
        const perpX = -uz * HERO_FRAME_PERP;
        const perpZ = ux * HERO_FRAME_PERP;
        return (
          <group key={`hero-frame-${zone.id}`}>
            <Pillar height={3} radius={0.24} style="candi" accentColor={zone.accent} position={[frameX + perpX, 0, frameZ + perpZ]} />
            <Pillar height={3} radius={0.24} style="candi" accentColor={zone.accent} position={[frameX - perpX, 0, frameZ - perpZ]} />
          </group>
        );
      })}

      {/* Hero backdrop panels — one per zone hero, planted against whichever
          perimeter wall the hero actually sits nearest to. */}
      {room.zones.map((zone) => {
        if (!zone.heroFocus) return null;
        const wall = nearestWallFor(zone.heroFocus, room.bounds);
        const along = wall.axis === "x" ? zone.heroFocus.z : zone.heroFocus.x;
        return (
          <HeroBackdrop
            key={`hero-backdrop-${zone.id}`}
            wallAxis={wall.axis}
            wallCoord={wall.coord}
            faceSign={wall.faceSign}
            along={along}
            accent={zone.accent}
          />
        );
      })}

      {/* Zone signboards near each zone's threshold */}
      {room.zones.map((zone) => (
        <ZoneSignboard key={`sign-${zone.id}`} zone={zone} />
      ))}

      {/* Center installation — fills the hall's otherwise-empty geometric
          middle with a real destination on the direct sightline from spawn
          (spec section 3: "isi titik tengah yang kosong"), independent of
          any zone's own hero. */}
      {room.centerFocus && (
        <CenterInstallation
          center={room.centerFocus}
          accentColor={room.accentColor}
          shadowsEnabled={graphicsPreset.shadowsEnabled}
          shadowMapSize={graphicsPreset.shadowMapSize}
        />
      )}

      {/* Hanging banners mark zone-to-zone thresholds and any hero-approach
          point the framing pillars above skipped (HERO_FRAME_MAX_WALL_DIST)
          — vertical rhythm overhead, at the same spots the removed pillars
          used to stand, without reintroducing a floor-level obstruction. */}
      {room.zones.length > 1 &&
        room.zones.slice(1).map((zone, i) => {
          const prev = room.zones[i];
          const midX = (prev.center.x + zone.center.x) / 2;
          const midZ = (prev.center.z + zone.center.z) / 2;
          return (
            <HangingBanner
              key={`threshold-banner-${zone.id}`}
              width={1.8}
              height={2.4}
              style="kawung"
              color1="#EDE0C4"
              color2={zone.accent}
              position={[midX, wallHeight - 1.8, midZ]}
            />
          );
        })}
      {room.zones.map((zone) => {
        if (!zone.heroFocus) return null;
        // Must match the hero-frame pillar formula above.
        const dx = zone.heroFocus.x - zone.center.x;
        const dz = zone.heroFocus.z - zone.center.z;
        const len = Math.hypot(dx, dz) || 1;
        const ux = dx / len;
        const uz = dz / len;
        const frameX = zone.heroFocus.x - ux * HERO_FRAME_FORWARD;
        const frameZ = zone.heroFocus.z - uz * HERO_FRAME_FORWARD;
        if (distanceToNearestWall({ x: frameX, z: frameZ }, room.bounds) <= HERO_FRAME_MAX_WALL_DIST) return null;
        return (
          <HangingBanner
            key={`hero-approach-banner-${zone.id}`}
            width={1.8}
            height={2.4}
            style="parang"
            color1="#EDE0C4"
            color2={zone.accent}
            position={[frameX, wallHeight - 1.8, frameZ]}
          />
        );
      })}

      {/* Bulk edge decor — instanced, so the count doesn't cost extra draw calls */}
      <HallColonnade room={room} exclude={colonnadeExclusions} />
      <HallBenches room={room} />

      {/* Hanging lamps — decorative "reason" for the warm base light, 3 spread along the hall centerline */}
      {[minZ + depth * 0.2, centerZ, maxZ - depth * 0.2].map((z, i) => (
        <HangingLamp key={`lamp-${i}`} position={[centerX, wallHeight - 0.5, z]} accentColor={room.accentColor} />
      ))}

      {/* Potted plants clear of the central walking path, near the side walls.
          Inset 1.6 (was 1.3) so they clear the colonnade's own 1.4 wall
          inset with margin — right-sizing Hall 1 (30x18) pulled these close
          enough together to clip at the old inset. */}
      <PottedPlant position={[minX + 1.6, 0, centerZ - depth * 0.28]} />
      <PottedPlant position={[maxX - 1.6, 0, centerZ + depth * 0.28]} />
      <PottedPlant position={[minX + 1.6, 0, centerZ + depth * 0.28]} />

      {/* Zone-specific set dressing (kept from the earlier per-room decor, now zone-anchored) */}
      {useMemo(() => {
        const elements: ReactNode[] = [];

        const prasejarah = room.zones.find((z) => z.id === "prasejarah");
        if (prasejarah) {
          const { x: zx, z: zz } = prasejarah.center;
          // Hand-placed (not center-relative) — cleared to sit around the
          // Pithecanthropus hero/terminating-vista cluster near the west
          // wall (see placementValidator.ts, kept in sync) rather than the
          // old formula-derived spots that now clip the new artifact layout.
          const stoneClusters = [
            { x: -11.05, z: -1.74 },
            { x: -12.5, z: -2.74 },
            { x: -12.68, z: -0.12 },
          ];
          stoneClusters.forEach((pos, i) => {
            elements.push(
              <group key={`stone-${i}`} position={[pos.x, 0, pos.z]}>
                <mesh castShadow receiveShadow position={[0, 0.5, 0]} rotation={[0.3, 0.5, 0]}>
                  <icosahedronGeometry args={[0.6, 1]} />
                  <meshStandardMaterial color="#8a7358" roughness={0.9} />
                </mesh>
                <mesh castShadow receiveShadow position={[0.4, 0.35, -0.2]} rotation={[-0.2, 1.2, 0.5]}>
                  <icosahedronGeometry args={[0.4, 1]} />
                  <meshStandardMaterial color="#9a8368" roughness={0.88} />
                </mesh>
              </group>
            );
          });
          // Small stone relief on the nearest side wall
          const wallX = zx < centerX ? minX + 0.25 : maxX - 0.25;
          const reliefOffsets: Array<[number, number]> = [
            [0, 0], [0.5, 0.15], [-0.5, 0.15], [0.25, -0.35], [-0.25, -0.35], [0, 0.5],
          ];
          elements.push(
            <group key="prasejarah-relief" position={[wallX, wallHeight * 0.5, zz]} rotation={[0, Math.PI / 2, 0]}>
              {reliefOffsets.map(([dx, dy], i) => (
                <mesh key={i} position={[dx, dy, 0]} castShadow>
                  <boxGeometry args={[0.35, 0.35, 0.12]} />
                  <meshStandardMaterial color="#8a7358" roughness={0.95} />
                </mesh>
              ))}
            </group>
          );
        }

        const hinduBuddha = room.zones.find((z) => z.id === "hindu-buddha");
        if (hinduBuddha) {
          const { x: zx, z: zz } = hinduBuddha.center;
          const shaftPositions = [
            { x: zx - 2.25, z: zz - 1.5 },
            { x: zx + 2.25, z: zz - 1.5 },
          ];
          shaftPositions.forEach((pos, i) => {
            elements.push(
              <mesh key={`shaft-${i}`} position={[pos.x, 3, pos.z]} rotation={[0, i * 1.4, 0]}>
                <coneGeometry args={[0.6, 6, 16, 1, true]} />
                <meshBasicMaterial color="#E8A020" transparent opacity={0.07} side={THREE.DoubleSide} />
              </mesh>
            );
          });
          // Guardian statues flanking the zone's entrance (path side, toward
          // welcome). Offset 2.6/0.9 (radius multiplier bumped from 0.85
          // after the Hall 1 right-size pulled Ganesha/Durga close enough
          // to clip these) — keeps them at the zone's outer edge, near the
          // threshold, with a clear gap from the artifact grid.
          elements.push(
            <Dwarapala key="dwarapala-left" position={[zx - 2.6, 0, zz + hinduBuddha.radius * 0.9]} rotation={0} />,
            <Dwarapala key="dwarapala-right" position={[zx + 2.6, 0, zz + hinduBuddha.radius * 0.9]} rotation={Math.PI} />
          );
        }

        const transisi = room.zones.find((z) => z.id === "transisi-iptek");
        if (transisi) {
          // Was a flat #4a4a4a metal slab over a plain brown block — read as
          // an ugly black-over-brown panel with zero tie-in to the palette.
          // Rebuilt as a wood-framed display board using the same artDeco
          // motif (tinted with this zone's own accent) as its floor inlay
          // (see ZoneFloorMotif), so it reads as "the zone's signage" rather
          // than a stray placeholder.
          const panelTexture = createBatikPattern("artDeco", "#EDE0C4", transisi.accent, 128);
          const panelSides: Array<[number, number]> = [
            [minX + 0.15, 1], // left wall, face points +X into the room
            [maxX - 0.15, -1], // right wall, face points -X into the room
          ];
          panelSides.forEach(([panelX, faceDir], i) => {
            elements.push(
              <group key={`wall-panel-${i}`} position={[panelX, 0, transisi.center.z]}>
                <mesh position={[0, 3, 0]} receiveShadow>
                  <boxGeometry args={[0.12, 6.2, depth * 0.42]} />
                  <meshStandardMaterial color={WOOD_COLOR} roughness={0.8} />
                </mesh>
                <mesh position={[faceDir * 0.07, 3, 0]}>
                  <boxGeometry args={[0.02, 6, depth * 0.4]} />
                  <meshStandardMaterial map={panelTexture} emissive={transisi.accent} emissiveIntensity={0.05} roughness={0.55} />
                </mesh>
              </group>
            );
          });
        }

        return elements;
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [room.zones, minX, maxX, centerX, depth, wallHeight])}

      {/* Archway glimpse — peek floor + spill light + destination label, so
          the opening reads as a passage from a distance and every angle,
          not a backdrop (spec: gerbang harus terbaca sebagai jalan tembus). */}
      {room.doors.map((door) => {
        const wallZ = Math.abs(door.position.z - minZ) < 2 ? minZ : maxZ;
        const outwardSign: 1 | -1 = wallZ === minZ ? -1 : 1;
        return <ArchwayGlimpse key={door.label} door={door} wallZ={wallZ} outwardSign={outwardSign} />;
      })}

      {/* Artifacts */}
      {artifacts.map((artifact) => (
        <ArtifactMesh key={artifact.id} artifact={artifact} accentColor={zoneAccentById[artifact.zoneId] ?? room.accentColor} />
      ))}

      {children}
    </group>
  );
}
