import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
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

  useDeviceDetection();
  useAmbience(renderedRoom);

  // Initial load: fetch lobby artifacts, drive the loading-screen progress bar.
  useEffect(() => {
    let progress = 0;
    const tick = setInterval(() => {
      progress = Math.min(100, progress + Math.random() * 18 + 8);
      setLoadProgress(progress);
      if (progress >= 100) clearInterval(tick);
    }, 140);

    fetchArtifactsByRoom("hall-1").then((data) => {
      setArtifacts(data);
      setTimeout(() => {
        setLoadProgress(100);
        finishLoading();
      }, 900);
    });

    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        camera={{ fov: 68, near: 0.1, far: 200 }}
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
        <Suspense fallback={null}>
          <Hall hall={room} artifacts={artifacts} />
          <PlayerRig room={room} artifacts={artifacts} onEnterDoor={handleEnterDoor} />
          {!isVRMode && <MiniMapTracker canvasEl={miniMapCanvasRef.current} room={renderedRoom} />}
          {isVRMode
            ? <CardboardStereoView />
            : graphicsPreset.postProcessingEnabled && <PostProcessing />}
        </Suspense>
      </Canvas>
      {/* Hidden in VR mode: a single unmirrored corner overlay doesn't read correctly split across two eye viewports. */}
      {!isVRMode && <MiniMapFrame canvasRef={miniMapCanvasRef} />}
    </>
  );
}
