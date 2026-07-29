import { ReactNode, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Instances, Instance } from "@react-three/drei";
import * as THREE from "three";
import type { RoomConfig, RoomBounds, Door, ZoneConfig } from "@/data/roomConfig";
import { ARCHWAY_WIDTH, ARCHWAY_HEIGHT, ROOM_CONFIGS, getNearestZone } from "@/data/roomConfig";
import type { Artifact, ZoneId } from "@/types/artifact";
import { ArtifactMesh } from "@/components/artifacts/ArtifactMesh";
import { Dwarapala } from "@/components/artifacts/Dwarapala";
import { HangingLamp, LAMP_CORD_TOP } from "@/components/architecture/HangingLamp";
import { HallColonnade, type ColonnadeExclusion } from "@/components/architecture/HallEdgeDecor";
import { CenterInstallation } from "@/components/architecture/CenterInstallation";
import { FloorPath } from "@/components/architecture/FloorPath";
import { ZoneFloorMotif } from "@/components/architecture/ZoneFloorMotif";
import { ZoneSignboard } from "@/components/architecture/ZoneSignboard";
import { InterpretivePanel, WALL_FURNITURE_MAT } from "@/components/architecture/InterpretivePanel";
import { applyBatikWorldScale, createBatikPattern } from "@/utils/batikPatterns";
import { createSignPlateTexture, createStoneReliefTexture } from "@/utils/panelTexture";
import {
  createWallTexture,
  pilasterOffsets,
  FRIEZE_GAP,
  FRIEZE_H,
  SKIRTING_H,
  type WallBand,
  type WallSpan,
} from "@/utils/wallTexture";
import { useGraphicsPreset } from "@/hooks/useGraphicsPreset";
import { buildPlacedObjects, validatePlacement, FOOTPRINT } from "@/utils/placementValidator";
import { auditCeilingClearance } from "@/utils/decorAudit";
import {
  WALL_THICKNESS,
  WALL_FACE_INSET,
  BEAM_SIZE,
  BEAM_DROP,
  DEFAULT_CEILING_HEIGHT,
  beamXPositions,
  beamZPositions,
  lampZPositions,
  beamUnderside,
} from "@/utils/hallGeometry";
import { objectFootprintRadius } from "@/utils/artifactSize";

const WOOD_COLOR = "#7A5230";
/** Destination plate on an archway lintel. Sized to sit inside the 0.5 m-deep
 * lintel beam that carries it, with 9 cm capitals — the low end of the museum
 * signage band, because an overhead plate is read from further back and the
 * lintel is only so tall. Fixed, like every sign in here: nothing scales with
 * how close the visitor is standing. */
const LINTEL_SIGN_W = ARCHWAY_WIDTH - 0.6;
const LINTEL_SIGN_H = 0.34;
const LINTEL_SIGN_CAP = 0.09;
/** Depth of the batik trim strip running along each short wall. */
const FLOOR_BORDER_WIDTH = 1.6;
/** Ink strength for batik on the floor — the quietest surface in the room.
 * Matches ZoneFloorMotif's own constant; both are floor, both stay faint. */
const FLOOR_MOTIF_STRENGTH = 0.3;
/** Ink strength for batik on vertical signage, which is read up close and
 * competes with nothing standing on it. */
const SIGNAGE_MOTIF_STRENGTH = 0.55;

/**
 * The prehistoric zone's stone relief, on whichever X wall that zone sits
 * against. Position is fixed here rather than derived from the zone centre so
 * the wall-texture pass and the pilaster pass can both see it: anything mounted
 * on a wall has to suppress the vertical rhythm behind it, or a painted
 * pilaster line runs straight through the middle of the panel.
 *
 * `alongZ` = +1.9 puts it at the zone's northern edge, i.e. in view as a
 * visitor turns into the zone, clear of the manusia-purba backdrop (which
 * occupies z -6.5..-3.5 on the same wall) and centred between two pilasters.
 */
const PRASEJARAH_RELIEF = { alongZ: 1.9, width: 2.2, height: 1.6, centerY: 1.95, depth: 0.1 } as const;

/** Length of Hall 2's two large signage bands — shared by the set dressing that
 * draws them and the wall pass that has to keep its rhythm out of them. */
function transisiPanelLength(depth: number): number {
  return Math.min(depth * 0.42, depth - 3);
}

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

/** The four perimeter walls, named by which bound they sit on. */
type WallSide = "minX" | "maxX" | "minZ" | "maxZ";

/** Whether the room-facing side of a wall maps its BoxGeometry UVs against
 * ascending world coordinate. The wall textures are authored in ascending world
 * order and mirrored at paint time for these two, so a zone band always lands
 * on the stretch of wall that zone actually stands in front of. */
const WALL_MIRRORED: Record<WallSide, boolean> = { minX: true, maxX: false, minZ: false, maxZ: true };
/** Which way the room-facing side of each wall points. */
const WALL_FACE_SIGN: Record<WallSide, 1 | -1> = { minX: 1, maxX: -1, minZ: 1, maxZ: -1 };

/** One textured slab of perimeter wall. An archway splits its wall into two of
 * these, each with its own texture, so nothing has to be tiled across a hole. */
