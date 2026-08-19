import { useEffect, useRef, useState } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";
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
    // Inside the lens circle like everything else here — a readout pinned to
    // the top edge is unreadable through the viewer, which defeats the point of
    // putting it on screen instead of in the console.
    <div className="absolute top-[16%] left-0 right-0 text-center text-[8px] leading-tight font-mono text-museum-gold/75">
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
  const nearbyDoorLabel = useMuseumStore((s) => s.nearbyDoorLabel);
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
          viewports, which is exactly where a Cardboard lens shows least.

          Position is a percentage DOWN FROM THE LENS AXIS, not `bottom-0`. A
          Cardboard lens only shows a circle roughly as wide as the viewport is
          tall, centred on that axis; the bottom edge of the viewport falls
          outside it, where the lens is at its most distorted and dimmest. Text
          pinned to the bottom was therefore being read through the worst part
          of the optic — which is why it looked curved, low-contrast and cut off
          even though nothing warps it (this is DOM, drawn over the canvas, not
          through the distortion shader).

          72% keeps it inside the circle with margin. Size and contrast are up
          too: 8px of 45%-opacity text is legible held at arm's length and not
          through a magnifier 40mm from the eye. The backing plate does more for
          readability here than any font-size change — a lens scatters light
          from the bright scene behind the glyphs. */}
      <div className="absolute top-[72%] left-0 right-0 flex justify-center px-2">
        <div className="rounded-lg bg-black/45 px-2.5 py-1 text-center text-museum-bone/85 text-[10px] tracking-wider uppercase leading-relaxed">
          {/* The touch line comes FIRST and names the exit, because it is the
              only instruction that works for a visitor with no gamepad — which
              is most of them. */}
          <p>Tekan layar sebentar = pilih · tahan = keluar</p>
          <p>Gamepad: A = pilih · Start = keluar · Select = kalibrasi</p>
          <p>D-pad ◀ ▶ = jarak lensa {lensSeparationMm}mm</p>
        </div>
      </div>

      {/* Nothing is drawn while an artifact is focused: VRInfoPanel now shows
          the name and description as geometry inside the scene, where the
          stereo camera reaches both eyes. Repeating it here would double the
          text and put one copy across the seam between the viewports. */}
      {focusedArtifact ? null : (
        nearbyArtifact ? (
          // Also inside the lens circle, and sitting above the control hints
          // rather than near the bottom edge. `left-1/2 -translate-x-1/2` would
          // centre it on the VIEWPORT; this parent is already translated onto
          // the lens axis, so centring within the parent is what keeps it on
          // the axis the eye is actually pointed down.
          <div className="absolute top-[60%] left-0 right-0 flex justify-center px-3 animate-slide-up-fade">
            <div className="rounded-lg bg-black/45 px-3 py-1 text-center">
              <p className="text-museum-gold text-[11px] tracking-widest uppercase">Tekan A untuk melihat</p>
              <p className="text-museum-bone text-sm mt-0.5">{nearbyArtifact.nama}</p>
            </div>
          </div>
        ) : (
          // The archway waits for a deliberate press here too. Inside a headset
          // this matters more than on a flat screen, not less: a visitor who
          // drifts through an opening they never saw coming has no map, no
          // minimap (it is hidden in VR) and no way to work out what happened.
          nearbyDoorLabel && (
            <div className="absolute top-[60%] left-0 right-0 flex justify-center px-3 animate-slide-up-fade">
              <div className="rounded-lg bg-black/45 px-3 py-1 text-center">
                <p className="text-museum-gold text-[11px] tracking-widest uppercase">Tekan A untuk lanjut</p>
                <p className="text-museum-bone text-sm mt-0.5">{nearbyDoorLabel}</p>
              </div>
            </div>
          )
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
/**
 * How long the screen has to be held before VR mode exits.
 *
 * Long enough that the short taps used for interacting can never be mistaken
 * for "get me out of here", short enough that someone who is dizzy and wants
 * out does not have to wait. A Cardboard viewer's button holds the contact for
 * as long as it is pressed, so this is a comfortable gesture through the case.
 */
const VR_EXIT_HOLD_MS = 900;

export function VRHud() {
  const isVRMode = useMuseumStore((s) => s.isVRMode);
  /**
   * The audio guide no longer starts itself here.
   *
   * It used to: the touch HUD is hidden in VR, so autoplay-on-focus was the
   * only way a narration could ever begin inside a headset. Two things were
   * wrong with that. A voice that starts on its own in a gallery is startling
   * for the visitor and rude to everyone standing near them, and browsers
   * increasingly refuse to allow it at all — so the feature was unreliable on
   * exactly the phones it was written for.
   *
   * What replaced it is a real control: the X button on the gamepad toggles the
   * narration (useGamepadControls), and VRInfoPanel shows its state in-scene,
   * where the stereo camera draws it identically to both eyes. Visitors in a
   * Cardboard viewer with no pad have no way to start the guide — a known
   * limitation, recorded in docs/artefak-butuh-verifikasi-kurator.md, and the
   * honest trade against a narration nobody asked for.
   */

  useEffect(() => {
    if (isVRMode) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    screen.orientation?.unlock?.();
  }, [isVRMode]);

  if (!isVRMode) return null;

  return (
    <>
      <VRTouchLayer />
      <VRHudOverlay />
    </>
  );
}

/**
 * The only way in or out of VR that does not require a gamepad.
 *
 * Before this, `setVRMode(false)` had exactly one caller: the Start button on a
 * Bluetooth pad. A visitor who put a phone into a Cardboard viewer without one
 * had no exit at all — not a hard one, none — and the same was true of
 * interacting with an artifact, because the entire touch HUD is hidden in VR.
 * Refreshing the page meant taking the phone back out of the headset first.
 *
 * Two gestures on one transparent full-screen layer, distinguished only by how
 * long the contact lasts, because a Cardboard viewer gives the visitor exactly
 * one input: a button that presses the glass.
 *
 *  - **short tap** → the same action the pad's A button performs: open the
 *    artifact in range, or cross the archway being offered.
 *  - **hold** → leave VR.
 *
 * Deliberately not `onClick`: a click needs press and release at the same spot,
 * and a viewer's button rarely obliges. Pointer events with a timer do.
 */
function VRTouchLayer() {
  const holdTimer = useRef<number | null>(null);
  const didHoldExit = useRef(false);

  const clearHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  useEffect(() => clearHold, []);

  return (
    <div
      className="fixed inset-0 z-[45]"
      style={{ touchAction: "none" }}
      onPointerDown={() => {
        didHoldExit.current = false;
        clearHold();
        holdTimer.current = window.setTimeout(() => {
          didHoldExit.current = true;
          useMuseumStore.getState().setVRMode(false);
        }, VR_EXIT_HOLD_MS);
      }}
      onPointerUp={() => {
        clearHold();
        // The hold already exited VR; do not also fire the tap action.
        if (didHoldExit.current) return;
        const s = useMuseumStore.getState();
        if (s.focusedArtifact) {
          s.focusArtifact(null);
        } else if (s.nearbyArtifact) {
          s.focusArtifact(s.nearbyArtifact);
        } else if (s.nearbyDoorLabel) {
          s.confirmDoor();
        }
      }}
      onPointerCancel={clearHold}
      onPointerLeave={clearHold}
    />
  );
}

function VRHudOverlay() {
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
