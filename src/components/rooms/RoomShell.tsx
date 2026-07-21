import { ReactNode, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import type { RoomConfig, Door, ZoneConfig } from "@/data/roomConfig";
import { ARCHWAY_WIDTH, ARCHWAY_HEIGHT } from "@/data/roomConfig";
import type { Artifact, ZoneId } from "@/types/artifact";
import { ArtifactMesh } from "@/components/artifacts/ArtifactMesh";
import { Dwarapala } from "@/components/artifacts/Dwarapala";
import { Pillar } from "@/components/architecture/Pillar";
import { HangingLamp } from "@/components/architecture/HangingLamp";
import { PottedPlant } from "@/components/architecture/PottedPlant";
import { HallColonnade, HallBenches } from "@/components/architecture/HallEdgeDecor";
import { FloorPath } from "@/components/architecture/FloorPath";
import { ZoneFloorMotif } from "@/components/architecture/ZoneFloorMotif";
import { ZoneSignboard } from "@/components/architecture/ZoneSignboard";
import { createBatikPattern } from "@/utils/batikPatterns";
import { useGraphicsPreset } from "@/hooks/useGraphicsPreset";
import { buildPlacedObjects, validatePlacement } from "@/utils/placementValidator";

const WALL_THICKNESS = 0.3;
const WOOD_COLOR = "#7A5230";

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

export function RoomShell({ room, artifacts, children }: RoomShellProps) {
  const { minX, maxX, minZ, maxZ } = room.bounds;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const wallHeight = 7;
  const { scene } = useThree();
  const graphicsPreset = useGraphicsPreset();

  useMemo(() => {
    // Warm, light fog matching the Batik Modern base palette — closes off
    // the far end of the (now much bigger) hall cheaply instead of rendering
    // full detail all the way to the walls.
    scene.fog = new THREE.FogExp2("#E4D5B7", 0.018);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

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

      {/* Ceiling: joglo beam grid, consistent style across both halls */}
      <group position={[0, wallHeight, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[centerX, 0, centerZ]}>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color="#5a4a38" roughness={0.92} />
        </mesh>
        {Array.from({ length: Math.ceil(depth / 5) }).map((_, i) => {
          const zPos = minZ + 2.5 + i * 5;
          if (zPos > maxZ - 2) return null;
          return (
            // Ceiling beam grid — castShadow off: a directional key light through
            // a full grid of these casts a hard diagonal lattice across the whole
            // floor (spec: "hilangkan bayangan atap/hiasan langit-langit").
            <mesh key={`beam-x-${i}`} position={[centerX, -0.2, zPos]}>
              <boxGeometry args={[width - 2, 0.3, 0.3]} />
              <meshStandardMaterial color={WOOD_COLOR} roughness={0.85} />
            </mesh>
          );
        })}
        {Array.from({ length: Math.ceil(width / 5) }).map((_, i) => {
          const xPos = minX + 2.5 + i * 5;
          if (xPos > maxX - 2) return null;
          return (
            <mesh key={`beam-z-${i}`} position={[xPos, -0.2, centerZ]}>
              <boxGeometry args={[0.3, 0.3, depth - 2]} />
              <meshStandardMaterial color={WOOD_COLOR} roughness={0.85} />
            </mesh>
          );
        })}
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
      <ambientLight intensity={0.4} color="#FFF6E6" />
      <hemisphereLight args={["#FFF6E6", "#C9B48A", 0.42]} />
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
      {/* Accent fill lights — count follows graphics quality (spec 4b "jumlah
          spotLight aksen"); kept to a handful per hall either way (spec 7). */}
      {[
        { x: centerX - width * 0.25, z: centerZ },
        { x: centerX + width * 0.25, z: centerZ },
      ]
        .slice(0, graphicsPreset.accentLightCount)
        .map((p, i) => (
          <pointLight key={i} position={[p.x, 4.5, p.z]} intensity={8} distance={14} decay={2} color="#E8A020" />
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

      {/* Soft threshold pillars between zones — reads as a gateway without blocking movement */}
      {room.zones.length > 1 &&
        room.zones.slice(1).map((zone, i) => {
          const prev = room.zones[i];
          const midX = (prev.center.x + zone.center.x) / 2;
          const midZ = (prev.center.z + zone.center.z) / 2;
          // Perpendicular offset so the two pillars flank the walking path rather than sitting on it.
          const dx = zone.center.x - prev.center.x;
          const dz = zone.center.z - prev.center.z;
          const len = Math.hypot(dx, dz) || 1;
          const perpX = (-dz / len) * 2.2;
          const perpZ = (dx / len) * 2.2;
          return (
            <group key={`threshold-${zone.id}`}>
              <Pillar height={3.8} radius={0.32} style="candi" accentColor={zone.accent} position={[midX + perpX, 0, midZ + perpZ]} />
              <Pillar height={3.8} radius={0.32} style="candi" accentColor={prev.accent} position={[midX - perpX, 0, midZ - perpZ]} />
            </group>
          );
        })}

      {/* Zone signboards near each zone's threshold */}
      {room.zones.map((zone) => (
        <ZoneSignboard key={`sign-${zone.id}`} zone={zone} />
      ))}

      {/* Bulk edge decor — instanced, so the count doesn't cost extra draw calls */}
      <HallColonnade room={room} />
      <HallBenches room={room} />

      {/* Hanging lamps — decorative "reason" for the warm base light, 3 spread along the hall centerline */}
      {[minZ + depth * 0.2, centerZ, maxZ - depth * 0.2].map((z, i) => (
        <HangingLamp key={`lamp-${i}`} position={[centerX, wallHeight - 0.5, z]} accentColor={room.accentColor} />
      ))}

      {/* Potted plants clear of the central walking path, near the side walls */}
      <PottedPlant position={[minX + 1.3, 0, centerZ - depth * 0.28]} />
      <PottedPlant position={[maxX - 1.3, 0, centerZ + depth * 0.28]} />
      <PottedPlant position={[minX + 1.3, 0, centerZ + depth * 0.28]} />

      {/* Zone-specific set dressing (kept from the earlier per-room decor, now zone-anchored) */}
      {useMemo(() => {
        const elements: ReactNode[] = [];

        const prasejarah = room.zones.find((z) => z.id === "prasejarah");
        if (prasejarah) {
          const { x: zx, z: zz } = prasejarah.center;
          const stoneClusters = [
            { x: zx - 5, z: zz - 3 },
            { x: zx + 5, z: zz - 3 },
            { x: zx - 5, z: zz + 3 },
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
            { x: zx - 3, z: zz - 2 },
            { x: zx + 3, z: zz - 2 },
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
          // welcome). Pushed out to 2.6/0.85 (was 2.2/0.6) — at the old offset
          // these sat almost on top of the front-row artifacts (Durga at
          // zx+2.2 basically minus a hair, Garudeya likewise), clipping their
          // pedestals/vitrine. This keeps them at the zone's outer edge, near
          // the threshold, with a clear gap from the artifact grid.
          elements.push(
            <Dwarapala key="dwarapala-left" position={[zx - 2.6, 0, zz + hinduBuddha.radius * 0.85]} rotation={0} />,
            <Dwarapala key="dwarapala-right" position={[zx + 2.6, 0, zz + hinduBuddha.radius * 0.85]} rotation={Math.PI} />
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

      {/* Archway threshold markers (visual only, no collider — see PlayerRig for the actual trigger) */}
      {room.doors.map((door) => (
        <group key={door.label} position={[door.position.x, 0, door.position.z]} />
      ))}

      {/* Artifacts */}
      {artifacts.map((artifact) => (
        <ArtifactMesh key={artifact.id} artifact={artifact} accentColor={zoneAccentById[artifact.zoneId] ?? room.accentColor} />
      ))}

      {children}
    </group>
  );
}
