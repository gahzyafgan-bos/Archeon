import { useEffect, useState } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";
import { useAudioGuide } from "@/hooks/useAudioGuide";
import { eyeLensCenterShift } from "@/utils/vrOptics";
import { VR_DIAG_ENABLED, vrDiag } from "@/utils/vrDiagnostics";

/**
 * Dev-only numbers, on screen, inside each eye.
 *
 * The console is not reachable from inside a headset without a USB cable and
 * chrome://inspect, and the whole point of the audit is to read these while the
 * head is actually moving — so the measurements are drawn where they can simply
 * be screenshotted. Mirrored per eye like everything else here: an overlay that
 * appears in one eye only is a binocular-rivalry source, which is the opposite
 * of what we are trying to measure.
 *
 * Sampled at 4Hz from the mutable diagnostic singleton rather than subscribed
 * per frame — a React render per frame would distort the frame time on screen.
 */
function VrDiagReadout() {
  const [frame, setFrame] = useState(vrDiag.frame);

  useEffect(() => {
    if (!VR_DIAG_ENABLED) return;
    const id = setInterval(() => setFrame({ ...(vrDiag.frame ?? ({} as never)) }), 250);
    return () => clearInterval(id);
  }, []);

  if (!VR_DIAG_ENABLED || !frame || !frame.bufferWidth) return null;

  return (
    <div className="absolute top-6 left-0 right-0 text-center text-[7px] leading-tight font-mono text-museum-gold/70">
      <p>
        {frame.fps.toFixed(0)}fps {frame.frameMs.toFixed(1)}ms · putar{" "}
        {frame.yawVelDegPerSec.toFixed(0)}°/s
      </p>
      <p>
        px/mata {frame.pxPerEyeRatio.toFixed(2)} · di pusat{" "}
        {frame.pxPerEyeRatioAtCenter.toFixed(2)} · msaa {frame.rtSamples}
      </p>
      <p>
        rt {frame.rtWidth}×{frame.rtHeight} · layar/mata{" "}
        {Math.round((frame.cssWidth * frame.devicePixelRatio) / 2)}px
      </p>
      <p>
        Δyaw {frame.yawDeltaDeg.toFixed(4)}° · Δvert{" "}
        {(frame.measuredEyeVerticalOffsetM * 1000).toFixed(3)}mm
      </p>
      <p>
        {frame.drawCalls} calls · {(frame.triangles / 1000).toFixed(0)}k tris ·{" "}
        {frame.shadowPassesPerFrame}× shadow
      </p>
    </div>
  );
}

function EyeOverlay({ eye }: { eye: "left" | "right" }) {
  const nearbyArtifact = useMuseumStore((s) => s.nearbyArtifact);
  const focusedArtifact = useMuseumStore((s) => s.focusedArtifact);
  const lensSeparationMm = useMuseumStore((s) => s.settings.vrLensSeparationMm);
  const screenWidthMm = useMuseumStore((s) => s.settings.vrScreenWidthMm);

  // Sit on the lens axis, not in the middle of this half of the screen.
  //
  // The rendered world already does — CardboardStereoView shifts each eye's
  // frustum and distortion centre inboard by eyeLensCenterShift. This overlay
  // is DOM drawn on top of the canvas, so it does not go through any of that,
  // and a plain 50/50 flex split left the crosshair off-axis by the same shift
  // in each eye, mirrored. The two crosshairs therefore sat ~9mm FURTHER apart
  // than the lenses, and the crosshair is the one thing the visitor is asked to
  // look at: the eyes have to diverge to fuse it, which is impossible, so
  // either the reticle doubles or fusing it pulls the whole world apart.
  //
  // shift is a fraction of this half-viewport's HALF-width, and one half of the
  // screen is 50vw wide, so its half-width is 25vw.
  const shift = eyeLensCenterShift(screenWidthMm, lensSeparationMm);
  const inboard = eye === "left" ? shift : -shift;

  return (
    <div
      className="relative flex-1 h-full flex items-center justify-center"
      style={{ transform: `translateX(calc(${inboard} * 25vw))` }}
    >
      {/* Crosshair to help the eye focus while looking around */}
      <div className="w-3 h-3 rounded-full border border-museum-bone/60" />

      <VrDiagReadout />

      {/* Control hints live inside each eye rather than once across the middle
          of the screen: a single centred strip lands on the inner edge of both
          viewports, which is exactly where a Cardboard lens shows least. */}
      <div className="absolute bottom-2 left-0 right-0 text-center px-2 text-museum-mist/45 text-[8px] tracking-widest uppercase leading-relaxed">
        <p>Start = keluar · Select = kalibrasi arah</p>
        <p>D-pad ◀ ▶ = jarak lensa {lensSeparationMm}mm</p>
      </div>

      {/* Nothing is drawn while an artifact is focused: VRInfoPanel now shows
          the name and description as geometry inside the scene, where the
          stereo camera reaches both eyes. Repeating it here would double the
          text and put one copy across the seam between the viewports. */}
      {focusedArtifact ? null : (
        nearbyArtifact && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center px-3 animate-slide-up-fade">
            <p className="text-museum-gold text-[10px] tracking-widest uppercase">Tekan A untuk melihat</p>
            <p className="text-museum-bone text-xs mt-0.5">{nearbyArtifact.nama}</p>
          </div>
        )
      )}
    </div>
  );
}

/**
 * Minimal, entirely touch-free overlay shown while VR mode is active —
 * mirrored across both eye viewports so it reads correctly through the
 * Cardboard lenses. Also owns the fullscreen/orientation-lock cleanup that
 * needs to fire whenever VR mode is switched off (gamepad Start button).
 */
export function VRHud() {
  const isVRMode = useMuseumStore((s) => s.isVRMode);
  const focusedArtifact = useMuseumStore((s) => s.focusedArtifact);

  // InfoPanel's own 360°-drag panel is unusable without touch, so in VR mode
  // the audio guide plays itself as soon as an artifact is focused instead —
  // see the matching `isVRMode ? null : focusedArtifact` guard in InfoPanel.
  useAudioGuide(isVRMode ? focusedArtifact : null, isVRMode);

  useEffect(() => {
    if (isVRMode) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    screen.orientation?.unlock?.();
  }, [isVRMode]);

  if (!isVRMode) return null;

  return (
    // Height comes from --app-height (visualViewport) with a 100dvh fallback,
    // NOT from `inset-0`. On a mobile browser that can't be taken fullscreen,
    // the layout viewport is taller than the visible area, so `inset-0` would
    // size this overlay to a box that runs under the address bar — the two eye
    // halves would then be centred on a different mid-line than the canvas's,
    // and the reticle/control text would drift off each lens axis. Same source
    // of truth as #root and the <Canvas> wrapper (see useViewportHeight).
    <div
      className="fixed left-0 top-0 w-full z-40 flex pointer-events-none"
      style={{ height: "var(--app-height, 100dvh)" }}
    >
      <EyeOverlay eye="left" />
      <div className="w-px h-full bg-white/5" />
      <EyeOverlay eye="right" />
    </div>
  );
}
