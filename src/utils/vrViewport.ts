/**
 * Where each eye's viewport lives, computed in ONE place.
 *
 * Written as its own module for the reason spelled out at the top of
 * vrOptics.ts: every time Mode VR has broken, it broke because two files each
 * kept their own copy of a number and the copies drifted. The eye split had
 * exactly that shape — CardboardStereoView divided the drawing buffer, VRHud
 * divided the CSS viewport with `flex-1` and a 1px rule between the halves, and
 * nothing checked that the two agreed.
 *
 * Two rules this module exists to enforce, both of them requirements of
 * *binocular* rendering rather than preferences:
 *
 *  1. **The two eye viewports are exactly the same size.** Not "within a
 *     pixel": the same. Fusing a stereo pair means the visual system matching
 *     features between two images, and it can only do that if the images are
 *     the same shape. A one-pixel width difference makes the two halves
 *     disagree about scale by 1/450th, which sounds like nothing and is enough
 *     to keep the eyes hunting for a match they never find — the "pusing dalam
 *     hitungan detik" failure mode.
 *
 *  2. **An odd leftover pixel is thrown away in the MIDDLE, not given to one
 *     eye.** A drawing buffer 915px wide splits into 457 + 457 with one column
 *     spare; that column sits on the seam between the two halves, where the
 *     nose of the viewer already blocks it. It is deliberately left out of both
 *     scissor rectangles and painted by the frame's full clear, so it is a
 *     black hairline rather than a stale stripe.
 */

export interface VrEyeLayout {
  /** Width of ONE eye's viewport, in drawing-buffer pixels. Identical for both. */
  eyeBufferW: number;
  /** Height of an eye viewport, in drawing-buffer pixels (full canvas height). */
  eyeBufferH: number;
  /** Left edge of each eye's viewport, in drawing-buffer pixels. */
  leftBufferX: number;
  rightBufferX: number;
  /** The same rectangle expressed in the CSS pixels three's setViewport wants. */
  cssEyeWidth: number;
  cssEyeHeight: number;
  cssLeftX: number;
  cssRightX: number;
  /** Width of the discarded seam between the halves, in drawing-buffer pixels (0 or 1). */
  gutterBufferW: number;
}

/**
 * @param bufferWidth  drawing-buffer width (NOT clientWidth, NOT innerWidth)
 * @param bufferHeight drawing-buffer height
 * @param pixelRatio   renderer.getPixelRatio(), used only to convert back to
 *                     the CSS units setViewport/setScissor take
 */
export function computeVrEyeLayout(
  bufferWidth: number,
  bufferHeight: number,
  pixelRatio: number
): VrEyeLayout {
  const ratio = pixelRatio > 0 ? pixelRatio : 1;
  const w = Math.max(2, Math.floor(bufferWidth));
  const h = Math.max(2, Math.floor(bufferHeight));

  // floor, for BOTH eyes. The remainder is the seam, not a bonus column.
  const eyeBufferW = Math.max(1, Math.floor(w / 2));
  const rightBufferX = w - eyeBufferW;

  return {
    eyeBufferW,
    eyeBufferH: h,
    leftBufferX: 0,
    rightBufferX,
    cssEyeWidth: eyeBufferW / ratio,
    cssEyeHeight: h / ratio,
    cssLeftX: 0,
    cssRightX: rightBufferX / ratio,
    gutterBufferW: w - eyeBufferW * 2,
  };
}

/**
 * Name of the CSS custom property that holds the symmetric side inset applied
 * to the whole VR surface (canvas and DOM overlay alike).
 *
 * Declared in index.css as
 *   max(env(safe-area-inset-left), env(safe-area-inset-right))
 * and applied only while `<html data-vr="on">`. See the block there for why a
 * notch has to be subtracted from BOTH sides rather than the side it is on.
 */
export const VR_SIDE_INSET_VAR = "--vr-side-inset";

/** Attribute set on <html> while Mode VR is active; the CSS above keys off it. */
export const VR_ROOT_ATTR = "data-vr";

/**
 * The resolved side inset in CSS pixels, read back from the document.
 *
 * Only used by the dev-mode invariant checks and the diagnostics readout —
 * nothing in the render path branches on it, because the render path measures
 * the canvas it actually got rather than predicting it.
 */
export function readVrSideInsetPx(): number {
  if (typeof window === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(VR_SIDE_INSET_VAR);
  const px = Number.parseFloat(raw);
  return Number.isFinite(px) ? px : 0;
}
