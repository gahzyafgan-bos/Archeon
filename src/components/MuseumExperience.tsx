import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Stats, PerformanceMonitor, AdaptiveDpr, AdaptiveEvents, Preload, useProgress } from "@react-three/drei";
import { useMuseumStore, type RoomId } from "@/store/useMuseumStore";
import { ROOM_CONFIGS, type Door } from "@/data/roomConfig";
import { fetchArtifactsByRoom } from "@/data/artifactRepository";
import type { Artifact } from "@/types/artifact";
import { PlayerRig } from "./PlayerRig";
import { Hall } from "./rooms/Hall";
import { useAmbience } from "@/hooks/useAmbience";
import { useDeviceDetection } from "@/hooks/useDeviceDetection";
import { useGraphicsPreset } from "@/hooks/useGraphicsPreset";
import { MiniMapFrame, MiniMapTracker } from "./ui/MiniMap";
import { PostProcessing } from "./PostProcessing";
import { CardboardStereoView } from "./vr/CardboardStereoView";

/**
 * Renders exactly one room's geometry/artifacts at a time — the spec's
 * "jangan load semua ruangan sekaligus" requirement. Switching rooms
 * fetches that room's artifact list (today from local JSON, tomorrow from
 * the real API — see artifactRepository.ts) and unmounts the previous
 * room entirely.
 */
export function MuseumExperience() {
  const activeRoom = useMuseumStore((s) => s.activeRoom);
  const setActiveRoom = useMuseumStore((s) => s.setActiveRoom);
  const isTransitioning = useMuseumStore((s) => s.isTransitioning);
  const setTransitioning = useMuseumStore((s) => s.setTransitioning);
  const setPendingSpawnPoint = useMuseumStore((s) => s.setPendingSpawnPoint);
  const finishLoading = useMuseumStore((s) => s.finishLoading);
  const setLoadProgress = useMuseumStore((s) => s.setLoadProgress);

  const isVRMode = useMuseumStore((s) => s.isVRMode);
  const graphicsPreset = useGraphicsPreset();

  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [renderedRoom, setRenderedRoom] = useState<RoomId>(activeRoom);
  const [dataReady, setDataReady] = useState(false);

  useDeviceDetection();
  useAmbience(renderedRoom);

  // Real loading progress (spec 4a.3: "loading screen dengan progress
  // nyata") — drei's useProgress tracks THREE.DefaultLoadingManager, i.e.
  // the actual GLTF/texture loads Hall 1's artifacts kick off, not a fake
  // timer. Works outside the Canvas too (plain zustand subscription), so it
  // can drive the DOM LoadingScreen directly.
  const { progress: glProgress, active: glActive } = useProgress();

  // Initial load: fetch lobby artifacts (gates isLoading together with the
  // real asset progress above) so the scene never shows before both the
  // artifact list AND its critical assets are ready.
  useEffect(() => {
    fetchArtifactsByRoom("hall-1").then((data) => {
      setArtifacts(data);
      setDataReady(true);
    });
  }, []);

  useEffect(() => {
    // Weight the data fetch itself into the bar (it's most of the first
    // couple hundred ms, before there's anything for useProgress to track
    // yet) so the bar doesn't sit at 0% while the JSON round-trip happens.
    setLoadProgress(dataReady ? Math.max(glProgress, 60) : glProgress * 0.6);
  }, [glProgress, dataReady, setLoadProgress]);

  useEffect(() => {
    if (!dataReady || glActive) return;
    const t = setTimeout(() => {
      setLoadProgress(100);
      finishLoading();
    }, 200);
    return () => clearTimeout(t);
  }, [dataReady, glActive, finishLoading, setLoadProgress]);

  // Brief crossfade whenever the active hall changes — the archway is an
  // open walk-through now, so this only needs to be long enough to hide the
  // new hall's artifacts popping in, not a scene-change beat (see RoomTransition.tsx).
  useEffect(() => {
    if (activeRoom === renderedRoom) return;
    setTransitioning(true);
    const fadeOut = setTimeout(async () => {
      const data = await fetchArtifactsByRoom(activeRoom);
      setArtifacts(data);
      setRenderedRoom(activeRoom);
      setTimeout(() => setTransitioning(false), 30);
    }, 130);
    return () => clearTimeout(fadeOut);
  }, [activeRoom, renderedRoom, setTransitioning]);

  const handleEnterDoor = useCallback(
    (door: Door) => {
      setPendingSpawnPoint(door.targetSpawn);
      setActiveRoom(door.targetRoom);
    },
    [setActiveRoom, setPendingSpawnPoint]
  );

  const room = ROOM_CONFIGS[renderedRoom];
  const miniMapCanvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <>
      <Canvas
        shadows={graphicsPreset.shadowsEnabled}
        // far was a fixed 200 — much deeper than either hall (max ~35m
        // across); a preset-driven, shorter far plane on mobile (spec 4b.5
        // "fog/draw distance dipendekkan") gives three.js's own frustum
        // culling a tighter volume to reject geometry against, on top of
        // fog's purely visual falloff.
        camera={{ fov: 68, near: 0.1, far: graphicsPreset.cameraFar }}
        // Stereo mode renders the scene twice per frame — halve the pixel
        // ratio while it's active so mid-range phones keep a usable frame rate.
        // Otherwise follow the user's graphics-quality DPR cap.
        dpr={isVRMode ? [1, 1] : graphicsPreset.dpr}
        // R3F defaults to ACESFilmicToneMapping, which rolls off highlights
        // naturally instead of clipping to white. Exposure follows the active
        // preset — Rendah runs slightly hotter to compensate for its
        // disabled color-grading composer (see graphicsPresets.ts); MSAA is
        // off at Rendah too, alongside the composer, for the same reason.
        gl={{ toneMappingExposure: graphicsPreset.toneMappingExposure, antialias: graphicsPreset.antialias }}
      >
        {/* Safety net on top of the manual preset: if FPS actually drops,
            AdaptiveDpr steps the renderer's pixel ratio down within the
            active preset's [min,max] bounds (and back up once stable)
            instead of ever risking a sustained stutter. Skipped in VR —
            CardboardStereoView already manages its own eye-texture
            resolution and is already locked to the Rendah preset floor. */}
        <PerformanceMonitor>
          <Suspense fallback={null}>
            <Hall hall={room} artifacts={artifacts} />
            <PlayerRig room={room} artifacts={artifacts} onEnterDoor={handleEnterDoor} />
            {!isVRMode && <MiniMapTracker canvasEl={miniMapCanvasRef.current} room={renderedRoom} />}
            {isVRMode
              ? <CardboardStereoView />
              : graphicsPreset.postProcessingEnabled && <PostProcessing />}
          </Suspense>
          {!isVRMode && (
            <>
              <AdaptiveDpr pixelated />
              <AdaptiveEvents />
            </>
          )}
        </PerformanceMonitor>
        {/* Dev-only FPS readout to verify each graphics-quality preset
            actually changes render cost — tree-shaken out of production
            builds by Vite (import.meta.env.DEV is statically replaced). */}
        {import.meta.env.DEV && <Stats />}
        {/* Precompiles every material/shader currently in the scene once
            loading settles (spec 4a.2) — without this, the first frame
            after the loading screen drops can still hitch while the GPU
            compiles shaders on demand as each object is first drawn. */}
        <Preload all />
      </Canvas>
      {/* Hidden in VR mode: a single unmirrored corner overlay doesn't read correctly split across two eye viewports. */}
      {!isVRMode && <MiniMapFrame canvasRef={miniMapCanvasRef} />}
    </>
  );
}
