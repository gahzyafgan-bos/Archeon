/**
 * Dev-only instrumentation for the Cardboard stereo path.
 *
 * Exists to answer four questions with NUMBERS instead of screenshots:
 *   1. do both eyes render from the SAME head pose? (yaw/pitch delta must be 0)
 *   2. how many pixels does each eye actually get, against the physical pixels
 *      the phone shows it? (the "blocky/voxel" complaint)
 *   3. can the two images fuse at all? (vertical disparity must be 0)
 *   4. what does one VR frame cost against one mono frame?
 *
 * Everything here is gated behind import.meta.env.DEV, which Vite statically
 * replaces, so the whole module tree-shakes out of a production build.
 *
 * Published as a mutable singleton read imperatively — deliberately the same
 * pattern as `vrLookSource` in useDeviceOrientationLook, and for the same
 * reason: a store write per frame re-renders every subscriber inside the
 * Canvas, which would change the very frame time we are trying to measure.
 */

export const VR_DIAG_ENABLED = import.meta.env.DEV;

export interface VrDiagFrame {
  // --- timing ---
  fps: number;
  frameMs: number;
  /** How fast the head is turning right now — the yaw delta only matters while moving. */
  yawVelDegPerSec: number;

  // --- resolution (A.3) ---
  devicePixelRatio: number;
  rendererPixelRatio: number;
  cssWidth: number;
  cssHeight: number;
  bufferWidth: number;
  bufferHeight: number;
  preset: string;
  presetDprMax: number;
  renderScale: number;
  rtWidth: number;
  rtHeight: number;
  eyeViewportWidth: number;
  eyeViewportHeight: number;
  /** rendered px per eye / physical screen px per eye. < 1 means upscaling. */
  pxPerEyeRatio: number;
  /** Same ratio at the lens axis, where barrel distortion magnifies the source. */
  pxPerEyeRatioAtCenter: number;
  /** How much the barrel pass magnifies the middle of the image. */
  centerMagnification: number;

  // --- render target quality (A.3 / H3 / H4 / H6) ---
  rtSamples: number;
  rtMinFilter: string;
  rtMagFilter: string;
  rtGenerateMipmaps: boolean;
  rtColorSpace: string;
  rtFormat: string;
  rtType: string;
  canvasAntialias: boolean;

  // --- eye cameras (A.2 / A.6 / A.7) ---
  fovVertical: number;
  fovHorizontal: number;
  eyeAspect: number;
  near: number;
  far: number;
  /** THE separator test: must be exactly 0, including mid-turn. */
  yawDeltaDeg: number;
  pitchDeltaDeg: number;
  rollDeltaDeg: number;
  /** Eye separation measured back out of the two world matrices, in metres. */
  measuredEyeSepM: number;
  /** Eye offset along the head's local UP axis. Anything but 0 = vertical disparity. */
  measuredEyeVerticalOffsetM: number;
  /** Eye offset along the head's local FORWARD axis. Anything but 0 = one eye ahead. */
  measuredEyeDepthOffsetM: number;
  /** Projection y-scale and y-skew per eye — must match, or the pair cannot fuse vertically. */
  projYScaleDeltaAbs: number;
  projYSkewDeltaAbs: number;
  frustumSkewL: number;
  frustumSkewR: number;
  lensCenterShift: number;

  // --- per-frame cost (A.4 / H5) ---
  drawCalls: number;
  triangles: number;
  programs: number;
  /** How many times three re-rendered the shadow maps this frame. */
  shadowPassesPerFrame: number;
  shadowsEnabled: boolean;
  shadowAutoUpdate: boolean;
}

interface VrDiagState {
  frame: VrDiagFrame | null;
  /** Set once if the two eyes are ever found on different poses. */
  poseDesyncSeen: boolean;
  worstYawDeltaDeg: number;
}

export const vrDiag: VrDiagState = {
  frame: null,
  poseDesyncSeen: false,
  worstYawDeltaDeg: 0,
};

/** Anything above this is a real pose desync, not float noise from two matrix decompositions. */
const YAW_DESYNC_EPSILON_DEG = 1e-4;

export function publishVrDiagFrame(frame: VrDiagFrame) {
  if (!VR_DIAG_ENABLED) return;
  vrDiag.frame = frame;

  const yawDelta = Math.abs(frame.yawDeltaDeg);
  if (yawDelta > vrDiag.worstYawDeltaDeg) vrDiag.worstYawDeltaDeg = yawDelta;

  // The assertion the prompt asks for: this bug is never allowed to be silent
  // again. Fires once per session, not once per frame — a console.error in the
  // render loop would itself cost frame time and bury everything else.
  if (yawDelta > YAW_DESYNC_EPSILON_DEG && !vrDiag.poseDesyncSeen) {
    vrDiag.poseDesyncSeen = true;
    console.error(
      `[VR] POSE DESYNC: the two eyes rendered from different head poses. ` +
        `yaw delta = ${frame.yawDeltaDeg.toFixed(5)}°, pitch delta = ${frame.pitchDeltaDeg.toFixed(5)}°, ` +
        `head turning at ${frame.yawVelDegPerSec.toFixed(1)}°/s, frame = ${frame.frameMs.toFixed(1)}ms. ` +
        `Both eyes must come from ONE snapshot per frame.`
    );
  }
}

