import { useEffect, useRef, useState } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";
import { VR_DIAG_ENABLED, vrDiag } from "@/utils/vrDiagnostics";
import { checkVrInvariant, vrInvariantSummary } from "@/utils/vrInvariants";

/**
 * How far one eye's overlay must move INBOARD, as a CSS length.
 *
 * This is `eyeLensCenterShift` (see vrOptics) rewritten so the browser
 * evaluates it instead of JavaScript. Same derivation, same physics — the
 * algebra is unrolled here only so the result stays live:
 *
 *   shift          = 1 - 2·L / Wmm            (fraction of an eye's half-width)
 *   Wmm            = S · surface / viewport   (the canvas is inset, the panel is not)
 *   surface        = 100vw - 2·inset
 *   offset(px)     = shift · surface / 4
 *                  = 25vw - inset/2 - (L/S)·50vw
 *
 * L and S are the viewer's lens separation and the phone's screen width, both
 * in millimetres and both plain numbers from settings; everything else is a CSS
 * unit the engine re-resolves on its own.
 *
 * Live matters here specifically. The JS version of this had to be recomputed
 * on rotation, and a React overlay does not necessarily re-render when a phone
 * is turned — so a visitor who flipped the handset from one landscape to the
 * other kept the offset computed for the previous orientation, which is the
 * exact asymmetry this whole change is about. In `vw` and `var()` the browser
 * owns that problem.
 *
 * The clamp in eyeLensCenterShift is deliberately not reproduced: across the
 * full range the settings allow (lens 55-72mm, screen 120-190mm) the shift runs
 * -0.20 to +0.42, comfortably inside the -0.4..0.6 the clamp guards, so it
 * never binds and adding a CSS `clamp()` would only obscure the formula.
 */
function lensAxisOffset(screenWidthMm: number, lensSeparationMm: number, eye: "left" | "right") {
  const lensFraction = screenWidthMm > 0 ? lensSeparationMm / screenWidthMm : 0.5;
  const lensTerm = `${(lensFraction * 50).toFixed(4)}vw`;
  const halfInset = `var(--vr-side-inset, 0px) / 2`;
  // The right eye's expression is the left's negation, written out rather than
  // multiplied by -1: a flat sum of three terms is the shape every calc()
  // implementation has always handled, and this file has been the subject of
  // enough "works everywhere except the one phone" reports already.
  const offset =
    eye === "left"
      ? `calc(25vw - (${halfInset}) - ${lensTerm})`
      : `calc(${lensTerm} + (${halfInset}) - 25vw)`;
  return `translateX(${offset})`;
}

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
  const [invariants, setInvariants] = useState("");

  useEffect(() => {
    if (!VR_DIAG_ENABLED) return;
    const id = setInterval(() => {
      setFrame({ ...(vrDiag.frame ?? ({} as never)) });
      setInvariants(vrInvariantSummary());
    }, 250);
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
      {/* Silence here means all three invariants held on the frames since the
          last sample. Anything printed is a rule that broke, named, with a
          count — readable from inside the viewer without a cable. */}
      {invariants && <p className="text-red-400">⚠ {invariants}</p>}
    </div>
  );
}

