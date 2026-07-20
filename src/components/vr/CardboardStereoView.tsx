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
  varying vec2 vUv;

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    centered.x *= aspect; // keep the distortion radius circular, not elliptical, on a wide viewport
    float r2 = dot(centered, centered);
    float factor = 1.0 + k1 * r2 + k2 * r2 * r2;
    vec2 distorted = centered * factor;
    distorted.x /= aspect;
    vec2 sampleUv = distorted * 0.5 + 0.5;

    if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
      gl_FragColor = texture2D(map, sampleUv);
    }
  }
`;

function createEyeRenderTarget() {
  const target = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  // Match the renderer's output encoding so the distortion pass can sample
  // this texture and write it straight to the screen with no extra
  // colorspace conversion of its own.
  target.texture.colorSpace = THREE.SRGBColorSpace;
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

  useEffect(() => {
    return () => {
      gl.setScissorTest(false);
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

    const distortionUniforms = distortionMaterial.uniforms;
    distortionUniforms.k1.value = vrDistortionK1;
    distortionUniforms.k2.value = vrDistortionK2;
    distortionUniforms.aspect.value = halfWidth / size.height;

    gl.setScissorTest(false);

    // Pass 1: render each eye's scene into its own off-screen target.
    gl.setRenderTarget(targetL);
    gl.render(scene, stereoCamera.cameraL);

    gl.setRenderTarget(targetR);
    gl.render(scene, stereoCamera.cameraR);

    gl.setRenderTarget(null);

    // Pass 2: barrel-distort each render target onto its half of the screen.
    gl.setScissorTest(true);

    gl.setViewport(0, 0, halfWidth, size.height);
    gl.setScissor(0, 0, halfWidth, size.height);
    distortionUniforms.map.value = targetL.texture;
    gl.render(distortionScene, distortionCamera);

    gl.setViewport(halfWidth, 0, halfWidth, size.height);
    gl.setScissor(halfWidth, 0, halfWidth, size.height);
    distortionUniforms.map.value = targetR.texture;
    gl.render(distortionScene, distortionCamera);

    gl.setScissorTest(false);
  }, 1);

  return null;
}