/** Full one-shot dump in the format the audit report asks for. */
export function dumpVrDiag(label = "snapshot") {
  if (!VR_DIAG_ENABLED) return;
  const f = vrDiag.frame;
  if (!f) {
    console.warn("[VR] no diagnostic frame captured yet — enter Mode VR first.");
    return;
  }

  const verdict =
    f.pxPerEyeRatio < 1
      ? `UPSCALED from ${(f.pxPerEyeRatio * 100).toFixed(0)}% of native`
      : f.pxPerEyeRatio < 1.1
        ? "native, but short of the 1.1-1.4 a barrel pass wants"
        : "OK for a distorted view";

  // Dev-only diagnostic dump, invoked by hand from the console. Gated by
  // VR_DIAG_ENABLED at every call site, but the lint rule cannot see that.
  // eslint-disable-next-line no-console
  console.log(
    [
      ``,
      `================ [VR DIAGNOSTIK — ${label}] ================`,
      `A.2  POSE PER FRAME (harus 0 semua, termasuk saat kepala diputar cepat)`,
      `     yaw delta antar-mata        : ${f.yawDeltaDeg.toFixed(6)}°`,
      `     pitch delta antar-mata      : ${f.pitchDeltaDeg.toFixed(6)}°`,
      `     roll delta antar-mata       : ${f.rollDeltaDeg.toFixed(6)}°`,
      `     yaw delta TERBURUK sesi ini : ${vrDiag.worstYawDeltaDeg.toFixed(6)}°`,
      `     kecepatan putar kepala      : ${f.yawVelDegPerSec.toFixed(1)}°/s`,
      `     frame time                  : ${f.frameMs.toFixed(1)}ms (${f.fps.toFixed(1)} FPS)`,
      ``,
      `A.3  RESOLUSI`,
      `     window.devicePixelRatio     : ${f.devicePixelRatio}`,
      `     ukuran CSS canvas           : ${f.cssWidth} × ${f.cssHeight}`,
      `     gl.getDrawingBufferSize()   : ${f.bufferWidth} × ${f.bufferHeight}`,
      `     gl.getPixelRatio()          : ${f.rendererPixelRatio}`,
      `     preset grafik aktif         : ${f.preset} (dpr max preset = ${f.presetDprMax})`,
      `     dpr yang dipaksa mode VR    : 1  ← preset TIDAK berpengaruh ke resolusi di VR`,
      `     RENDER_SCALE khusus VR      : ${f.renderScale}`,
      `     ukuran render target/mata   : ${f.rtWidth} × ${f.rtHeight}`,
      `     viewport per mata (buffer)  : ${f.eyeViewportWidth} × ${f.eyeViewportHeight}`,
      `     px per mata / px layar/mata : ${f.pxPerEyeRatio.toFixed(3)}  ← ${verdict}`,
      `     perbesaran barrel di tengah : ${f.centerMagnification.toFixed(3)}×`,
      `     rasio efektif di pusat lensa: ${f.pxPerEyeRatioAtCenter.toFixed(3)}  ← yang benar-benar dilihat mata`,
      `     rt.samples (MSAA)           : ${f.rtSamples}${f.rtSamples === 0 ? "  ← TANPA MSAA" : ""}`,
      `     rt min/magFilter            : ${f.rtMinFilter} / ${f.rtMagFilter}`,
      `     rt.generateMipmaps          : ${f.rtGenerateMipmaps}`,
      `     rt.texture.colorSpace       : ${f.rtColorSpace || "(linear/no-color-space)"}`,
      `     format & type render target : ${f.rtFormat} / ${f.rtType}`,
      `     canvas context antialias    : ${f.canvasAntialias}  ← tidak berlaku saat render ke RT`,
      ``,
      `A.4  BIAYA PER FRAME`,
      `     draw calls                  : ${f.drawCalls}`,
      `     triangles                   : ${f.triangles}`,
      `     programs (shader)           : ${f.programs}`,
      `     pass shadow map per frame   : ${f.shadowPassesPerFrame}${f.shadowPassesPerFrame > 1 ? "  ← 2× padahal cukup 1×" : ""}`,
      `     shadows enabled / autoUpdate: ${f.shadowsEnabled} / ${f.shadowAutoUpdate}`,
      ``,
      `A.6/A.7  GEOMETRI KAMERA MATA`,
      `     fov vertikal / horizontal   : ${f.fovVertical.toFixed(2)}° / ${f.fovHorizontal.toFixed(2)}°`,
      `     aspect per mata             : ${f.eyeAspect.toFixed(4)}`,
      `     near / far                  : ${f.near} / ${f.far}`,
      `     jarak antar-mata terukur    : ${(f.measuredEyeSepM * 1000).toFixed(2)} mm`,
      `     offset VERTIKAL antar-mata  : ${(f.measuredEyeVerticalOffsetM * 1000).toFixed(4)} mm  ← WAJIB 0`,
      `     offset KEDALAMAN antar-mata : ${(f.measuredEyeDepthOffsetM * 1000).toFixed(4)} mm  ← WAJIB 0`,
      `     beda proyeksi skala-Y       : ${f.projYScaleDeltaAbs.toExponential(2)}  ← WAJIB 0`,
      `     beda proyeksi skew-Y        : ${f.projYSkewDeltaAbs.toExponential(2)}  ← WAJIB 0`,
      `     frustum skew kiri / kanan   : ${f.frustumSkewL.toFixed(5)} / ${f.frustumSkewR.toFixed(5)}`,
      `     pergeseran pusat lensa      : ${f.lensCenterShift.toFixed(5)}`,
      `============================================================`,
      ``,
    ].join("\n")
  );
}

