/**
 * Every number that decides how the Cardboard stereo view is framed, in ONE
 * place, with the geometry it comes from written down next to it.
 *
 * This module exists because of a pattern, not a single bug. Mode VR has now
 * broken three times (yellow, black, framing), and each time the cause was the
 * same shape: VR kept a private copy of a value that mono also had, the two
 * drifted, and nobody could see it because the two copies lived in different
 * files. So: anything the stereo path needs that mono also needs is DERIVED
 * here from a named physical quantity, never hardcoded at the call site.
 *
 * The three physical quantities this is all built on:
 *   1. the viewer's lens separation (a property of the Cardboard),
 *   2. the phone's physical screen width (a property of the phone),
 *   3. the visitor's interpupillary distance (a property of the person).
 * Everything else — FOV, frustum skew, distortion centre — falls out of those.
 */

/**
 * Horizontal field of view presented to EACH eye, in degrees.
 *
 * This is fixed by the optics, not by taste: a Cardboard v2 lens sits ~40mm
 * from the eye and shows the eye its whole half of the screen, which works out
 * to roughly 90°. So 90° is what we render, and the VERTICAL fov is derived
 * from it per device (see verticalFovForEyeAspect) rather than the other way
 * round.
 *
 * Doing it in this order matters. Fixing the vertical fov instead — which is
 * what a plain `camera.fov = 80` does — silently hands every phone a different
 * horizontal field, because the eye viewport's aspect depends on the phone's
 * screen shape (measured: 1.05 on a 16:9-ish handset, 1.11 on a tall one).
 * That made the world's apparent scale a function of which phone you held.
 */
export const VR_FOV_HORIZONTAL_PER_EYE = 90;

/**
 * Vertical fov (degrees) for one eye, derived so that the HORIZONTAL field is
 * always VR_FOV_HORIZONTAL_PER_EYE regardless of the phone's screen shape.
 *
 * `eyeAspect` is the aspect of ONE eye's viewport — half the canvas width over
 * the full canvas height — not the canvas aspect.
 */
export function verticalFovForEyeAspect(eyeAspect: number): number {
  if (!Number.isFinite(eyeAspect) || eyeAspect <= 0) return 80;
  const halfH = Math.tan((VR_FOV_HORIZONTAL_PER_EYE * Math.PI) / 360) / eyeAspect;
  const fov = (2 * Math.atan(halfH) * 180) / Math.PI;
  // Guard only against a degenerate viewport mid-resize; the real range this
  // produces on actual phones is ~84-88°.
  return Math.min(110, Math.max(70, fov));
}

// --- Lens separation: a property of the VIEWER ------------------------------
// Cardboard v2's lenses are a fixed 63mm apart, which is also the average adult
// IPD. The adjustable range exists because cheap viewers vary and some have
// sliding lenses; outside it there is no viewer to match, only eye strain.
export const LENS_SEPARATION_DEFAULT_MM = 63;
export const LENS_SEPARATION_MIN_MM = 55;
export const LENS_SEPARATION_MAX_MM = 72;
export const LENS_SEPARATION_STEP_MM = 1;

// --- Screen width: a property of the PHONE ----------------------------------
/**
 * The phone's physical screen width along its LONG edge, in millimetres.
 *
 * This is the one quantity the web refuses to expose and the one the stereo
 * framing genuinely needs, so it has to be either measured or calibrated. It
 * replaces an earlier `MM_PER_CSS_PX = 25.4 / 140` guess, which was wrong by
 * 10-15% on most phones — and because the lens-centre shift is a DIFFERENCE of
 * two similar lengths, a 15% error in the input became a ~100% error in the
 * output, i.e. each eye's image landed ~4mm too far inboard and the pair could
 * not be fused at all. Measure it once with a ruler and it is right forever;
 * the default below is a mid-range 6.3" handset.
 */
export const SCREEN_WIDTH_DEFAULT_MM = 145;
export const SCREEN_WIDTH_MIN_MM = 120;
export const SCREEN_WIDTH_MAX_MM = 190;

// --- IPD: a property of the PERSON ------------------------------------------
// World units, and the world is 1 unit = 1 metre — so 63mm is 0.063, NOT 63.
// Getting that wrong would put the two eyes 63 metres apart.
export const IPD_DEFAULT_M = 0.063;
export const IPD_MIN_M = 0.055;
export const IPD_MAX_M = 0.072;

/**
 * How far each eye's image must move INBOARD (toward the nose) from the centre
 * of its own half of the screen, as a fraction of that half-viewport's
 * half-width — i.e. directly in the -1..1 space both the projection skew and
 * the barrel-distortion centre use.
 *
 * Derivation, all in millimetres on the physical glass:
 *   - one eye's viewport spans screenWidthMm / 2, so its centre sits
 *     screenWidthMm / 4 out from the middle of the screen;
 *   - that eye's lens axis sits lensSeparationMm / 2 out from the middle;
 *   - the viewport's half-width — what "1.0" means in its own NDC — is
 *     screenWidthMm / 4.
 *   shift = (screenWidthMm/4 - lensSeparationMm/2) / (screenWidthMm/4)
 *         = 1 - 2 * lensSeparationMm / screenWidthMm
 *
 * Note what dropped out: pixels. Not CSS pixels, not drawing-buffer pixels, not
 * devicePixelRatio. The ratio of two physical lengths cannot depend on how the
 * screen is sampled, so any version of this formula that mentions a pixel
 * density has a bug in it — that is exactly how the previous one went wrong.
 * (This does assume the canvas spans the full screen width, which is why VR
 * entry requests fullscreen and locks the orientation.)
 */
export function eyeLensCenterShift(screenWidthMm: number, lensSeparationMm: number): number {
  if (!Number.isFinite(screenWidthMm) || screenWidthMm <= 0) return 0;
  const shift = 1 - (2 * lensSeparationMm) / screenWidthMm;
  return Math.min(0.6, Math.max(-0.4, shift));
}

/**
 * Normalising divisor for the barrel pre-distortion.
 *
 * The distortion resamples an output pixel at radius r from the source at
 * radius r * (1 + k1*r² + k2*r⁴). That factor is > 1 everywhere, so without a
 * normaliser the source edge (r = 1) lands at output radius ~0.79 and
 * everything beyond it samples off the texture and comes out black: measured
 * 44% of every eye viewport, in a rounded-corner box with wide black margins —
 * which is precisely what the reported "kotak bersudut membulat" was.
 *
 * Dividing by the factor at r = 1 pins the source edge to the viewport edge, so
 * the render fills the lens instead of hiding inside a black tube. It also
 * restores the world to life-size: with the black border the visitor was seeing
 * a 40° half-field spread over only 34° of the lens's field, i.e. everything
 * was rendered at ~0.8x scale.
 */
export function barrelNormalizer(k1: number, k2: number): number {
  return Math.max(0.001, 1 + k1 + k2);
}