interface WallSegment {
  key: string;
  side: WallSide;
  /** Along-wall world extent (X for a Z wall, Z for an X wall). */
  from: number;
  to: number;
  position: [number, number, number];
  args: [number, number, number];
  texture: THREE.Texture;
  /** Along-wall offsets (world) where the vertical rhythm lands. */
  pilasters: number[];
  /** Coordinate of the room-facing surface. */
  faceCoord: number;
}

/** Decorative candi/joglo threshold around an archway — no door leaf, and the
 * lintel that closes the wall above the opening. */
function ArchwayFrame({ door, z, wallHeight, wallColor }: { door: Door; z: number; wallHeight: number; wallColor: string }) {
  const gapHalf = ARCHWAY_WIDTH / 2;
  return (
    <group>
      <mesh position={[door.position.x, ARCHWAY_HEIGHT + (wallHeight - ARCHWAY_HEIGHT) / 2, z]}>
        <boxGeometry args={[ARCHWAY_WIDTH + 0.6, Math.max(0.1, wallHeight - ARCHWAY_HEIGHT), WALL_THICKNESS]} />
        <meshStandardMaterial color={wallColor} roughness={0.85} />
      </mesh>
      <mesh position={[door.position.x - gapHalf - 0.2, ARCHWAY_HEIGHT / 2, z]} castShadow>
        <boxGeometry args={[0.4, ARCHWAY_HEIGHT, 0.5]} />
        <meshStandardMaterial color={WOOD_COLOR} roughness={0.7} />
      </mesh>
      <mesh position={[door.position.x + gapHalf + 0.2, ARCHWAY_HEIGHT / 2, z]} castShadow>
        <boxGeometry args={[0.4, ARCHWAY_HEIGHT, 0.5]} />
        <meshStandardMaterial color={WOOD_COLOR} roughness={0.7} />
      </mesh>
      <mesh position={[door.position.x, ARCHWAY_HEIGHT + 0.25, z]} castShadow>
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
): { axis: "x" | "z"; coord: number; faceSign: 1 | -1; side: WallSide } {
  const dMinX = point.x - bounds.minX;
  const dMaxX = bounds.maxX - point.x;
  const dMinZ = point.z - bounds.minZ;
  const dMaxZ = bounds.maxZ - point.z;
  const closest = Math.min(dMinX, dMaxX, dMinZ, dMaxZ);
  if (closest === dMinX) return { axis: "x", coord: bounds.minX + 0.15, faceSign: 1, side: "minX" };
  if (closest === dMaxX) return { axis: "x", coord: bounds.maxX - 0.15, faceSign: -1, side: "maxX" };
  if (closest === dMinZ) return { axis: "z", coord: bounds.minZ + 0.15, faceSign: 1, side: "minZ" };
  return { axis: "z", coord: bounds.maxZ - 0.15, faceSign: -1, side: "maxZ" };
}

/**
 * Splits a wall segment into per-zone bands by asking, every half metre, which
 * zone is standing in front of that bit of wall. Derived rather than
 * hand-listed, so moving a zone moves its wall treatment with it and a hall
 * with different zones needs no new code.
 */
function zoneBandsFor(room: RoomConfig, side: WallSide, from: number, to: number): WallBand[] {
  const STEP = 0.5;
  const bands: WallBand[] = [];
  for (let s = from; s < to - 1e-6; s += STEP) {
    const e = Math.min(s + STEP, to);
    const mid = (s + e) / 2;
    const probe =
      side === "minZ" || side === "maxZ"
        ? { x: mid, z: side === "minZ" ? room.bounds.minZ : room.bounds.maxZ }
        : { x: side === "minX" ? room.bounds.minX : room.bounds.maxX, z: mid };
    const id: ZoneId = getNearestZone(room, probe.x, probe.z).id;
    const last = bands[bands.length - 1];
    if (last && last.style === id) last.to = e;
    else bands.push({ from: s, to: e, style: id });
  }
  // Re-base to segment-local metres, which is what createWallTexture draws in.
  return bands.map((b) => ({ from: b.from - from, to: b.to - from, style: b.style }));
}

/**
 * Wood-framed backdrop planted directly behind a zone's hero artifact (spec
 * section 2b "latar/backdrop kontras" + section 1 "terminating vista" closed
 * off by something, not a bare wall). Sized to read at a glance, not to fill
 * the whole wall — this is staging for one piece, not a mural.
 *
 * The face used to be a bright kawung batik panel. That was the wrong way
 * round: a lit, patterned 12 m2 field directly behind the one object in the
 * zone that most needs to stand out competes with it for attention, and the
 * hero — usually a pale stone or a warm-lit figure — lost. It is now a DARK
 * field carrying the zone's own hue, matching how the signature piece
 * (GarudeyaStage) has always been staged: the motif moved up to the frieze
 * band on the wall texture, where a band of pattern can't fight an artefact.
 * The wall behind it is darkened to match (see `quiet` in the wall textures).
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
  const fieldColor = useMemo(
    () => new THREE.Color(accent).lerp(new THREE.Color("#241A12"), 0.62).getStyle(),
    [accent]
  );
  const width = 3;
  const height = 4.2;
  const centerY = 0.4 + height / 2;
  const framePos: [number, number, number] = wallAxis === "x" ? [wallCoord, centerY, along] : [along, centerY, wallCoord];
  const facePos: [number, number, number] =
    wallAxis === "x" ? [wallCoord + faceSign * 0.07, centerY, along] : [along, centerY, wallCoord + faceSign * 0.07];
  const linePos: [number, number, number] =
    wallAxis === "x" ? [wallCoord + faceSign * 0.055, centerY, along] : [along, centerY, wallCoord + faceSign * 0.055];
  const frameArgs: [number, number, number] = wallAxis === "x" ? [0.14, height, width] : [width, height, 0.14];
  const faceArgs: [number, number, number] =
    wallAxis === "x" ? [0.02, height - 0.4, width - 0.4] : [width - 0.4, height - 0.4, 0.02];
  // Sits just BEHIND the dark field and slightly larger, so what shows is a
  // ~6 cm brass reveal running round the edge — the only bright thing on the
  // backdrop, and it reads as a frame rather than as a picture.
  const lineArgs: [number, number, number] =
    wallAxis === "x" ? [0.01, height - 0.28, width - 0.28] : [width - 0.28, height - 0.28, 0.01];
  return (
    <group>
      <mesh position={framePos} receiveShadow>
        <boxGeometry args={frameArgs} />
        <meshStandardMaterial color={WOOD_COLOR} roughness={0.8} />
      </mesh>
      <mesh position={linePos}>
        <boxGeometry args={lineArgs} />
        <meshStandardMaterial color="#B08D3C" roughness={0.5} metalness={0.45} />
      </mesh>
      <mesh position={facePos}>
        <boxGeometry args={faceArgs} />
        <meshStandardMaterial color={fieldColor} roughness={0.8} />
      </mesh>
    </group>
  );
}

/**
 * Dedicated highest-tier staging for the museum's signature piece, Garudeya
 * Emas (spec Fase 3) — separate from the generic per-zone hero staging so it
 * reads as the single most important object in the museum, not just another
 * zone hero. A brass-framed DARK backdrop (indigo, not the bright batik panel
 * heroes get) so the gold object pops sharply against it, plus a two-ring
 * floor medallion marking the spot as special even before you see the object.
 * The eye-level plinth + warm spotlights themselves live in ArtifactMesh's
 * Garudeya showcase (keyed on its id). No floor-level pillars or banners in
 * front — the sightline to it is kept deliberately clear.
 *
 * These cues carry more weight than they used to: the glass vitrine that used
 * to surround the piece is gone, so the backdrop, the medallion and the empty
 * floor around them are now the ONLY things telling a visitor this spot is
 * special. Hence the wider medallion and the fully saturated indigo below.
 */
function GarudeyaStage({ pos, bounds }: { pos: { x: number; z: number }; bounds: RoomBounds }) {
  const wall = nearestWallFor(pos, bounds);
  const along = wall.axis === "x" ? pos.z : pos.x;
  const width = 3.4;
  const height = 4.6;
  const centerY = 0.3 + height / 2;
  const framePos: [number, number, number] = wall.axis === "x" ? [wall.coord, centerY, along] : [along, centerY, wall.coord];
  const facePos: [number, number, number] =
    wall.axis === "x" ? [wall.coord + wall.faceSign * 0.08, centerY, along] : [along, centerY, wall.coord + wall.faceSign * 0.08];
  const frameArgs: [number, number, number] = wall.axis === "x" ? [0.16, height, width] : [width, height, 0.16];
  const faceArgs: [number, number, number] =
    wall.axis === "x" ? [0.03, height - 0.4, width - 0.4] : [width - 0.4, height - 0.4, 0.03];
  return (
    <group>
      <mesh position={framePos} receiveShadow>
        <boxGeometry args={frameArgs} />
        <meshStandardMaterial color="#B08D3C" roughness={0.5} metalness={0.45} />
      </mesh>
      <mesh position={facePos}>
        <boxGeometry args={faceArgs} />
        <meshStandardMaterial color="#2E4A7D" roughness={0.65} />
      </mesh>
      {/* Floor medallion — brass outer ring + indigo inner ring. Outer ring
          pushed out to 2.45m so the drawn circle matches the 2-2.5m object-free
          pocket the layout keeps here: with no railing, this ring IS the
          "don't crowd it" signal, so it has to read at the actual size of the
          space rather than sit well inside it. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[pos.x, 0.02, pos.z]}>
        <ringGeometry args={[1.95, 2.45, 48]} />
        <meshStandardMaterial color="#B08D3C" roughness={0.5} metalness={0.5} transparent opacity={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[pos.x, 0.015, pos.z]}>
        <ringGeometry args={[1.2, 1.6, 48]} />
        <meshStandardMaterial color="#2E4A7D" roughness={0.7} transparent opacity={0.55} />
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

  const signTexture = useMemo(
    () =>
      createSignPlateTexture({
        title: `MENUJU ${targetLabel.toUpperCase()}`,
        widthM: LINTEL_SIGN_W,
        heightM: LINTEL_SIGN_H,
        // Indigo ground with brass letters: the "you are leaving this room"
        // half of the signage palette, distinct at a glance from the wooden
        // zone posts inside the room.
        ground: "#2E4A7D",
        ink: "#F2E9D8",
        accent: target.accentColor,
        titleCapM: LINTEL_SIGN_CAP,
      }),
    [targetLabel, target.accentColor]
  );
  useEffect(() => () => signTexture.dispose(), [signTexture]);

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
      {/* Destination plate, bolted flat to the room-facing face of the lintel
          beam (a box of depth 0.5 centred on wallZ, see the Archway above), so
          it is visibly carried by the structure rather than hovering over it.
          A plane's default normal is +Z; `outwardSign` points away from this
          room, so the plate is turned to face back into it. Was a drei <Html>
          pill — see ZoneSignboard for why every one of these had to stop being
          DOM. It is also what kept it from overlapping the zone signboards:
          two DOM labels have no depth to sort by and simply stacked, whereas
          these are metres apart in the scene and sort correctly. */}
      <mesh
        position={[door.position.x, ARCHWAY_HEIGHT + 0.25, wallZ - outwardSign * 0.27]}
        rotation={[0, outwardSign === 1 ? Math.PI : 0, 0]}
      >
        <planeGeometry args={[LINTEL_SIGN_W, LINTEL_SIGN_H]} />
        <meshStandardMaterial map={signTexture} roughness={0.65} metalness={0.05} />
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
  const wallHeight = room.ceilingHeight ?? DEFAULT_CEILING_HEIGHT;

  // The hall's structural grid — beams, and the lamps that hang off them.
  // Both come from utils/hallGeometry.ts rather than being re-derived here, so
  // anything that has to meet the ceiling meets the same ceiling.
  const beamZs = useMemo(() => beamZPositions(room.bounds), [room.bounds]);
  const beamXs = useMemo(() => beamXPositions(room.bounds), [room.bounds]);
  const lampZs = useMemo(() => lampZPositions(room.bounds), [room.bounds]);
  const lampY = beamUnderside(wallHeight) - LAMP_CORD_TOP;

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
    // Same idea on the vertical axis: nothing that hangs from or stands
    // against the ceiling may cross the beam grid (see utils/decorAudit.ts).
    auditCeilingClearance(room);
  }, [room, artifacts]);

  const zoneAccentById = useMemo(() => {
    const map: Partial<Record<ZoneId, string>> = {};
    for (const zone of room.zones) map[zone.id] = zone.accent;
    return map;
  }, [room.zones]);

  const gapDoorMinZ = findGapDoor(room.doors, minZ);
  const gapDoorMaxZ = findGapDoor(room.doors, maxZ);

  /**
   * Every perimeter wall, baked. This is the whole answer to "tembok terasa
   * kosong": one texture per wall segment carrying the light gradient, the
   * skirting, the dado, the frieze band and the vertical rhythm, with the
   * zone bands derived from which zone stands in front of each stretch.
   *
   * It replaces the flat single-colour material each of these meshes already
   * had, so the mesh count, the draw-call count and the material count are all
   * unchanged, no light is added, and every layer survives the Rendah preset
   * where shadows and half the lights are switched off.
   */
  const wallSegments = useMemo<WallSegment[]>(() => {
    // Stretches of wall that must stay dark and undecorated: whatever a hero or
    // the signature piece is staged against. The artefact has to win.
    const quietBySide: Partial<Record<WallSide, Array<{ along: number; half: number }>>> = {};
    const addQuiet = (point: { x: number; z: number }, half: number) => {
      const wall = nearestWallFor(point, room.bounds);
      const along = wall.axis === "x" ? point.z : point.x;
      (quietBySide[wall.side] ??= []).push({ along, half });
    };
    for (const zone of room.zones) if (zone.heroFocus) addQuiet(zone.heroFocus, 2.1);
    const signature = artifacts.find((a) => a.display_tier === "signature");
    if (signature) addQuiet(signature.koordinat_ruangan, 2.6);

    // Everything already mounted ON a wall. The vertical rhythm — painted line
    // and geometry alike — has to step around these, otherwise a pilaster runs
    // straight through the middle of a board.
    const featureBySide: Partial<Record<WallSide, WallSpan[]>> = {};
    const CLEAR = 0.3;
    const addFeature = (point: { x: number; z: number }, half: number) => {
      const wall = nearestWallFor(point, room.bounds);
      const along = wall.axis === "x" ? point.z : point.x;
      (featureBySide[wall.side] ??= []).push({ from: along - half - CLEAR, to: along + half + CLEAR });
    };
    for (const zone of room.zones) {
      if (zone.wallPanel) addFeature(zone.wallPanel.position, 1.6);
      if (zone.id === "prasejarah") {
        const wallX = zone.center.x < centerX ? minX : maxX;
        addFeature({ x: wallX, z: PRASEJARAH_RELIEF.alongZ }, PRASEJARAH_RELIEF.width / 2);
      }
      if (zone.id === "transisi-iptek") {
        const half = transisiPanelLength(depth) / 2;
        for (const wallX of [minX, maxX]) addFeature({ x: wallX, z: zone.center.z }, half);
      }
    }

    const build = (side: WallSide, from: number, to: number): WallSegment | null => {
      const length = to - from;
      if (length <= 0.2) return null;
      const local = (s: WallSpan): WallSpan => ({ from: s.from - from, to: s.to - from });
      const inRange = (s: WallSpan) => s.to > 0 && s.from < length;
      const spans: WallSpan[] = (quietBySide[side] ?? [])
        .map((q) => local({ from: q.along - q.half, to: q.along + q.half }))
        .filter(inRange);
      const features: WallSpan[] = (featureBySide[side] ?? []).map(local).filter(inRange);
      const texture = createWallTexture({
        lengthM: length,
        heightM: wallHeight,
        bands: zoneBandsFor(room, side, from, to),
        quiet: spans,
        occupied: features,
        mirror: WALL_MIRRORED[side],
      });
      // Same call the texture makes, so the strips land exactly on the lines.
      const pilasters = pilasterOffsets(length, [...spans, ...features]).map((o) => from + o);
      const isZ = side === "minZ" || side === "maxZ";
      const coord = side === "minX" ? minX : side === "maxX" ? maxX : side === "minZ" ? minZ : maxZ;
      return {
        key: `${side}-${from.toFixed(2)}`,
        side,
        from,
        to,
        position: isZ ? [(from + to) / 2, wallHeight / 2, coord] : [coord, wallHeight / 2, (from + to) / 2],
        args: isZ ? [length, wallHeight, WALL_THICKNESS] : [WALL_THICKNESS, wallHeight, length],
        texture,
        pilasters,
        faceCoord: coord + WALL_FACE_SIGN[side] * WALL_FACE_INSET,
      };
    };

    const segments: WallSegment[] = [];
    // Z walls: split around the archway, if this wall carries one.
    for (const [side, gapDoor] of [
      ["minZ", gapDoorMinZ],
      ["maxZ", gapDoorMaxZ],
    ] as const) {
      if (!gapDoor) {
        segments.push(build(side, minX, maxX)!);
        continue;
      }
      const gapHalf = ARCHWAY_WIDTH / 2;
      segments.push(build(side, minX, gapDoor.position.x - gapHalf)!);
      segments.push(build(side, gapDoor.position.x + gapHalf, maxX)!);
    }
    segments.push(build("minX", minZ, maxZ)!);
    segments.push(build("maxX", minZ, maxZ)!);
    return segments.filter(Boolean);
  }, [room, artifacts, wallHeight, minX, maxX, minZ, maxZ, centerX, depth, gapDoorMinZ, gapDoorMaxZ]);

  // Canvas textures are not garbage-collected off the GPU on their own.
  useEffect(() => () => wallSegments.forEach((s) => s.texture.dispose()), [wallSegments]);

  /** Shallow pilaster strips standing proud of the painted vertical rhythm.
   * The texture already carries the rhythm on its own, so this is the layer
   * that gets dropped on Rendah (spec B.7.7: the mandatory layers are the
   * painted ones). Every strip in the hall is one instanced batch. */
  const pilasterHeight = Math.max(0.5, wallHeight - FRIEZE_GAP - FRIEZE_H - SKIRTING_H);
  const pilasterInstances = useMemo(() => {
    if (!graphicsPreset.shadowsEnabled) return [];
    const out: Array<{ key: string; position: [number, number, number]; rotationY: number }> = [];
    for (const seg of wallSegments) {
      const isZ = seg.side === "minZ" || seg.side === "maxZ";
      for (const along of seg.pilasters) {
        out.push({
          key: `${seg.key}-${along.toFixed(2)}`,
          position: isZ
            ? [along, SKIRTING_H + pilasterHeight / 2, seg.faceCoord + WALL_FACE_SIGN[seg.side] * 0.02]
            : [seg.faceCoord + WALL_FACE_SIGN[seg.side] * 0.02, SKIRTING_H + pilasterHeight / 2, along],
          rotationY: isZ ? 0 : Math.PI / 2,
        });
      }
    }
    return out;
  }, [wallSegments, pilasterHeight, graphicsPreset.shadowsEnabled]);

  // Colonnade pillar slots to skip — a pillar landing on top of a hero's
  // framing/backdrop or a wall-flush niche piece reads as clutter, not
  // architecture (see HallColonnade's own doc comment). Mirrors the potted
  // architecture, not clutter.
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
      // Signature piece (Garudeya) needs the most colonnade-free clearance of
      // anything — it isn't a zone heroFocus, so exclude it explicitly.
      // Margin widened 1.0 -> 1.6 when its vitrine was removed: the nearest
      // colonnade slot sat 2.57m out, i.e. inside the 2.45m floor medallion,
      // and with no glass box left to define the piece's territory that pillar
      // was the thing making the pocket read as crowded. Keep this >= the
      // medallion's outer radius. (Mirrored in placementValidator.ts.)
      if (artifact.display_tier === "signature") {
        const r = Math.max(FOOTPRINT.artifactSignature, objectFootprintRadius(artifact) ?? 0);
        points.push({ x: artifact.koordinat_ruangan.x, z: artifact.koordinat_ruangan.z, dist: r + 1.6 });
      }
    }
    return points;
  }, [room.zones, artifacts]);

  // Floor border batik motif — one per hall for a bit of variety, tinted with
  // the hall's own accent rather than any single zone's. Scaled to the strip's
  // real size: one tile stretched across a 22 x 1.6 m band gave motifs 2.75 m
  // wide and 20 cm tall, so the "batik" was a row of smears.
  const floorBorderLength = width - 2;
  const floorBorderTexture = useMemo(
    () =>
      applyBatikWorldScale(
        // Ground colour is the floor itself, for the same reason as the zone
        // inlays: this is floor with a trim pattern, not a lighter runner laid
        // on top of it.
        createBatikPattern(room.id === "hall-1" ? "kawung" : "artDeco", room.floorColor, room.accentColor, 256, FLOOR_MOTIF_STRENGTH),
        floorBorderLength,
        FLOOR_BORDER_WIDTH
      ),
    [room.id, room.accentColor, room.floorColor, floorBorderLength]
  );
  useEffect(() => () => floorBorderTexture.dispose(), [floorBorderTexture]);

  // Prehistoric zone's wall relief (see the set-dressing block below). Built
  // once per hall, not per render, and released with the hall.
  const hasPrasejarah = room.zones.some((z) => z.id === "prasejarah");
  const stoneReliefTexture = useMemo(
    () => (hasPrasejarah ? createStoneReliefTexture() : null),
    [hasPrasejarah]
  );
  useEffect(() => () => stoneReliefTexture?.dispose(), [stoneReliefTexture]);

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
        <planeGeometry args={[floorBorderLength, FLOOR_BORDER_WIDTH]} />
        <meshStandardMaterial map={floorBorderTexture} roughness={0.8} transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0.01, maxZ - 1.2]} receiveShadow>
        <planeGeometry args={[floorBorderLength, FLOOR_BORDER_WIDTH]} />
        <meshStandardMaterial map={floorBorderTexture} roughness={0.8} transparent opacity={0.5} />
      </mesh>

      {/* Zone floor motifs — the main way zones read as distinct without a wall in sight */}
      {room.zones.map((zone) => (
        <ZoneFloorMotif key={zone.id} zone={zone} floorColor={room.floorColor} />
      ))}
      <FloorPath room={room} />

      {/* Ceiling: joglo beam grid, consistent style across both halls.
          Instanced (2 draw calls total instead of one mesh per beam) —
          every beam-x shares one box geometry/material, every beam-z
          shares another, only position differs (spec 4b.2: "merge geometry
          statik... elemen arsitektur"). */}
      <group position={[0, wallHeight, 0]}>
        {/* A shade darker than it was: the ceiling and the top of the wall
            need to sit clearly below the lit band of the wall, otherwise the
            room reads as an evenly lit box with no volume. */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[centerX, 0, centerZ]}>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color="#493B2C" roughness={0.94} />
        </mesh>
        {/* castShadow off: a directional key light through a full grid of
            these casts a hard diagonal lattice across the whole floor
            (spec: "hilangkan bayangan atap/hiasan langit-langit"). */}
        <Instances limit={Math.max(1, beamZs.length)} frustumCulled={false} frames={1}>
          <boxGeometry args={[width - 2, BEAM_SIZE, BEAM_SIZE]} />
          <meshStandardMaterial color={WOOD_COLOR} roughness={0.85} />
          {beamZs.map((zPos, i) => (
            <Instance key={`beam-x-${i}`} position={[centerX, -BEAM_DROP, zPos]} />
          ))}
        </Instances>
        <Instances limit={Math.max(1, beamXs.length)} frustumCulled={false} frames={1}>
          <boxGeometry args={[BEAM_SIZE, BEAM_SIZE, depth - 2]} />
          <meshStandardMaterial color={WOOD_COLOR} roughness={0.85} />
          {beamXs.map((xPos, i) => (
            <Instance key={`beam-z-${i}`} position={[xPos, -BEAM_DROP, centerZ]} />
          ))}
        </Instances>
      </group>

      {/* Perimeter walls — collision-relevant sides only; no internal walls
          between zones. Each slab wears its own baked texture (see
          `wallSegments`): wall wash, skirting, dado, frieze band and pilaster
          rhythm, banded per zone. */}
      {wallSegments.map((seg) => (
        <mesh key={seg.key} position={seg.position} receiveShadow>
          <boxGeometry args={seg.args} />
          <meshStandardMaterial map={seg.texture} roughness={0.88} />
        </mesh>
      ))}
      {gapDoorMinZ && (
        <ArchwayFrame door={gapDoorMinZ} z={minZ} wallHeight={wallHeight} wallColor={room.wallColor} />
      )}
      {gapDoorMaxZ && (
        <ArchwayFrame door={gapDoorMaxZ} z={maxZ} wallHeight={wallHeight} wallColor={room.wallColor} />
      )}

      {/* Vertical rhythm in real geometry — a shallow strip that catches the
          key light on one edge and shades on the other. One instanced batch
          for the whole hall; dropped entirely on Rendah, where the painted
          pilaster lines carry the rhythm on their own. */}
      {pilasterInstances.length > 0 && (
        <Instances limit={pilasterInstances.length} castShadow receiveShadow frustumCulled={false} frames={1}>
          <boxGeometry args={[0.12, pilasterHeight, 0.05]} />
          <meshStandardMaterial color="#E8DCC4" roughness={0.9} />
          {pilasterInstances.map((p) => (
            <Instance key={p.key} position={p.position} rotation={[0, p.rotationY, 0]} />
          ))}
        </Instances>
      )}

      {/* Lighting System — ambient/hemisphere are now just a soft fill floor
          (no direction, so on their own they flatten everything to the same
          brightness); a single directional key light is the actual source of
          form/shadow, mimicking sun coming through the joglo roof. Kept low
          enough that highlights don't clip to white at exposure 0.95 (see
          MuseumExperience) but still leaves visible tonal range top-to-bottom. */}
      {/* Rendah nudges these up slightly — cheap compensation for the
          disabled color-grading composer (BrightnessContrast/HueSaturation),
          so the hall doesn't read flatter/paler than Sedang/Tinggi.
          Both were trimmed (~0.07) when the walls gained their baked wash:
          flat, directionless fill is exactly what was washing the gradient
          back out and flattening the corners. This is a CONTRAST change, not
          a brightness one — the directional key, the per-zone accent lights
          and every artefact spotlight are untouched, so the objects hold
          their level while the fill behind them drops. */}
      <ambientLight intensity={graphicsPreset.postProcessingEnabled ? 0.33 : 0.4} color="#FFF6E6" />
      <hemisphereLight args={["#FFF6E6", "#A89469", graphicsPreset.postProcessingEnabled ? 0.34 : 0.4]} />
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

      {/* Garudeya Emas signature staging (spec Fase 3): dark backdrop + floor
          medallion around the museum's most important piece. The former
          "hero-framing candi pillar pairs" were removed here — two 3m columns
          planted 1.6m in front of each zone hero were exactly the floor-level
          obstruction the redesign brief flagged (they buried the tiny gold
          Garudeya in its old corner). Heroes now read via their own spotlight
          + wall backdrop (below) and generous negative space instead of
          framing pillars in the sightline. */}
      {(() => {
        const g = artifacts.find((a) => a.id === "r2-garudeya-emas");
        return g ? <GarudeyaStage pos={{ x: g.koordinat_ruangan.x, z: g.koordinat_ruangan.z }} bounds={room.bounds} /> : null;
      })()}

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

      {/* The threshold banners used to hang here — one per zone boundary, at
          the midpoint between two zone centres, `wallHeight - 1.8` up.
          In Hall 1 that put them at (-3.25, 4.2, 1.6) and (0, 4.2, -2); Hall 2
          is single-zone and never had any.

          Removed, not repositioned. Measured, the upper banner cleared the
          beam grid by 10 cm — but the beam at z=0 sits between the visitor and
          the banner at z=-2, so from anywhere on the floor the dark beam reads
          as passing straight through the panel. Nothing about the object
          survived inspection either way: a paper-thin plane with no frame, no
          thickness and no visible support, hung in mid-air at 4.2 m, carrying
          a motif whose repeat was 22.5 cm — polkadots, not batik (see
          utils/batikPatterns.ts, where kawung is now drawn correctly).

          There is no replacement. Visitors look forward and slightly down; a
          large ornament overhead only presses the ceiling lower, in halls that
          were just made smaller. The zone boundary is already marked at floor
          level by ZoneFloorMotif and FloorPath, which is where a visitor is
          actually looking. */}
      {/* Bulk edge decor — instanced, so the count doesn't cost extra draw calls.
          The per-zone resting bench that used to sit here is gone: it rendered
          as a featureless 1.6 x 0.5 x 0.45 m wood slab (its legs were buried
          inside the seat box, so nothing read as a bench), it stood alone
          against a wall, and it cannot be sat on in a virtual museum — a plain
          brown block taking up floor space and nothing else. See
          HallEdgeDecor.tsx. */}
      <HallColonnade room={room} exclude={colonnadeExclusions} />

      {/* Interpretive panels — the one wall element that fills a surface AND
          does a job. Placement is hand-authored per zone (roomConfig
          `wallPanel`) so it can be kept off hero backdrops and out of the
          colonnade; the wall texture skips its pilaster line and frieze motif
          behind each one. */}
      {room.zones.map((zone) =>
        zone.wallPanel ? (
          <InterpretivePanel
            key={`panel-${zone.id}`}
            position={[zone.wallPanel.position.x, zone.wallPanel.position.y, zone.wallPanel.position.z]}
            rotationY={zone.wallPanel.rotationY}
            title={zone.label}
            body={zone.wallPanel.body}
            accent={zone.accent}
          />
        ) : null
      )}

      {/* Hanging lamps — decorative "reason" for the warm base light, hung
          along the hall centerline. The Z positions are sampled FROM the beam
          grid above (not spread evenly along the hall on their own), and the
          height is the beam underside less the cord length, so each cord ends
          on the beam it hangs from. Spread independently, as they were, two of
          Hall 1's three lamps missed their beam by half a metre and every cord
          in both halls ran up past the ceiling plane. */}
      {lampZs.map((z, i) => (
        <HangingLamp key={`lamp-${i}`} position={[centerX, lampY, z]} accentColor={room.accentColor} />
      ))}

      {/* Potted plants removed per revisi desainer: pengguna menilai pohon/pot
          tanaman sebagai filler generik tanpa nilai naratif — kekosongan kini
          diatasi dengan membesarkan artefak/arca (lihat real_world_size di
          artifacts.json) agar artefak itu sendiri yang mendominasi ruang,
          bukan ditambal dekorasi. Elemen dekor fungsional (colonnade, lampu,
          panel interpretif, signage, wayfinding) tetap dipertahankan; bangku
          per-zona ikut dihapus belakangan karena ternyata hanya balok polos
          yang tidak bisa diduduki (lihat HallEdgeDecor.tsx). */}

      {/* Zone-specific set dressing (kept from the earlier per-room decor, now zone-anchored) */}
      {useMemo(() => {
        const elements: ReactNode[] = [];

        const prasejarah = room.zones.find((z) => z.id === "prasejarah");
        if (prasejarah) {
          const { x: zx } = prasejarah.center;
          // Hand-placed (not center-relative) — cleared to sit around the
          // Pithecanthropus hero/terminating-vista cluster near the west
          // wall (see placementValidator.ts, kept in sync) rather than the
          // old formula-derived spots that now clip the new artifact layout.
          const stoneClusters = [
            { x: -11.4, z: -6.5 },
            { x: -11.4, z: -3.6 },
            { x: -11.3, z: -1.6 },
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
          // Shallow relief panel on the nearest side wall. This used to be six
          // identical 35 cm cubes arranged in a plus — a primitive stuck on a
          // wall, not a relief. It is now one stone-toned panel carrying hand
          // stencils, chevrons and a fauna silhouette: prehistoric marks rather
          // than batik, which belongs to a much later period and has no place
          // in this zone. One mesh, one texture, no light of its own.
          const wallX = zx < centerX ? minX + 0.16 : maxX - 0.16;
          const faceDir = zx < centerX ? 1 : -1;
          const { width: rw, height: rh, depth: rd, centerY, alongZ } = PRASEJARAH_RELIEF;
          elements.push(
            <group
              key="prasejarah-relief"
              position={[wallX, centerY, alongZ]}
              rotation={[0, faceDir * (Math.PI / 2), 0]}
            >
              <mesh receiveShadow>
                <boxGeometry args={[rw, rh, rd]} />
                <primitive object={WALL_FURNITURE_MAT.wood} attach="material" />
              </mesh>
              <mesh position={[0, 0, rd / 2 + 0.005]}>
                <planeGeometry args={[rw - 0.16, rh - 0.16]} />
                <meshStandardMaterial map={stoneReliefTexture} roughness={0.97} />
              </mesh>
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
          const panelH = 2.4;
          // Same helper the wall-texture pass uses to keep its rhythm out of
          // this band, so the two cannot drift apart.
          const panelLen = transisiPanelLength(depth);
          // Whole-integer tiling derived from the band's real size, so the
          // diamonds are square and the same size as every other batik surface
          // in the museum. The old hand-set repeat.set(2, 1) was a guess that
          // still left them ~30 cm across and stretched.
          const panelTexture = applyBatikWorldScale(
            createBatikPattern("artDeco", "#EDE0C4", transisi.accent, 128, SIGNAGE_MOTIF_STRENGTH),
            panelLen,
            panelH
          );
          const panelSides: Array<[number, number]> = [
            [minX + 0.15, 1], // left wall, face points +X into the room
            [maxX - 0.15, -1], // right wall, face points -X into the room
          ];
          // Cut down from `wallHeight - 0.8` (4.7 m of a 5.5 m wall, twice) to a
          // horizontal band. At full height these were a repeating motif
          // covering essentially the whole side wall — the exact thing that
          // makes a gallery noisy and steals attention from the artefacts, and
          // it left no room for the wall's own dado/frieze system. As a band it
          // sits above the dado and below the frieze and reads as this zone's
          // signage instead of as wallpaper. Length is capped against the
          // hall's own depth so it can't overshoot toward the archway
          // (`panelH`/`panelLen` are declared above, where the texture that
          // has to match them is built).
          const panelCenterY = 1.15 + panelH / 2;
          panelSides.forEach(([panelX, faceDir], i) => {
            elements.push(
              <group key={`wall-panel-${i}`} position={[panelX, 0, transisi.center.z]}>
                <mesh position={[0, panelCenterY, 0]} receiveShadow>
                  <boxGeometry args={[0.12, panelH, panelLen]} />
                  <meshStandardMaterial color={WOOD_COLOR} roughness={0.8} />
                </mesh>
                <mesh position={[faceDir * 0.07, panelCenterY, 0]}>
                  <boxGeometry args={[0.02, panelH - 0.2, panelLen - 0.4]} />
                  <meshStandardMaterial map={panelTexture} emissive={transisi.accent} emissiveIntensity={0.05} roughness={0.55} />
                </mesh>
              </group>
            );
          });
        }

        return elements;
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [room.zones, minX, maxX, centerX, depth, wallHeight, stoneReliefTexture])}

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
