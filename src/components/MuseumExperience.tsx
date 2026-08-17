import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Stats, PerformanceMonitor, AdaptiveDpr, AdaptiveEvents, Preload, useProgress } from "@react-three/drei";
import { useMuseumStore, type RoomId } from "@/store/useMuseumStore";
import { ROOM_CONFIGS, type Door } from "@/data/roomConfig";
import { fetchArtifactsByRoom, hasRealModel } from "@/data/artifactRepository";
import type { Artifact } from "@/types/artifact";
import { PlayerRig } from "./PlayerRig";
import { Hall } from "./rooms/Hall";
import { useSoundtrack } from "@/hooks/useSoundtrack";
import { useDeviceDetection } from "@/hooks/useDeviceDetection";
import { useGraphicsPreset } from "@/hooks/useGraphicsPreset";
import { useAdjacentHallPreload } from "@/hooks/useAdjacentHallPreload";
import { useOrderedModelPreload } from "@/hooks/useOrderedModelPreload";
import { initKTX2Support } from "@/utils/modelLoader";
import { MiniMapFrame, MiniMapTracker } from "./ui/MiniMap";
import { roomCrossfadeMs } from "./ui/RoomTransition";
import { PostProcessing } from "./PostProcessing";
import { CardboardStereoView } from "./vr/CardboardStereoView";
import { VRInfoPanel } from "./vr/VRInfoPanel";
import { WebGLContextGuard } from "./WebGLContextGuard";

/**
 * How long the loading progress may sit completely still before the app admits
 * something is wrong and offers the visitor a way out.
 *
 * Generous on purpose: Hall 1 ships ~38 MB of models, and on a slow connection
 * a single large `.glb` can legitimately take a while between progress ticks.
 * The number this has to beat is not "slow", it is "never" — a request that has
 * stopped delivering bytes entirely.
 */
const LOAD_STALL_TIMEOUT_MS = 20000;

/**
 * Longest a visitor is made to wait before being let into the museum, counted
 * from the moment the artifact list is known.
 *
 * Comfortably long enough that a normal broadband or 4G visitor never sees it
 * fire — Hall 1 settles well inside this on anything reasonable, so the
 * no-pop-in behaviour is preserved for the common case. It only takes effect
 * on the connections where the alternative was minutes. See where it is used.
 */
const MAX_LOADING_WAIT_MS = 12000;

/**
 * Keeps only the artifacts that actually have a real 3D model to show, so
 * placeholders for pieces still awaiting a `.glb` are never mounted (no empty
 * pedestal, no `E` anchor) — see hasRealModel. The full dataset stays intact
 * in artifacts.json; this is purely a render-time filter. Dev-only: logs which
 * ids are still waiting on a model so pending asset work stays trackable
 * (console only, never surfaced to end users).
 */
function renderableArtifacts(data: Artifact[]): Artifact[] {
  const shown = data.filter(hasRealModel);
  if (import.meta.env.DEV) {
    const waiting = data.filter((a) => !hasRealModel(a));
    if (waiting.length) {
      // eslint-disable-next-line no-console
      console.info(
        `[artefak] ${waiting.length} artefak disembunyikan (menunggu model 3D):`,
        waiting.map((a) => a.id)
      );
    }
  }
  return shown;
}

/**
 * Detects the renderer's supported GPU texture formats for the shared
 * KTX2Loader, once, from inside the Canvas (where the WebGLRenderer exists).
 * Must run before any model with KTX2 (Basis) textures is decoded — mounted
 * ahead of <Hall>, and the cross-hall preloader only kicks in after the first
 * hall settles, so support is always ready in time.
 */
function KTX2Support() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    initKTX2Support(gl);
  }, [gl]);
  return null;
}

/**
 * Owns the renderer's pixel ratio across a VR toggle, and holds the stereo
 * view back until the canvas it is about to draw into has stopped changing
 * size.
 *
 * Two things collide the moment Mode VR is switched on, and together they are
 * the "double + flicker on the way in" that survived the stereo-geometry fixes:
 *
 *  1. `<AdaptiveDpr/>` unmounts (it is mono-only), and drei's unmount handler
 *     calls `setDpr(viewport.initialDpr)` — the MONO pixel ratio captured when
 *     the Canvas first mounted. That runs as a passive effect, i.e. AFTER the
 *     Canvas has already applied its `dpr={vrDpr}` prop in a layout effect. So
 *     the renderer ends the entry commit at the wrong resolution and is
 *     corrected again on the next render: two full drawing-buffer resizes,
 *     back to back, exactly at the transition. Re-asserting it here fixes it
 *     for good, because a passive effect on a component that STAYS MOUNTED runs
 *     after the unmounting one's cleanup, every time.
 *  2. A drawing-buffer resize invalidates the eye render targets, which
 *     CardboardStereoView re-sizes from inside its own frame callback. Frames
 *     composited while those numbers disagree are the visible flicker — and
 *     each eye briefly showing a differently-scaled image is what reads as
 *     "double".
 *
 * So: settle the size first, then start drawing stereo. Until then r3f's
 * ordinary mono render keeps the screen alive, which is the right thing to be
 * looking at while the phone is still being slotted into the viewer anyway.
 */