/**
 * Live counts of everything Mode VR sets up and is supposed to tear down again.
 *
 * The symptom this exists for is "flicker + double, worse the second time you
 * enter VR". That shape — fine on the first cycle, degrading on every one after
 * — is what a leak looks like: a `deviceorientation` handler that was never
 * removed writes head pose alongside the new one and the two fight for the same
 * value each frame; a render loop that was never cancelled draws into the same
 * canvas as the live one. Both are invisible in a screenshot and obvious in a
 * counter, so the counter is the test: enter and leave VR five times and every
 * number below must read exactly the same as after the first.
 */
export interface VrLifecycleCounts {
  /** deviceorientation handlers currently attached. Must be 1 in VR, 0 outside. */
  orientationListeners: number;
  /** Stereo frame loops currently registered. Must be 1 in VR, 0 outside. */
  stereoLoops: number;
  /** Eye render targets allocated and not yet disposed. Must be 2 in VR, 0 outside. */
  eyeRenderTargets: number;
  /** Cumulative, never reset — how many times each was ever created this session. */
  totalOrientationListenersEver: number;
  totalStereoLoopsEver: number;
  totalEyeRenderTargetsEver: number;
}

export const vrLifecycle: VrLifecycleCounts = {
  orientationListeners: 0,
  stereoLoops: 0,
  eyeRenderTargets: 0,
  totalOrientationListenersEver: 0,
  totalStereoLoopsEver: 0,
  totalEyeRenderTargetsEver: 0,
};

type LiveKey = "orientationListeners" | "stereoLoops" | "eyeRenderTargets";
const TOTAL_KEY: Record<LiveKey, keyof VrLifecycleCounts> = {
  orientationListeners: "totalOrientationListenersEver",
  stereoLoops: "totalStereoLoopsEver",
  eyeRenderTargets: "totalEyeRenderTargetsEver",
};

/** `delta` is +1 on setup and -1 on teardown. */
export function countVrResource(key: LiveKey, delta: 1 | -1) {
  if (!VR_DIAG_ENABLED) return;
  vrLifecycle[key] += delta;
  if (delta === 1) vrLifecycle[TOTAL_KEY[key]] += 1;
  if (vrLifecycle[key] < 0) {
    console.error(`[VR] ${key} went negative (${vrLifecycle[key]}) — teardown ran without a matching setup.`);
  }
}

/**
 * Reads the counters back with the expected values for the current mode. Call
 * from the console after N enter/leave cycles — the numbers must not depend
 * on N.
 */
export function dumpVrLifecycle(inVR = false) {
  if (!VR_DIAG_ENABLED) return;
  const expect = inVR
    ? { orientationListeners: 1, stereoLoops: 1, eyeRenderTargets: 2 }
    : { orientationListeners: 0, stereoLoops: 0, eyeRenderTargets: 0 };
  const row = (key: LiveKey, label: string) => {
    const got = vrLifecycle[key];
    const ok = got === expect[key];
    return `     ${label.padEnd(28)}: ${got} (harus ${expect[key]}) ${ok ? "OK" : "← BOCOR"}`;
  };
  // eslint-disable-next-line no-console
  console.log(
    [
      ``,
      `============ [VR SIKLUS HIDUP — ${inVR ? "di dalam VR" : "di luar VR"}] ============`,
      row("orientationListeners", "listener deviceorientation"),
      row("stereoLoops", "loop render stereo"),
      row("eyeRenderTargets", "render target mata"),
      `     dibuat total sesi ini       : listener ${vrLifecycle.totalOrientationListenersEver}, ` +
        `loop ${vrLifecycle.totalStereoLoopsEver}, rt ${vrLifecycle.totalEyeRenderTargetsEver}`,
      `============================================================`,
      ``,
    ].join("\n")
  );
}

// Reachable from a remote-debug console (chrome://inspect) while the phone is
// in the headset, where there is no keyboard to trigger anything.
if (VR_DIAG_ENABLED && typeof window !== "undefined") {
  (window as unknown as { vrDiag?: unknown }).vrDiag = vrDiag;
  (window as unknown as { dumpVrDiag?: unknown }).dumpVrDiag = dumpVrDiag;
  (window as unknown as { vrLifecycle?: unknown }).vrLifecycle = vrLifecycle;
  (window as unknown as { dumpVrLifecycle?: unknown }).dumpVrLifecycle = dumpVrLifecycle;
}
