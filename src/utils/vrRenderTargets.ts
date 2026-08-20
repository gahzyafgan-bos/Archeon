/**
 * How many MSAA samples this GPU can genuinely give a half-float render target.
 *
 * three does not check. `WebGLTextures.setupRenderTarget` clamps a target's
 * requested `samples` to `gl.getParameter(gl.MAX_SAMPLES)` and then calls
 * `renderbufferStorageMultisample(RENDERBUFFER, samples, RGBA16F, w, h)`
 * unconditionally. MAX_SAMPLES is the limit for *normalised* formats; WebGL2
 * exposes per-format support separately, and RGBA16F is precisely the format
 * where drivers differ. On an implementation that cannot multisample a
 * half-float renderbuffer the call raises INVALID_OPERATION, the renderbuffer
 * is left unallocated, the framebuffer is INCOMPLETE_ATTACHMENT — and from
 * there every `glClear` and every draw into it is silently dropped
 * (INVALID_FRAMEBUFFER_OPERATION), while the resolve blit that should refresh
 * the texture fails too.
 *
 * The texture then keeps whatever it last held, frame after frame. That is what
 * a "jejak berulang" is: not a trail anybody drew, but a buffer nobody managed
 * to erase.
 *
 * The eye targets in CardboardStereoView are half-float (they hold raw linear
 * radiance for the barrel/tone-mapping pass — see createEyeRenderTarget), and
 * MSAA on them switches on at the Sedang preset. That is the exact boundary the
 * ghosting was reported at.
 *
 * So: ask, then probe. Both, because they catch different lies —
 *   - `getInternalformatParameter` is the spec-sanctioned question, and an
 *     empty sample list is a driver telling us plainly that it cannot;
 *   - the probe builds the real thing and reads `checkFramebufferStatus`, which
 *     catches a driver that answers the question optimistically and then fails
 *     the allocation anyway.
 *
 * Returns 0 when multisampling is not available, which is a perfectly good
 * place to be: it is what the Rendah preset already runs, and an aliased edge
 * is a far smaller problem than a frame that never clears.
 */
export function supportedHalfFloatSamples(
  ctx: WebGLRenderingContext | WebGL2RenderingContext,
  requested: number
): number {
  if (!Number.isFinite(requested) || requested <= 0) return 0;

  const isWebGL2 =
    typeof WebGL2RenderingContext !== "undefined" && ctx instanceof WebGL2RenderingContext;
  if (!isWebGL2) return 0;
  const gl2 = ctx as WebGL2RenderingContext;

  // Rendering to a float/half-float colour buffer at all.
  if (!gl2.getExtension("EXT_color_buffer_float")) return 0;

  // --- 1. What does the driver say it supports for THIS format? ------------
  let offered: number[];
  try {
    const list = gl2.getInternalformatParameter(gl2.RENDERBUFFER, gl2.RGBA16F, gl2.SAMPLES);
    offered = list ? Array.from(list as Int32Array) : [];
  } catch {
    return 0;
  }
  // Spec: the list comes back in descending order, and an empty list means the
  // format cannot be multisampled. Filter to counts we would actually want.
  const usable = offered.filter((s) => s >= 2 && s <= requested);
  if (usable.length === 0) return 0;
  const candidate = Math.max(...usable);

  // --- 2. Build one for real and ask whether it is complete ----------------
  if (!probeMultisampleTarget(gl2, candidate)) return 0;

  return candidate;
}

/**
 * Allocates a 16x16 multisampled RGBA16F renderbuffer with a depth attachment,
 * checks framebuffer completeness, and tears it all down again.
 *
 * Runs once per VR entry (memoised by the caller on the sample count), off the
 * hot path. Every binding it touches is saved and restored, so three's own
 * WebGLState cache — which tracks the bound framebuffer and would otherwise be
 * left describing an object that no longer exists — stays truthful.
 */
function probeMultisampleTarget(gl: WebGL2RenderingContext, samples: number): boolean {
  const prevFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
  const prevRenderbuffer = gl.getParameter(gl.RENDERBUFFER_BINDING) as WebGLRenderbuffer | null;

  const color = gl.createRenderbuffer();
  const depth = gl.createRenderbuffer();
  const fbo = gl.createFramebuffer();
  let complete = false;

  try {
    if (!color || !depth || !fbo) return false;

    // Drain anything an earlier call left in the error queue, so the check
    // below is reading OUR errors and not somebody else's.
    while (gl.getError() !== gl.NO_ERROR) {
      /* drain */
    }

    gl.bindRenderbuffer(gl.RENDERBUFFER, color);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA16F, 16, 16);

    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH24_STENCIL8, 16, 16);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.DEPTH_STENCIL_ATTACHMENT,
      gl.RENDERBUFFER,
      depth
    );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    const err = gl.getError();
    complete = status === gl.FRAMEBUFFER_COMPLETE && err === gl.NO_ERROR;
  } catch {
    complete = false;
  } finally {
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFramebuffer);
    gl.bindRenderbuffer(gl.RENDERBUFFER, prevRenderbuffer);
    if (fbo) gl.deleteFramebuffer(fbo);
    if (color) gl.deleteRenderbuffer(color);
    if (depth) gl.deleteRenderbuffer(depth);
    while (gl.getError() !== gl.NO_ERROR) {
      /* drain */
    }
  }

  return complete;
}