function VRStereoStage({ dpr }: { dpr: number | [number, number] }) {
  const setDpr = useThree((s) => s.setDpr);
  const size = useThree((s) => s.size);
  const viewportDpr = useThree((s) => s.viewport.dpr);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDpr(dpr);
  }, [setDpr, dpr]);

  useEffect(() => {
    // Two frames, not one: the first lets the resize land in the renderer, the
    // second lets three's own buffers follow it.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
    // Re-armed whenever the target size changes, so an orientation flip during
    // entry can't leave stereo running against a stale render target. Once
    // `ready` is true it stays true — CardboardStereoView tracks size itself
    // from then on, and unmounting it mid-session would be a worse flicker
    // than the one being avoided.
  }, [size.width, size.height, viewportDpr]);

  return ready ? <CardboardStereoView /> : null;
}

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
  const setTransitioning = useMuseumStore((s) => s.setTransitioning);
  const setPendingSpawnPoint = useMuseumStore((s) => s.setPendingSpawnPoint);
  const finishLoading = useMuseumStore((s) => s.finishLoading);
  const setLoadProgress = useMuseumStore((s) => s.setLoadProgress);
  const setLoadError = useMuseumStore((s) => s.setLoadError);
  const isLoading = useMuseumStore((s) => s.isLoading);
  const transitionSpeed = useMuseumStore((s) => s.settings.roomTransitionSpeed);

  const isVRMode = useMuseumStore((s) => s.isVRMode);
  const graphicsPreset = useGraphicsPreset();

  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [renderedRoom, setRenderedRoom] = useState<RoomId>(activeRoom);
  const [dataReady, setDataReady] = useState(false);

  useDeviceDetection();
  // One continuous background soundtrack for the whole visit — plays looped and
  // uninterrupted across hall changes (unlike the per-hall useAmbience).
  useSoundtrack();

  // Real loading progress (spec 4a.3: "loading screen dengan progress
  // nyata") — drei's useProgress tracks THREE.DefaultLoadingManager, i.e.
  // the actual GLTF/texture loads Hall 1's artifacts kick off, not a fake
  // timer. Works outside the Canvas too (plain zustand subscription), so it
  // can drive the DOM LoadingScreen directly.
  const { progress: glProgress, active: glActive } = useProgress();

  // Warm THIS hall's models, nearest to the entrance first. Same request set
  // as before and just as eager; only the order changed. See the hook.
  useOrderedModelPreload(artifacts, ROOM_CONFIGS[renderedRoom]);

  // Warm the *next* hall's heavy models during idle time — but only once the
  // current hall has settled (dataReady && nothing still loading), so this
  // never steals bandwidth/CPU from the first paint. See the hook's doc.
  useAdjacentHallPreload(renderedRoom, dataReady && !glActive);

  // Initial load: fetch lobby artifacts (gates isLoading together with the
  // real asset progress above) so the scene never shows before both the
  // artifact list AND its critical assets are ready.
  useEffect(() => {
    fetchArtifactsByRoom("hall-1").then((data) => {
      setArtifacts(renderableArtifacts(data));
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

  /**
   * Ceiling on how long a visitor may be held at the loading screen.
   *
   * The gate above waits for every one of Hall 1's models. That is 38 MB, and
   * on the connections this museum will actually meet it is not a wait, it is
   * a wall: measured at ~13.9 minutes on Slow 3G, and ~12.4 minutes for a
   * Wi-Fi network shared by thirty visitors at once. Nobody stands in a museum
   * lobby staring at a progress bar for thirteen minutes.
   *
   * Letting them in early is safe here specifically because each artifact
   * already carries its OWN <Suspense> and its own error boundary (see
   * ArtifactMesh): a model that has not arrived yet simply is not in the room
   * until it is, and the hall, floor, lighting and signage are all procedural
   * geometry that needs no download at all. So the cost of entering early is
   * that a few pieces fade in while the visitor walks toward them — and the
   * benefit is that they are walking at all.
   *
   * Only armed once the artifact list itself is in, because entering a hall
   * whose contents are unknown would place the visitor in a genuinely empty
   * room rather than a filling one.
   */
  useEffect(() => {
    if (!isLoading || !dataReady) return;
    const t = setTimeout(finishLoading, MAX_LOADING_WAIT_MS);
    return () => clearTimeout(t);
  }, [isLoading, dataReady, finishLoading]);

  /**
   * Watchdog for a load that can no longer finish by itself.
   *
   * The gate above is `dataReady && !glActive`. `glActive` only clears when
   * every request three's loading manager knows about has settled — so a single
   * request that neither succeeds nor fails (the exact behaviour of a dropped
   * mobile connection) holds the loading screen open forever. That is not a
   * hypothetical: switching the network off mid-load left the bar frozen at 94%
   * with nothing on screen to explain it and nothing to press.
   *
   * Two independent signals, because they fail differently:
   *  - `onError` fires when a request is refused outright (404, blocked, CORS).
   *  - the stall timer covers the case with no event at all — the socket simply
   *    stops delivering bytes. Reset on every progress change, so a slow-but-
   *    moving connection is never mistaken for a dead one.
   */
  useEffect(() => {
    const manager = THREE.DefaultLoadingManager;
    const previousOnError = manager.onError;
    manager.onError = (url) => {
      previousOnError?.(url);
      setLoadError("failed");
    };
    return () => {
      manager.onError = previousOnError;
    };
  }, [setLoadError]);

  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setLoadError("stalled"), LOAD_STALL_TIMEOUT_MS);
    return () => clearTimeout(timer);
    // Re-armed on every progress change: the timeout measures time since the
    // last byte of progress, not time since the page opened.
  }, [isLoading, glProgress, dataReady, setLoadError]);

  // Brief crossfade whenever the active hall changes — the archway is an
  // open walk-through now, so this only needs to be long enough to hide the
  // new hall's artifacts popping in, not a scene-change beat (see RoomTransition.tsx).
  useEffect(() => {
    if (activeRoom === renderedRoom) return;
    setTransitioning(true);
    // Derived from the overlay's own duration rather than a second hardcoded
    // 130 — the swap has to land while the screen is actually dimmed, and two
    // independent numbers for one beat is how they drift apart. Also why the
    // user's transition-speed setting reaches this timing at all.
    const fadeOut = setTimeout(async () => {
      const data = await fetchArtifactsByRoom(activeRoom);
      setArtifacts(renderableArtifacts(data));
      setRenderedRoom(activeRoom);
      setTimeout(() => setTransitioning(false), 30);
    }, Math.max(30, roomCrossfadeMs(transitionSpeed) - 20));
    return () => clearTimeout(fadeOut);
  }, [activeRoom, renderedRoom, setTransitioning, transitionSpeed]);

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
        // far was a fixed 200 much deeper than either hall (max ~35m
        // across); a preset-driven, shorter far plane on mobile (spec 4b.5
        // "fog/draw distance dipendekkan") gives three.js's own frustum
        // culling a tighter volume to reject geometry against, on top of
        // fog's purely visual falloff.
        //
        // `near` was 0.1, and that is the single biggest cause of the shimmer
        // on the floor. Depth precision is dominated by the near plane, not
        // the far one: resolvable depth at distance z is roughly
        // z² / (near × depthBufferSteps). Across a 24 m hall at grazing angles
        // — which is exactly how a standing visitor sees the floor — a phone
        // with a 16-bit depth buffer resolves about 3 cm at the far wall with
        // near = 0.1. The floor's inlays, borders and medallions are stacked
        // 5-20 mm apart, so they were well inside one depth step and flickered
        // against each other and against the floor.
        //
        // 0.25 m is a 2.5x precision gain and costs nothing visible: nothing
        // ever gets that close to the eye. Artifact focus parks the camera at
        // least 1.5 m from a piece (see PlayerRig), and the wall clamp keeps
        // the player 0.5 m inside the room bound while the wall's inner face
        // is only 0.15 m outside it — 0.35 m away, still 10 cm clear of the
        // near plane. Paired with the polygonOffset the floor decals now carry
        // (see RoomShell), which fixes the same problem from the other side.
        camera={{ fov: 68, near: 0.25, far: graphicsPreset.cameraFar }}
        // Both branches come from the SAME preset table — VR has its own row
        // (vrDpr), it does not have its own rule. What used to be here was
        // `isVRMode ? [1, 1] : ...`, which threw devicePixelRatio away: on a
        // DPR 2.6-3 phone the canvas was rasterised at roughly a third of the
        // panel's resolution and then stretched back over it, at EVERY quality
        // tier, so picking Tinggi changed the cost of a VR frame without
        // changing a single pixel of its resolution. This one is the final
        // image's grid; the expensive per-eye scene resolution is vrEyeScale,
        // applied in CardboardStereoView. See graphicsPresets.ts.
        dpr={isVRMode ? graphicsPreset.vrDpr : graphicsPreset.dpr}
        // R3F defaults to ACESFilmicToneMapping, which rolls off highlights
        // naturally instead of clipping to white. Exposure follows the active
        // preset — Rendah runs slightly hotter to compensate for its
        // disabled color-grading composer (see graphicsPresets.ts); MSAA is
        // off at Rendah too, alongside the composer, for the same reason.
        gl={{ toneMappingExposure: graphicsPreset.toneMappingExposure, antialias: graphicsPreset.antialias }}
        /**
         * How far AdaptiveDpr is allowed to drop resolution while regressed.
         *
         * r3f's default floor is 0.5, i.e. half the pixel ratio — a QUARTER of
         * the pixels — and r3f regresses on every pointer move, so that floor
         * was being hit simply by looking around. Even resolved smoothly (the
         * `pixelated` flag is gone, see AdaptiveDpr below) a 4x pixel drop is
         * plainly visible as the image going soft the instant the visitor
         * moves and sharpening again when they stop.
         *
         * 0.75 keeps the protection that matters — a device genuinely unable
         * to hold frame rate still gets relief, and it compounds with the
         * preset's own dpr ceiling — while making the step small enough that
         * the visitor is not watching the museum change quality every time
         * they turn their head.
         */
        performance={{ min: 0.75 }}
      >
        {/* Safety net on top of the manual preset: if FPS actually drops,
            AdaptiveDpr steps the renderer's pixel ratio down within the
            active preset's [min,max] bounds (and back up once stable)
            instead of ever risking a sustained stutter. Skipped in VR —
            CardboardStereoView already manages its own eye-texture
            resolution and is already locked to the Rendah preset floor. */}
        <KTX2Support />
        {/* Sits outside <Suspense> on purpose: a lost context has to be caught
            even while models are still streaming in, which is exactly when a
            low-memory phone is most likely to lose one. */}
        <WebGLContextGuard />
        <PerformanceMonitor>
          <Suspense fallback={null}>
            <Hall hall={room} artifacts={artifacts} />
            <PlayerRig room={room} artifacts={artifacts} onEnterDoor={handleEnterDoor} />
            {!isVRMode && (
              <MiniMapTracker
                canvasEl={miniMapCanvasRef.current}
                room={renderedRoom}
                artifacts={artifacts}
              />
            )}
            {/* Artifact info lives IN the scene while VR is active, so the
                stereo camera draws it into both eyes with the rest of the
                world — a DOM panel can't reach either eye viewport. Mounted
                before CardboardStereoView so it is part of the scene the eye
                passes render. */}
            <VRInfoPanel />
            {isVRMode
              ? <VRStereoStage dpr={graphicsPreset.vrDpr} />
              : graphicsPreset.postProcessingEnabled && <PostProcessing />}
          </Suspense>
          {!isVRMode && (
            <>
              {/*
                `pixelated` was here, and it is what the visitor was seeing as
                "garis putih glitch, cuma pas kamera gerak, kalau diam hilang".

                The mechanism: r3f calls `performance.regress()` on every
                pointer move, so looking around puts the app in its regressed
                state. AdaptiveDpr answers that by dropping the renderer's
                pixel ratio — and `pixelated` additionally sets
                `image-rendering: pixelated` on the canvas, so the low-res
                buffer is blown back up to full size with NEAREST-NEIGHBOUR
                sampling. Nearest-neighbour upscaling of a moving image is
                exactly how you manufacture crawling, broken white edges along
                every high-contrast boundary — the archway frame against the
                dark opening being the worst case in this museum. Stop moving,
                the debounce expires, full resolution returns, and it is clean
                again. That on/off-with-motion signature is the tell.

                Dropping the flag keeps the safety net and loses the artefact:
                the resolution still steps down under load, it is just resolved
                smoothly on the way back up, which reads as a touch soft rather
                than as broken geometry.
              */}
              <AdaptiveDpr />
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
            compiles shaders on demand as each object is first drawn.
            Re-keyed per hall + artifact count so it recompiles when hall-2's
            (heavier GLTF) materials mount at the archway crossfade, instead of
            only ever covering hall-1 and letting hall-2's shaders compile
            on-demand mid-walk (the classic "hitch when the big arca first
            comes into view"). The remount runs during the transition beat, a
            controlled moment, not while the player is moving. */}
        <Preload key={`preload-${renderedRoom}-${artifacts.length}`} all />
      </Canvas>
      {/* Hidden in VR mode: a single unmirrored corner overlay doesn't read correctly split across two eye viewports. */}
      {!isVRMode && <MiniMapFrame canvasRef={miniMapCanvasRef} artifacts={artifacts} />}
    </>
  );
}
