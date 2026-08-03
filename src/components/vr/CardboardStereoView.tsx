import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useMuseumStore } from "@/store/useMuseumStore";
import { barrelNormalizer, eyeLensCenterShift } from "@/utils/vrOptics";
import { GRAPHICS_PRESETS } from "@/utils/graphicsPresets";
import { VR_DIAG_ENABLED, publishVrDiagFrame } from "@/utils/vrDiagnostics";

/**
 * Render-target resolution relative to each eye's actual on-screen pixel
 * size. The distorted output is viewed squashed through a Cardboard lens, so
 * mild softness at the edges is invisible there — trading a bit of sharpness
 * for this headroom keeps frame rate comfortable on mid-range phones (see
 * spec section 5: barrel distortion via render targets adds cost).
 */
const RENDER_SCALE = 0.9;

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
    vec3 linearColor = vec3(0.0);
    if (sampleUv.x >= 0.0 && sampleUv.x <= 1.0 && sampleUv.y >= 0.0 && sampleUv.y <= 1.0) {
      linearColor = texture2D(map, sampleUv).rgb;
    }
    gl_FragColor = vec4(linearColor, 1.0);

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

function createEyeRenderTarget() {
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

  const targetL = useMemo(() => createEyeRenderTarget(), []);
  const targetR = useMemo(() => createEyeRenderTarget(), []);

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
  const graphicsQuality = useMuseumStore((s) => s.settings.graphicsQuality);
  const diag = useRef({
    lastTime: 0,
    lastHeadYaw: 0,
    shadowPasses: 0,
    shadowPassesLastFrame: 0,
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
      // Hand the renderer back a full-screen viewport. WebGLRenderer keeps the
      // last `setViewport` indefinitely, so leaving VR would otherwise resume
      // r3f's auto-render still scissored/clipped to the right eye's half of
      // the canvas — the scene drawn into one half of the screen until some
      // unrelated resize happened to reset it.
      const canvasSize = gl.getSize(new THREE.Vector2());
      gl.setScissorTest(false);
      gl.setViewport(0, 0, canvasSize.width, canvasSize.height);
      gl.setScissor(0, 0, canvasSize.width, canvasSize.height);

      targetL.dispose();
      targetR.dispose();
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

    // Integer split, and the right eye gets the remainder. An odd buffer width
    // (e.g. 915) divided by two is 457.5; three floors viewport rectangles, so
    // a naive halfWidth left column 914 in neither eye's scissor — never drawn,
    // never cleared, a stale stripe down the edge of the screen.
    const eyeBufferW = Math.floor(buffer.x / 2);
    const rightEyeBufferW = buffer.x - eyeBufferW;
    const eyeBufferH = buffer.y;

    // setViewport/setScissor take CSS pixels and multiply by the pixel ratio
    // internally, so convert back at the boundary rather than mixing units.
    const halfWidth = eyeBufferW / pixelRatio;
    const rightHalfWidth = rightEyeBufferW / pixelRatio;
    const viewHeight = eyeBufferH / pixelRatio;

    const eyeWidth = Math.max(2, Math.round(eyeBufferW * RENDER_SCALE));
    const eyeHeight = Math.max(2, Math.round(eyeBufferH * RENDER_SCALE));

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
    const lensShift = eyeLensCenterShift(vrScreenWidthMm, vrLensSeparationMm);

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

    gl.setScissorTest(false);

    // Pass 1: render each eye's scene into its own off-screen target.
    gl.setRenderTarget(targetL);
    gl.render(scene, stereoCamera.cameraL);

    gl.setRenderTarget(targetR);
    gl.render(scene, stereoCamera.cameraR);

    gl.setRenderTarget(null);

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
    gl.setViewport(0, 0, halfWidth, viewHeight);
    gl.setScissor(0, 0, halfWidth, viewHeight);
    distortionUniforms.map.value = targetL.texture;
    distortionUniforms.lensCenterX.value = lensShift; // left eye's lens sits inboard, i.e. to the right
    gl.render(distortionScene, distortionCamera);

    gl.setViewport(halfWidth, 0, rightHalfWidth, viewHeight);
    gl.setScissor(halfWidth, 0, rightHalfWidth, viewHeight);
    distortionUniforms.map.value = targetR.texture;
    distortionUniforms.lensCenterX.value = -lensShift;
    gl.render(distortionScene, distortionCamera);

    gl.setScissorTest(false);

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
        presetDprMax: GRAPHICS_PRESETS[graphicsQuality].dpr[1],
        renderScale: RENDER_SCALE,
        rtWidth: eyeWidth,
        rtHeight: eyeHeight,
        eyeViewportWidth: eyeBufferW,
        eyeViewportHeight: eyeBufferH,
        pxPerEyeRatio,
        pxPerEyeRatioAtCenter: pxPerEyeRatio / centerMagnification,
        centerMagnification,

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
