import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useMuseumStore } from "@/store/useMuseumStore";

/**
 * Render-target resolution relative to each eye's actual on-screen pixel
 * size. The distorted output is viewed squashed through a Cardboard lens, so
 * mild softness at the edges is invisible there — trading a bit of sharpness
 * for this headroom keeps frame rate comfortable on mid-range phones (see
 * spec section 5: barrel distortion via render targets adds cost).
 */
const RENDER_SCALE = 0.9;

/**
 * Millimetres per CSS pixel, used to turn the user's lens-separation setting
 * into a pixel offset. The web deliberately exposes no physical screen size,
 * so this is an estimate: mobile browsers pick a devicePixelRatio that lands
 * their CSS pixel density somewhere around 130-150 CSS-dpi (iPhone 14 Pro
 * ~148, Pixel 7 ~148, Galaxy S21 ~128, iPad ~131), rather than the 96 dpi the
 * CSS spec nominally anchors to. 140 sits in the middle of that spread, so the
 * default lands within roughly 10% on most phones — and the settings slider
 * exists precisely to absorb the rest, since only the person looking through
 * the lenses can tell when the two images have actually fused.
 */
const MM_PER_CSS_PX = 25.4 / 140;

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
  uniform float toneMappingExposure;
  varying vec2 vUv;

  // ---- Display transform -------------------------------------------------
  // Rendering to a render target makes three skip both of these, so this pass
  // has to perform them itself — exactly once, on the way to the screen. Both
  // functions are copied verbatim from three's own tonemapping_pars_fragment
  // and colorspace_pars_fragment chunks rather than approximated, because the
  // whole point is for VR to match normal mode pixel for pixel; a "close
  // enough" curve would leave a tint of its own.
  vec3 RRTAndODTFit( vec3 v ) {
    vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
    vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
    return a / b;
  }

  vec3 ACESFilmicToneMapping( vec3 color ) {
    const mat3 ACESInputMat = mat3(
      vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ),
      vec3( 0.04823, 0.01566, 0.83777 )
    );
    const mat3 ACESOutputMat = mat3(
      vec3(  1.60475, -0.10208, -0.00327 ), vec3( -0.53108,  1.10813, -0.07276 ),
      vec3( -0.07367, -0.00605,  1.07602 )
    );
    color *= toneMappingExposure / 0.6;
    color = ACESInputMat * color;
    color = RRTAndODTFit( color );
    color = ACESOutputMat * color;
    return clamp( color, 0.0, 1.0 );
  }

  vec3 sRGBTransferOETF( vec3 value ) {
    return mix(
      pow( value, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ),
      value * 12.92,
      vec3( lessThanEqual( value, vec3( 0.0031308 ) ) )
    );
  }

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    centered.x -= lensCenterX;
    centered.x *= aspect; // keep the distortion radius circular, not elliptical, on a wide viewport
    float r2 = dot(centered, centered);
    float factor = 1.0 + k1 * r2 + k2 * r2 * r2;
    vec2 distorted = centered * factor;
    distorted.x /= aspect;
    distorted.x += lensCenterX;
    vec2 sampleUv = distorted * 0.5 + 0.5;

    if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
      vec3 linearColor = texture2D(map, sampleUv).rgb;
      gl_FragColor = vec4(sRGBTransferOETF(ACESFilmicToneMapping(linearColor)), 1.0);
    }
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
  const { gl, scene, camera, size } = useThree();
  const vrIPD = useMuseumStore((s) => s.settings.vrIPD);
  const vrLensSeparationMm = useMuseumStore((s) => s.settings.vrLensSeparationMm);
  const vrDistortionK1 = useMuseumStore((s) => s.settings.vrDistortionK1);
  const vrDistortionK2 = useMuseumStore((s) => s.settings.vrDistortionK2);

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
          toneMappingExposure: { value: 1 },
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

    const halfWidth = size.width / 2;
    const eyeWidth = Math.max(2, Math.round(halfWidth * gl.getPixelRatio() * RENDER_SCALE));
    const eyeHeight = Math.max(2, Math.round(size.height * gl.getPixelRatio() * RENDER_SCALE));

    if (lastTargetSize.current.width !== eyeWidth || lastTargetSize.current.height !== eyeHeight) {
      targetL.setSize(eyeWidth, eyeHeight);
      targetR.setSize(eyeWidth, eyeHeight);
      lastTargetSize.current = { width: eyeWidth, height: eyeHeight };
    }

    stereoCamera.eyeSep = vrIPD;
    camera.updateMatrixWorld();
    stereoCamera.update(camera);

    // --- Lens-centre alignment -------------------------------------------
    // Where each eye's lens axis falls inside its own half of the screen,
    // expressed in the -1..1 space that spans that half. A plain 50/50 split
    // puts the two image centres half a screen-width apart; the viewer's
    // lenses are a fixed ~63mm apart, so both images have to move inboard by
    // the difference. At the point where a half-screen already equals the lens
    // spacing this comes out as 0 and nothing moves.
    const lensSeparationPx = vrLensSeparationMm / MM_PER_CSS_PX;
    const lensShift = Math.max(-0.5, Math.min(0.9, 1 - lensSeparationPx / halfWidth));

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
    distortionUniforms.aspect.value = halfWidth / size.height;
    // Read the exposure off the renderer rather than the graphics preset, so
    // this pass reproduces whatever normal mode would have applied — including
    // any later change to how exposure is chosen.
    distortionUniforms.toneMappingExposure.value = gl.toneMappingExposure;

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
    gl.setViewport(0, 0, halfWidth, size.height);
    gl.setScissor(0, 0, halfWidth, size.height);
    distortionUniforms.map.value = targetL.texture;
    distortionUniforms.lensCenterX.value = lensShift; // left eye's lens sits inboard, i.e. to the right
    gl.render(distortionScene, distortionCamera);

    gl.setViewport(halfWidth, 0, halfWidth, size.height);
    gl.setScissor(halfWidth, 0, halfWidth, size.height);
    distortionUniforms.map.value = targetR.texture;
    distortionUniforms.lensCenterX.value = -lensShift;
    gl.render(distortionScene, distortionCamera);

    gl.setScissorTest(false);
  }, 1);

  return null;
}
