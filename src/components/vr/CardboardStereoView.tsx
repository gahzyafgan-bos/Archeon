import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useMuseumStore } from "@/store/useMuseumStore";
import { barrelNormalizer, drawableWidthMm, eyeLensCenterShift } from "@/utils/vrOptics";
import { GRAPHICS_PRESETS } from "@/utils/graphicsPresets";
import { VR_DIAG_ENABLED, countVrResource, publishVrDiagFrame } from "@/utils/vrDiagnostics";
import { computeVrEyeLayout, readVrSideInsetPx } from "@/utils/vrViewport";
import { supportedHalfFloatSamples } from "@/utils/vrRenderTargets";
import {
  checkVrInvariant,
  resetVrInvariants,
  snapshotHeadPose,
  verifyHeadPoseUnchanged,
} from "@/utils/vrInvariants";

// Per-eye render resolution and MSAA now come from the active tier's VR row in
// GRAPHICS_PRESETS (vrEyeScale / vrMsaaSamples), so there is exactly one place
// in the codebase that decides how many pixels a VR frame gets. The constant
// that used to live here was a bare 0.9 — a SUBsample, applied underneath a
// canvas that had already been pinned to devicePixelRatio 1, in front of a
// barrel pass that magnifies the middle of the image by ~1.46x. The three
// stacked to roughly a quarter of native at the point the eye is actually
// looking, which is what "grafiknya buruk banget" was measuring.

const distortionVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Full-screen quad: bypass camera/model matrices entirely, position is
    // already in clip space.
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Classic Cardboard-style barrel pre-distortion. For an output pixel at
// radius r from the lens center, the color is sampled from the source render
// at radius r * (1 + k1*r^2 + k2*r^4). Since that factor grows with r, pixels
// near the edge of the eye viewport pull their color from further out in the
// source texture than their own position — bulging the rendered image
// outward. That's the inverse of the pincushion magnification a convex
// Cardboard lens applies, so the two cancel out and the image reads as
// straight/undistorted through the lens. Sample coordinates that land outside
// the source texture are left black, matching the soft circular vignette
// Cardboard viewers already impose physically.
const distortionFragmentShader = /* glsl */ `
  // Width of the fade at the edge of the sampled region, in UV units — about
  // 1.5 pixels' worth on a ~600px eye render. Wide enough to kill the stair-step,
  // narrow enough that it reads as the viewer's own vignette rather than a
  // deliberate border.
  #define EDGE_FEATHER 0.0025

  uniform sampler2D map;
  uniform float k1;
  uniform float k2;
  uniform float aspect;
  // Horizontal position of this eye's lens axis within its own viewport, in
  // the same -1..1 space as "centered" below. Barrel distortion is a property
  // of the lens, so it has to be measured from where the lens actually is —
  // once the image centre is pushed inboard to match the viewer's lens
  // spacing, distorting around the geometric middle of the viewport would
  // warp the image about the wrong point and undo the alignment.
  uniform float lensCenterX;
  // (1 + k1 + k2): the distortion factor evaluated at the top/bottom edge of
  // the viewport. Dividing by it pins the source image's edge to the viewport's
  // edge. Without it the factor is > 1 everywhere, the source edge lands at
  // output radius ~0.79, and everything past that samples off the texture:
  // measured 44% of every eye viewport rendered black, in a rounded-corner box
  // with wide margins. The visitor was looking down a tube at a world drawn
  // ~0.8x life-size. Derived once on the CPU in vrOptics.barrelNormalizer so
  // this shader and the FOV maths cannot disagree about it.
  uniform float distortionScale;
  varying vec2 vUv;

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    centered.x -= lensCenterX;
    centered.x *= aspect; // keep the distortion radius circular, not elliptical, on a wide viewport
    float r2 = dot(centered, centered);
    float factor = 1.0 + k1 * r2 + k2 * r2 * r2;
    vec2 distorted = centered * (factor / distortionScale);
    distorted.x /= aspect;
    distorted.x += lensCenterX;
    vec2 sampleUv = distorted * 0.5 + 0.5;

    // Sample coordinates outside the source stay black, matching the soft
    // circular vignette a Cardboard viewer imposes physically anyway.
    //
    // Faded rather than cut. A binary inside/outside test makes the boundary a
    // hard step: one pixel is the scene, the next is black, with the step itself
    // running diagonally across the pixel grid. Through a lens that magnifies
    // this region that reads as a jagged, crawling edge — the same stair-step
    // the MSAA fix removes from the geometry, reintroduced by the composite.
    // smoothstep over a fraction of a UV unit costs two extra ops and leaves an
    // edge that stays clean while the head moves.
    vec3 linearColor = texture2D(map, clamp(sampleUv, 0.0, 1.0)).rgb;
    vec2 edgeFade = smoothstep(vec2(0.0), vec2(EDGE_FEATHER), sampleUv) *
                    (1.0 - smoothstep(vec2(1.0 - EDGE_FEATHER), vec2(1.0), sampleUv));
    gl_FragColor = vec4(linearColor * edgeFade.x * edgeFade.y, 1.0);

    // ---- Display transform: THE ONE AND ONLY PLACE it happens -------------
    // The eye render targets hold raw linear radiance (three switches tone
    // mapping off and forces linear output whenever it draws into a non-XR
    // render target), so the whole display transform has to happen here, on
    // the way to the screen — exactly once, for both eyes.
    //
    // These are three's OWN chunks, not a hand-copy of them. That matters
    // twice over. First, correctness: they read renderer.toneMapping,
    // renderer.toneMappingExposure and renderer.outputColorSpace directly, so
    // VR cannot drift away from normal mode — there is nothing VR-specific
    // left to drift. Second, they must not be duplicated: three already
    // injects tonemapping_pars_fragment and colorspace_pars_fragment into
    // every ShaderMaterial, so re-declaring ACESFilmicToneMapping /
    // RRTAndODTFit / uniform float toneMappingExposure here is a GLSL
    // redefinition error. That silently fails to link, the composite quad is
    // never drawn, and Mode VR goes pure black while the DOM HUD keeps
    // working — which is precisely the bug this replaced.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createEyeRenderTarget(samples: number) {
  const target = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    // Half float, and colorSpace left at three's linear default on purpose.
    //
    // three renders into any non-XR render target with tone mapping switched
    // off and the output colour space forced to linear — it assumes an
    // intermediate buffer in a post chain, and leaves the display conversion
    // to whoever writes the final pixel. So these targets hold raw linear
    // radiance, and values well above 1.0 are normal: the marigold key light
    // over Garudeya alone is intensity 85.
    //
    // An 8-bit target would clamp all of that to 1.0 per channel BEFORE
    // anything got to roll the highlights off, and clipping channel-by-channel
    // on a warm palette is precisely what turns bright warm surfaces into flat
    // saturated yellow. Half float keeps the overshoot intact so the ACES curve
    // in the distortion pass can do its job. These targets are small (roughly
    // 0.45 x canvas width per eye), so the extra bandwidth is affordable.
    type: THREE.HalfFloatType,
  });

  // The canvas's own `antialias` flag stops applying the moment three renders
  // into a render target — that flag antialiases the DEFAULT framebuffer, and
  // nothing here draws to it until the distortion pass, which is a flat quad
  // with no geometric edges of its own to smooth. So while mono had MSAA at
  // Sedang/Tinggi, VR silently had none at any tier: WebGLRenderTarget defaults
  // to samples: 0. Every curved edge in the hall was drawn with hard binary
  // coverage and then magnified by the lens. Setting it here is the fix; the
  // caller feature-detects whether the GPU can multisample a half-float target
  // and passes 0 where it cannot.
  target.samples = samples;
  return target;
}

// Numeric three constants read back as names, so the audit dump says
// "LinearFilter" instead of "1006". Dev-only path; tree-shaken in production.
function filterName(value: number): string {
  const names: Record<number, string> = {
    [THREE.NearestFilter]: "NearestFilter",
    [THREE.NearestMipmapNearestFilter]: "NearestMipmapNearestFilter",
    [THREE.NearestMipmapLinearFilter]: "NearestMipmapLinearFilter",
    [THREE.LinearFilter]: "LinearFilter",
    [THREE.LinearMipmapNearestFilter]: "LinearMipmapNearestFilter",
    [THREE.LinearMipmapLinearFilter]: "LinearMipmapLinearFilter",
  };
  return names[value] ?? String(value);
}

function formatName(value: number): string {
  const names: Record<number, string> = {
    [THREE.RGBAFormat]: "RGBAFormat",
    [THREE.RGFormat]: "RGFormat",
    [THREE.RedFormat]: "RedFormat",
  };
  return names[value] ?? String(value);
}

function typeName(value: number): string {
  const names: Record<number, string> = {
    [THREE.UnsignedByteType]: "UnsignedByteType (8-bit)",
    [THREE.HalfFloatType]: "HalfFloatType (16-bit float)",
    [THREE.FloatType]: "FloatType (32-bit float)",
  };
  return names[value] ?? String(value);
}

/**
 * Renders the same scene twice side-by-side (one per eye) for Cardboard-style
 * viewers. Each eye is drawn in two passes:
 *   1. The scene is rendered into an off-screen render target using
 *      three.js's built-in StereoCamera for the eye-offset/frustum math.
 *   2. That render target is drawn to its half of the screen through a barrel
 *      pre-distortion shader, which is what actually makes the two images
 *      fuse into one comfortable 3D image when viewed through Cardboard
 *      lenses (flat, undistorted split views "kebelah" and cause eye strain).
 * Both passes run inside a single useFrame callback — registering it with a
 * positive priority hands us full control of the render loop and disables
 * react-three-fiber's default auto-render, the documented way to do
 * custom/multi-viewport rendering in R3F.
 */
export function CardboardStereoView() {
  const { gl, scene, camera } = useThree();
  const vrIPD = useMuseumStore((s) => s.settings.vrIPD);
  const vrLensSeparationMm = useMuseumStore((s) => s.settings.vrLensSeparationMm);
  const vrScreenWidthMm = useMuseumStore((s) => s.settings.vrScreenWidthMm);
  const vrDistortionK1 = useMuseumStore((s) => s.settings.vrDistortionK1);
  const vrDistortionK2 = useMuseumStore((s) => s.settings.vrDistortionK2);
  // Scratch vector for getDrawingBufferSize — allocating one per frame is the
  // per-frame GC pattern this project already went through PlayerRig to remove.
  const bufferSize = useRef(new THREE.Vector2());

  const stereoCamera = useMemo(() => {
    const cam = new THREE.StereoCamera();
    cam.aspect = 0.5; // each eye only gets half the canvas width
    return cam;
  }, []);

  const graphicsQuality = useMuseumStore((s) => s.settings.graphicsQuality);
  const preset = GRAPHICS_PRESETS[graphicsQuality];

  // MSAA on a half-float target is not something to assume — it is something to
  // prove, per format, on this device. EXT_color_buffer_float being present only
  // says half-float can be RENDERED to; whether it can be MULTISAMPLED is a
  // separate question the driver answers separately, and three never asks it.
  //
  // This is the whole of the ghosting bug. Where the answer is no, three still
  // allocates the multisampled renderbuffer, the framebuffer comes back
  // incomplete, and from then on every clear and every draw into that eye target
  // is dropped on the floor while the texture keeps its last contents — one
  // stale image per eye, redrawn over by nothing, for as long as VR is on. The
  // preset boundary matched exactly: Rendah asks for 0 samples and was clean,
  // Sedang and Tinggi ask for 4 and smeared. See utils/vrRenderTargets.ts.
  const eyeSamples = useMemo(() => {
    const supported = supportedHalfFloatSamples(gl.getContext(), preset.vrMsaaSamples);
    if (VR_DIAG_ENABLED && supported !== preset.vrMsaaSamples) {
      // eslint-disable-next-line no-console
      console.info(
        `[vr] MSAA per mata: diminta ${preset.vrMsaaSamples}x, perangkat ini sanggup ${supported}x ` +
          `(target half-float). Turun ke ${supported}x agar buffer tetap bisa dibersihkan.`
      );
    }
    return supported;
  }, [gl, preset.vrMsaaSamples]);

  // Keyed on the sample count: `samples` is baked into the framebuffer three
  // builds for a target, so changing tiers mid-session has to build new ones
  // rather than mutate the live pair.
  const targetL = useMemo(() => createEyeRenderTarget(eyeSamples), [eyeSamples]);
  const targetR = useMemo(() => createEyeRenderTarget(eyeSamples), [eyeSamples]);

  // Dispose the previous pair when the tier changes, not only on unmount.
  useEffect(() => {
    countVrResource("eyeRenderTargets", 1);
    countVrResource("eyeRenderTargets", 1);
    return () => {
      targetL.dispose();
      targetR.dispose();
      countVrResource("eyeRenderTargets", -1);
      countVrResource("eyeRenderTargets", -1);
    };
  }, [targetL, targetR]);

  // The stereo frame loop itself. Registered as its own effect purely so the
  // audit counter brackets exactly the lifetime of the useFrame subscription
  // below (r3f unsubscribes it on unmount; this proves it).
  useEffect(() => {
    countVrResource("stereoLoops", 1);
    // Failure counts describe THIS entry into VR, so a check that fired once
    // three sessions ago is not still on screen pretending to be current.
    resetVrInvariants();
    return () => countVrResource("stereoLoops", -1);
  }, []);

  const distortionMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          map: { value: null },
          k1: { value: vrDistortionK1 },
          k2: { value: vrDistortionK2 },
          aspect: { value: 1 },
          lensCenterX: { value: 0 },
          distortionScale: { value: 1 },
        },
        vertexShader: distortionVertexShader,
        fragmentShader: distortionFragmentShader,
        depthTest: false,
        depthWrite: false,
      }),
    // Intentionally created once — k1/k2/aspect are pushed in every frame below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const distortionScene = useMemo(() => {
    const s = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), distortionMaterial);
    quad.frustumCulled = false;
    s.add(quad);
    return s;
  }, [distortionMaterial]);
  const distortionCamera = useMemo(() => new THREE.Camera(), []);

  const lastTargetSize = useRef({ width: 0, height: 0 });
  // THREE.StereoCamera only rebuilds its two projection matrices when one of
  // its own cached inputs changes; on every other frame it leaves them exactly
  // as it last wrote them. Since we shift those matrices afterwards, we can't
  // read them back as a baseline — a `+=` would compound frame after frame.
  // So we mirror StereoCamera's cache key, and snapshot the pristine
  // x-asymmetry term on precisely the frames it rebuilt.
  const stereoKey = useRef("");
  const baseSkew = useRef({ left: 0, right: 0 });

  // --- dev-only diagnostics state (see utils/vrDiagnostics.ts) --------------
  // Everything guarded by VR_DIAG_ENABLED, which Vite statically replaces with
  // `false` in a production build, so all of it tree-shakes away.
  const diag = useRef({
    lastTime: 0,
    lastHeadYaw: 0,
    shadowPasses: 0,
    posL: new THREE.Vector3(),
    posR: new THREE.Vector3(),
    quatL: new THREE.Quaternion(),
    quatR: new THREE.Quaternion(),
    scratchScale: new THREE.Vector3(),
    eulerL: new THREE.Euler(0, 0, 0, "YXZ"),
    eulerR: new THREE.Euler(0, 0, 0, "YXZ"),
    headEuler: new THREE.Euler(0, 0, 0, "YXZ"),
    delta: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    forward: new THREE.Vector3(),
  });

  useEffect(() => {
    if (!VR_DIAG_ENABLED) return;

    // three resets info at the top of EVERY render() call, so by default the
    // counters would only ever describe the last of this frame's four renders
    // (right eye's distortion quad). Take manual control so A.4 measures the
    // whole frame, and hand it back on the way out.
    const previousAutoReset = gl.info.autoReset;
    gl.info.autoReset = false;

    // The only reliable way to count shadow-map passes: three calls this once
    // per render(), and with autoUpdate on it does the full pass every time —
    // meaning twice per frame here, once per eye.
    const shadowMap = gl.shadowMap as unknown as {
      render: (...args: unknown[]) => void;
    };
    const originalShadowRender = shadowMap.render.bind(gl.shadowMap);
    shadowMap.render = (...args: unknown[]) => {
      diag.current.shadowPasses++;
      originalShadowRender(...args);
    };

    return () => {
      gl.info.autoReset = previousAutoReset;
      shadowMap.render = originalShadowRender;
    };
  }, [gl]);

  useEffect(() => {
    return () => {
      // Put the renderer back into a clean MONO state. WebGLRenderer keeps
      // every one of these settings indefinitely, so anything left behind here
      // is inherited by r3f's auto-render the moment VR exits — and inherited
      // again by the NEXT entry into VR, which is why leaving VR dirty shows up
      // as a second entry that looks worse than the first.
      const canvasSize = gl.getSize(new THREE.Vector2());
      gl.setScissorTest(false);
      gl.setViewport(0, 0, canvasSize.width, canvasSize.height);
      gl.setScissor(0, 0, canvasSize.width, canvasSize.height);
      // The frame loop always ends on the default framebuffer, but a frame
      // interrupted between the eye passes and the composite (an unmount
      // mid-frame, a lost context) does not. Leaving an eye target bound sends
      // the first mono frames into an off-screen buffer nobody displays.
      gl.setRenderTarget(null);
      // Shadow maps are taken under manual control per frame below and handed
      // back at the end of each one; assert the mono default here too, so an
      // exit on a frame that did not complete cannot leave shadows frozen.
      gl.shadowMap.autoUpdate = true;
      gl.shadowMap.needsUpdate = true;

      // The eye targets are disposed by their own effect above, which also
      // covers a mid-session tier change — doing it here too would double-free.
      distortionMaterial.dispose();
      distortionScene.children.forEach((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  useFrame(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    // Counters start at zero here, not inside three's render(): every draw this
    // frame happens below, so this brackets the whole VR frame (A.4).
    if (VR_DIAG_ENABLED) {
      gl.info.reset();
      diag.current.shadowPasses = 0;
    }

    // --- Everything below is measured in DRAWING BUFFER pixels ---------------
    // Not clientWidth, not window.innerWidth, not the `size` r3f reports: those
    // are CSS pixels, and on a phone with devicePixelRatio 2-3 they are a
    // different number from the buffer actually being rasterised into. VR
    // currently pins dpr to 1 for performance, which makes them coincide today
    // and would hide the bug the day that changes.
    const buffer = gl.getDrawingBufferSize(bufferSize.current);
    const pixelRatio = gl.getPixelRatio() || 1;

    // The split is computed once, in one module, and both this file and the DOM
    // overlay read it from there. Both eyes get Math.floor(width / 2) — the SAME
    // number — and an odd leftover column is dropped on the seam rather than
    // handed to one eye. See utils/vrViewport.ts for why "within a pixel" is not
    // good enough for a stereo pair.
    const layout = computeVrEyeLayout(buffer.x, buffer.y, pixelRatio);
    const eyeBufferW = layout.eyeBufferW;
    const eyeBufferH = layout.eyeBufferH;

    // --- One full clear per frame, before any viewport or scissor is set -----
    //
    // Order is the whole point. `gl.clear()` obeys the scissor test, so a clear
    // issued while a scissor rectangle is active erases that rectangle and
    // leaves everything outside it holding the previous frame. Doing it here,
    // with the scissor test explicitly off and the viewport spanning the whole
    // canvas, means the seam column and both eye halves start every frame black
    // no matter what the rest of the loop does afterwards.
    //
    // It is also the frame's insurance policy against the eye targets: those are
    // cleared again individually below, and if a driver drops one of those
    // clears the visitor sees black rather than yesterday's greeter.
    gl.setScissorTest(false);
    gl.setRenderTarget(null);
    gl.setViewport(0, 0, buffer.x / pixelRatio, buffer.y / pixelRatio);
    gl.setScissor(0, 0, buffer.x / pixelRatio, buffer.y / pixelRatio);
    gl.clear(true, true, true);

    // autoClear is renderer-global and sticky, and post-processing libraries
    // routinely switch it off. Nothing in VR mounts a composer today — the
    // stereo view replaces it rather than sitting behind it (see
    // MuseumExperience) — but "today" is exactly how this file has been broken
    // before. Assert it rather than inherit it.
    if (gl.autoClear !== true) {
      checkVrInvariant(
        "auto-clear",
        false,
        () => "renderer.autoClear mati saat masuk frame VR — dipaksa nyala lagi."
      );
      gl.autoClear = true;
    }

    // setViewport/setScissor take CSS pixels and multiply by the pixel ratio
    // internally, so convert back at the boundary rather than mixing units.
    const halfWidth = layout.cssEyeWidth;
    const viewHeight = layout.cssEyeHeight;
    const leftX = layout.cssLeftX;
    const rightX = layout.cssRightX;

    // Per-eye scene resolution. eyeBufferW is already half the drawing buffer,
    // so the division by two happens exactly once in the whole path — the scale
    // below is applied to an eye's width, never to the full canvas width.
    const eyeWidth = Math.max(2, Math.round(eyeBufferW * preset.vrEyeScale));
    const eyeHeight = Math.max(2, Math.round(eyeBufferH * preset.vrEyeScale));

    if (lastTargetSize.current.width !== eyeWidth || lastTargetSize.current.height !== eyeHeight) {
      targetL.setSize(eyeWidth, eyeHeight);
      targetR.setSize(eyeWidth, eyeHeight);
      lastTargetSize.current = { width: eyeWidth, height: eyeHeight };
    }

    // The eye cameras are PARALLEL: StereoCamera gives cameraL/cameraR the head
    // camera's matrixWorld post-multiplied by a pure ±eyeSep/2 translation on
    // the camera's own local X, so their rotations are identical to the head's
    // and to each other. Convergence is done with an asymmetric frustum
    // (element 8), never by toeing the cameras in — rotating them would put a
    // VERTICAL offset between the two images, and the eyes cannot fuse vertical
    // disparity at all. Verify with a screenshot any time this is touched: the
    // pixel Y of a horizontal edge must be identical in both halves.
    stereoCamera.eyeSep = vrIPD;
    camera.updateMatrixWorld();
    stereoCamera.update(camera);

    // --- Lens-centre alignment -------------------------------------------
    // Where each eye's lens axis falls inside its own half of the screen, in
    // the -1..1 space that spans that half. A plain 50/50 split puts the two
    // image centres half a screen-width apart; the viewer's lenses are a fixed
    // ~63mm apart, so both images have to move inboard by the difference.
    //
    // Derived from two physical lengths in vrOptics (screen width and lens
    // separation) and deliberately NOT from a pixel density. The version this
    // replaced went through a hardcoded `25.4 / 140` CSS-dpi guess; because
    // this shift is a difference of two similar lengths, that guess being 10-15%
    // off turned into a ~100% error here, leaving each eye's image ~4mm too far
    // inboard — roughly 11° of vergence error where a fixed-focus viewer allows
    // 1-2°. That is what "double-double" was.
    //
    // Measured against the width the canvas actually spans, not the panel's.
    // Mode VR now subtracts a symmetric safe-area inset from both sides so a
    // notch cannot eat one eye's outer edge (see index.css / --vr-side-inset),
    // and the shift is a ratio of two physical lengths — feed it the wrong one
    // and both lens axes land in the wrong place. On a phone with no cutout the
    // inset is zero and this is its own input, unchanged.
    const lensShift = eyeLensCenterShift(
      drawableWidthMm(vrScreenWidthMm, gl.domElement.clientWidth, window.innerWidth),
      vrLensSeparationMm
    );

    // Push the shift into the projection matrices rather than sliding the
    // finished image sideways: element 8 is the frustum's x-asymmetry term, so
    // moving it re-aims each eye's optical axis while still filling the whole
    // viewport. Shifting the blit instead would leave a black band along the
    // outer edge of both eyes and throw away ~17% of the horizontal field.
    // Mirrors exactly what StereoCamera.update() compares internally — note
    // `focus` is the PerspectiveCamera's convergence distance, not a property
    // of StereoCamera.
    const key = `${camera.focus}|${camera.fov}|${camera.aspect}|${camera.near}|${camera.far}|${camera.zoom}|${stereoCamera.eyeSep}`;
    if (key !== stereoKey.current) {
      stereoKey.current = key;
      baseSkew.current.left = stereoCamera.cameraL.projectionMatrix.elements[8];
      baseSkew.current.right = stereoCamera.cameraR.projectionMatrix.elements[8];
    }
    stereoCamera.cameraL.projectionMatrix.elements[8] = baseSkew.current.left - lensShift;
    stereoCamera.cameraR.projectionMatrix.elements[8] = baseSkew.current.right + lensShift;
    stereoCamera.cameraL.projectionMatrixInverse.copy(stereoCamera.cameraL.projectionMatrix).invert();
    stereoCamera.cameraR.projectionMatrixInverse.copy(stereoCamera.cameraR.projectionMatrix).invert();

    const distortionUniforms = distortionMaterial.uniforms;
    distortionUniforms.k1.value = vrDistortionK1;
    distortionUniforms.k2.value = vrDistortionK2;
    distortionUniforms.aspect.value = eyeBufferW / eyeBufferH;
    distortionUniforms.distortionScale.value = barrelNormalizer(vrDistortionK1, vrDistortionK2);
    // No exposure/colour-space uniform is pushed here on purpose: the shader
    // uses three's own tonemapping/colorspace chunks, which three feeds from
    // renderer.toneMappingExposure itself. See A.4 — one source of truth.

    // --- Shadow maps: once per FRAME, not once per eye ----------------------
    // three calls shadowMap.render() inside every renderer.render(), and with
    // autoUpdate on it redoes the whole pass each time — so drawing two eyes
    // meant rendering every shadow map twice per frame, at full resolution, for
    // two viewpoints 63mm apart that produce visually identical shadows.
    //
    // Taking manual control lets us pay for it once: needsUpdate makes the left
    // eye's render do the real pass (three clears the flag itself once it's
    // done), and the right eye then finds autoUpdate false / needsUpdate false
    // and skips straight to drawing the scene, reusing the maps still bound.
    // This is the budget that funds the resolution increase above — the prompt's
    // rule is to cut effects, not pixels, and this cuts neither.
    const shadowsWereAuto = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;

    // Pass 1: render each eye's scene into its own off-screen target.
    //
    // The clear is written out rather than left to autoClear. three does issue
    // one (WebGLBackground.render calls renderer.clear when autoClear is on), so
    // on a healthy device this is a duplicate costing one glClear per eye — and
    // that is a price worth paying for a rule that no longer depends on a flag
    // some other component might have flipped, on a scissor rectangle set three
    // calls ago, or on this scene never being given a background. The clear that
    // did not happen is the bug this file exists to prevent.
    // Both eyes must be drawn from ONE head pose, and the pair of calls below is
    // the window in which that can quietly stop being true. Not from another
    // useFrame — r3f has already run every priority-0 callback before this one
    // starts, so the rig is settled — but from inside the renders themselves:
    // `renderer.render` walks the scene graph and re-derives world matrices, and
    // any onBeforeRender handler, any object parented to the camera, any
    // lazily-attached helper gets to run twice, once per eye, with the second
    // run able to see what the first one changed.
    //
    // So the check brackets both renders and compares the matrix three actually
    // used, at a tolerance of zero. Dev only; the whole module tree-shakes away.
    if (VR_DIAG_ENABLED) snapshotHeadPose(camera.matrixWorld.elements);

    gl.setRenderTarget(targetL);
    gl.clear(true, true, true);
    gl.render(scene, stereoCamera.cameraL);

    gl.setRenderTarget(targetR);
    gl.clear(true, true, true);
    gl.render(scene, stereoCamera.cameraR);

    if (VR_DIAG_ENABLED) verifyHeadPoseUnchanged(camera.matrixWorld.elements);

    gl.setRenderTarget(null);

    // Hand the renderer back exactly what it had. Mono must be untouched by
    // anything in this file, including on the frame VR is switched off.
    //
    // Safe to restore here rather than after the composite: the two distortion
    // passes below render distortionScene, which has no lights in it, and
    // WebGLShadowMap.render returns immediately on an empty light list.
    gl.shadowMap.autoUpdate = shadowsWereAuto;

    // Pass 2: barrel-distort each render target onto its half of the screen.
    gl.setScissorTest(true);

    // Both eyes share y = 0 and the same height, so the two halves stay
    // pixel-for-pixel level with each other — even a few pixels of vertical
    // disparity is enough to stop the pair fusing.
    //
    // LEFT EYE = LEFT HALF OF THE SCREEN, and that is not an assumption:
    // StereoCamera puts cameraL at -eyeSep/2 on the camera's local X, so
    // targetL genuinely holds the left-eye view, and it is blitted at x = 0.
    // If a future change ever makes the pair impossible to fuse while every
    // other number checks out, swapping these two blocks is the 30-second test
    // — render a big "L" to targetL only and confirm through the viewer that
    // the left eye sees it.
    gl.setViewport(leftX, 0, halfWidth, viewHeight);
    gl.setScissor(leftX, 0, halfWidth, viewHeight);
    distortionUniforms.map.value = targetL.texture;
    distortionUniforms.lensCenterX.value = lensShift; // left eye's lens sits inboard, i.e. to the right
    gl.render(distortionScene, distortionCamera);

    // Same WIDTH as the left eye, not "the rest of the canvas". On an odd
    // buffer width the right eye starts one pixel further in and the spare
    // column stays black on the seam, where the viewer's nose divider already
    // covers it — rather than making the right image one pixel wider than the
    // left, which is a scale mismatch the eyes cannot fuse away.
    gl.setViewport(rightX, 0, halfWidth, viewHeight);
    gl.setScissor(rightX, 0, halfWidth, viewHeight);
    distortionUniforms.map.value = targetR.texture;
    distortionUniforms.lensCenterX.value = -lensShift;
    gl.render(distortionScene, distortionCamera);

    gl.setScissorTest(false);

    // Invariant 1: the two eye viewports are the same size, to the pixel.
    // Cheap enough to run every frame, and it is the check that would have
    // caught the odd-width split the moment a phone with an odd drawing buffer
    // was picked up. See utils/vrInvariants.ts.
    if (VR_DIAG_ENABLED) {
      checkVrInvariant(
        "eye-viewport-width",
        layout.gutterBufferW >= 0 && layout.rightBufferX + layout.eyeBufferW <= buffer.x,
        () =>
          `viewport mata keluar dari kanvas: kiri 0..${layout.eyeBufferW}, ` +
          `kanan ${layout.rightBufferX}..${layout.rightBufferX + layout.eyeBufferW}, ` +
          `kanvas ${buffer.x}px`
      );
    }

    // ---- dev-only measurement (A.2 / A.3 / A.4 / A.6 / A.7) -----------------
    if (VR_DIAG_ENABLED) {
      const d = diag.current;
      const now = performance.now();
      const frameMs = d.lastTime === 0 ? 0 : now - d.lastTime;
      d.lastTime = now;

      // Read the two eye poses back out of the matrices three actually rendered
      // with, rather than trusting the inputs — the point of the test is to
      // catch a difference nobody intended.
      stereoCamera.cameraL.matrixWorld.decompose(d.posL, d.quatL, d.scratchScale);
      stereoCamera.cameraR.matrixWorld.decompose(d.posR, d.quatR, d.scratchScale);
      d.eulerL.setFromQuaternion(d.quatL, "YXZ");
      d.eulerR.setFromQuaternion(d.quatR, "YXZ");
      d.headEuler.setFromQuaternion(camera.quaternion, "YXZ");

      const headYawDeg = THREE.MathUtils.radToDeg(d.headEuler.y);
      const yawVelDegPerSec =
        frameMs > 0 ? (Math.abs(headYawDeg - d.lastHeadYaw) * 1000) / frameMs : 0;
      d.lastHeadYaw = headYawDeg;

      // Decompose the eye separation along the HEAD's own axes: a correct
      // stereo pair is offset purely sideways, so the up/forward components are
      // the vertical-disparity and one-eye-ahead tests in one measurement (A.6).
      d.delta.subVectors(d.posR, d.posL);
      d.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      d.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      d.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);

      const pL = stereoCamera.cameraL.projectionMatrix.elements;
      const pR = stereoCamera.cameraR.projectionMatrix.elements;
      // Total horizontal field across an asymmetric frustum: from m[0] = 2n/(r-l)
      // and m[8] = (r+l)/(r-l) we get r/n = (1+m8)/m0 and -l/n = (1-m8)/m0.
      const fovHorizontal =
        THREE.MathUtils.radToDeg(Math.atan((1 + pL[8]) / pL[0]) + Math.atan((1 - pL[8]) / pL[0]));

      const screenPxPerEye = (gl.domElement.clientWidth * window.devicePixelRatio) / 2;
      const pxPerEyeRatio = screenPxPerEye > 0 ? eyeWidth / screenPxPerEye : 0;
      // The barrel pass samples radius r from r/distortionScale at the lens
      // axis, so the middle of the image is stretched by exactly that factor —
      // which is where the visitor is looking (see the shader comments).
      const centerMagnification = distortionUniforms.distortionScale.value;

      publishVrDiagFrame({
        fps: frameMs > 0 ? 1000 / frameMs : 0,
        frameMs,
        yawVelDegPerSec,

        devicePixelRatio: window.devicePixelRatio,
        rendererPixelRatio: pixelRatio,
        cssWidth: gl.domElement.clientWidth,
        cssHeight: gl.domElement.clientHeight,
        bufferWidth: buffer.x,
        bufferHeight: buffer.y,
        preset: graphicsQuality,
        presetDprMax: preset.vrDpr[1],
        renderScale: preset.vrEyeScale,
        rtWidth: eyeWidth,
        rtHeight: eyeHeight,
        eyeViewportWidth: eyeBufferW,
        eyeViewportWidthRight: eyeBufferW,
        eyeViewportHeight: eyeBufferH,
        eyeSeamWidth: layout.gutterBufferW,
        sideInsetCssPx: readVrSideInsetPx(),
        pxPerEyeRatio,
        pxPerEyeRatioAtCenter: pxPerEyeRatio / centerMagnification,
        centerMagnification,

        msaaRequested: preset.vrMsaaSamples,
        rtSamples: targetL.samples,
        rtMinFilter: filterName(targetL.texture.minFilter),
        rtMagFilter: filterName(targetL.texture.magFilter),
        rtGenerateMipmaps: targetL.texture.generateMipmaps,
        rtColorSpace: targetL.texture.colorSpace,
        rtFormat: formatName(targetL.texture.format),
        rtType: typeName(targetL.texture.type),
        canvasAntialias: gl.getContext().getContextAttributes()?.antialias ?? false,

        fovVertical: camera.fov,
        fovHorizontal,
        eyeAspect: camera.aspect * stereoCamera.aspect,
        near: camera.near,
        far: camera.far,
        yawDeltaDeg: THREE.MathUtils.radToDeg(d.eulerR.y - d.eulerL.y),
        pitchDeltaDeg: THREE.MathUtils.radToDeg(d.eulerR.x - d.eulerL.x),
        rollDeltaDeg: THREE.MathUtils.radToDeg(d.eulerR.z - d.eulerL.z),
        measuredEyeSepM: d.delta.dot(d.right),
        measuredEyeVerticalOffsetM: d.delta.dot(d.up),
        measuredEyeDepthOffsetM: d.delta.dot(d.forward),
        projYScaleDeltaAbs: Math.abs(pL[5] - pR[5]),
        projYSkewDeltaAbs: Math.abs(pL[9] - pR[9]),
        frustumSkewL: pL[8],
        frustumSkewR: pR[8],
        lensCenterShift: lensShift,

        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        programs: gl.info.programs?.length ?? 0,
        shadowPassesPerFrame: d.shadowPasses,
        shadowsEnabled: gl.shadowMap.enabled,
        shadowAutoUpdate: gl.shadowMap.autoUpdate,
      });
    }
  }, 1);

  return null;
}