function EyeOverlay({
  eye,
  reticleRef,
}: {
  eye: "left" | "right";
  reticleRef?: (el: HTMLDivElement | null) => void;
}) {
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
  // The offset is now a CSS expression rather than a number — same physics, but
  // it accounts for the symmetric safe-area inset and survives a rotation
  // without a re-render. See lensAxisOffset.
  const transform = lensAxisOffset(screenWidthMm, lensSeparationMm, eye);

  return (
    // Exactly half the surface, and no divider between the halves. `flex-1`
    // shared out whatever a sibling 1px rule left behind, which made each
    // overlay half (W-1)/2 wide while the canvas underneath was drawing halves
    // of floor(W/2) — overlay and image centred on two different axes, in every
    // eye, on every device. `shrink-0` because a flex item is allowed to shrink
    // below its width and this one must not.
    <div
      className="relative w-1/2 shrink-0 h-full flex items-center justify-center"
      style={{ transform }}
    >
      {/* Crosshair to help the eye focus while looking around */}
      <div ref={reticleRef} className="w-3 h-3 rounded-full border border-museum-bone/60" />

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
  const leftReticle = useRef<HTMLDivElement | null>(null);
  const rightReticle = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  /**
   * Invariant 2: the two overlays are mirror images of each other.
   *
   * Measured from the DOM rather than reasoned about from the classes, because
   * the failure this catches is exactly the one that survives review: the CSS
   * looks symmetric and the rendered boxes are not. A stray divider, a rounding
   * difference, a safe-area inset landing on one side — each of them produces
   * markup that reads fine and a headset that does not.
   *
   * The reticle is the probe. It is the one element the visitor is asked to
   * look straight at, it sits on the lens axis by construction, and if it is
   * off-axis in one eye the whole overlay is.
   *
   * 2 Hz, dev only. A per-frame layout read would force a reflow every frame,
   * which would distort the frame time the readout above is reporting.
   */
  useEffect(() => {
    if (!VR_DIAG_ENABLED) return;
    const id = setInterval(() => {
      const surface = surfaceRef.current;
      const l = leftReticle.current?.getBoundingClientRect();
      const r = rightReticle.current?.getBoundingClientRect();
      if (!surface || !l || !r) return;

      const box = surface.getBoundingClientRect();
      const half = box.width / 2;
      // Each reticle's horizontal offset from the centre of ITS OWN eye half.
      const dxL = l.left + l.width / 2 - (box.left + half / 2);
      const dxR = r.left + r.width / 2 - (box.left + half + half / 2);
      const dyL = l.top + l.height / 2 - (box.top + box.height / 2);
      const dyR = r.top + r.height / 2 - (box.top + box.height / 2);

      checkVrInvariant(
        "hud-symmetry-x",
        Math.abs(dxL + dxR) <= 1,
        () =>
          `reticle tidak simetris: kiri ${dxL.toFixed(2)}px dari pusat matanya, ` +
          `kanan ${dxR.toFixed(2)}px (jumlahnya harus 0, sekarang ${(dxL + dxR).toFixed(2)}px)`
      );
      checkVrInvariant(
        "hud-symmetry-y",
        Math.abs(dyL - dyR) <= 1,
        () => `reticle beda tinggi antar-mata: ${(dyL - dyR).toFixed(2)}px`
      );
    }, 500);
    return () => clearInterval(id);
  }, []);

  return (
    // Height comes from --app-height (visualViewport) with a 100dvh fallback,
    // NOT from `inset-0`. On a mobile browser that can't be taken fullscreen,
    // the layout viewport is taller than the visible area, so `inset-0` would
    // size this overlay to a box that runs under the address bar — the two eye
    // halves would then be centred on a different mid-line than the canvas's,
    // and the reticle/control text would drift off each lens axis. Same source
    // of truth as #root and the <Canvas> wrapper (see useViewportHeight).
    //
    // Left and right come from --vr-side-inset rather than being pinned to 0.
    // This layer is `position: fixed`, so it is laid out against the viewport
    // and never sees the padding that inset gives #root — pinned to 0 it would
    // keep spanning the full panel, including the strip behind the notch, while
    // the canvas underneath it had already moved inboard. The overlay would
    // then be split about a different mid-line than the image it annotates.
    <div
      ref={surfaceRef}
      className="fixed top-0 z-40 flex pointer-events-none"
      style={{
        height: "var(--app-height, 100dvh)",
        left: "var(--vr-side-inset, 0px)",
        right: "var(--vr-side-inset, 0px)",
      }}
    >
      {/* No divider between the halves any more. A 1px rule looks like nothing
          and is not: it made each `flex-1` half (W-1)/2 wide while the canvas
          underneath was drawing halves of floor(W/2), so overlay and image were
          centred on two different axes in every eye. The seam is already drawn
          — the frame's full clear leaves the spare middle column black — and
          the viewer's own nose divider covers it physically. */}
      <EyeOverlay eye="left" reticleRef={(el) => (leftReticle.current = el)} />
      <EyeOverlay eye="right" reticleRef={(el) => (rightReticle.current = el)} />
    </div>
  );
}
