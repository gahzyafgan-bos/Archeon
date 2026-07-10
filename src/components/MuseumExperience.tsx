import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { useMuseumStore, type RoomId } from "@/store/useMuseumStore";
import { ROOM_CONFIGS, type Door } from "@/data/roomConfig";
import { fetchArtifactsByRoom } from "@/data/artifactRepository";
import type { Artifact } from "@/types/artifact";
import { PlayerRig } from "./PlayerRig";
import { Lobby } from "./rooms/Lobby";
import { GalleryRoom } from "./rooms/GalleryRoom";
import { useAmbience } from "@/hooks/useAmbience";
import { useDeviceDetection } from "@/hooks/useDeviceDetection";
import { MiniMapFrame, MiniMapTracker } from "./ui/MiniMap";
import { PostProcessing } from "./PostProcessing";

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

    fetchArtifactsByRoom("lobby").then((data) => {
      setArtifacts(data);
      setTimeout(() => {
        setLoadProgress(100);
        finishLoading();
      }, 900);
    });

    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fade-to-black transition whenever the active room changes.
  useEffect(() => {
    if (activeRoom === renderedRoom) return;
    setTransitioning(true);
    const fadeOut = setTimeout(async () => {
      const data = await fetchArtifactsByRoom(activeRoom);
      setArtifacts(data);
      setRenderedRoom(activeRoom);
      setTimeout(() => setTransitioning(false), 60);
    }, 420);
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
      <Canvas shadows camera={{ fov: 68, near: 0.1, far: 200 }} dpr={[1, 1.8]}>
        <Suspense fallback={null}>
          {renderedRoom === "lobby" ? (
            <Lobby artifacts={artifacts} />
          ) : (
            <GalleryRoom room={room} artifacts={artifacts} />
          )}
          <PlayerRig room={room} artifacts={artifacts} onEnterDoor={handleEnterDoor} />
          <MiniMapTracker canvasEl={miniMapCanvasRef.current} room={renderedRoom} />
          <PostProcessing />
        </Suspense>
      </Canvas>
      <MiniMapFrame canvasRef={miniMapCanvasRef} />
    </>
  );
}
