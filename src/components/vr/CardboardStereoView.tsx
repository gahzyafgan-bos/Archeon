import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Average human interpupillary distance is ~0.064 world units given this
 * scene's scale (1 unit = 1 meter, confirmed by PlayerRig's EYE_HEIGHT of
 * 1.7). Starting at the spec's suggested 0.032 for a gentler first pass —
 * raise it toward ~0.06 if the stereo depth feels too subtle once tested on
 * a real headset.
 */
const EYE_SEPARATION = 0.032;

/**
 * Renders the same scene twice side-by-side (one per eye) for Cardboard-style
 * viewers, using three.js's built-in StereoCamera for the eye-offset/frustum
 * math instead of duplicating the whole <Canvas> (which would double the
 * cost of WebGL context init). Both eyes are drawn via manual
 * gl.setScissor/setViewport inside a single useFrame callback — registering
 * that callback with a positive priority hands us full control of the
 * render loop and disables react-three-fiber's default auto-render, which
 * is the documented way to do custom/multi-viewport rendering in R3F.
 */
export function CardboardStereoView() {
  const { gl, scene, camera, size } = useThree();
  const stereoCamera = useMemo(() => {
    const cam = new THREE.StereoCamera();
    cam.aspect = 0.5; // each eye only gets half the canvas width
    return cam;
  }, []);

  useEffect(() => {
    // Leaving VR mode: make sure a stray scissor rect never survives into normal rendering.
    return () => gl.setScissorTest(false);
  }, [gl]);

  useFrame(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    stereoCamera.eyeSep = EYE_SEPARATION;
    camera.updateMatrixWorld();
    stereoCamera.update(camera);

    const halfWidth = size.width / 2;
    gl.setScissorTest(true);

    gl.setViewport(0, 0, halfWidth, size.height);
    gl.setScissor(0, 0, halfWidth, size.height);
    gl.render(scene, stereoCamera.cameraL);

    gl.setViewport(halfWidth, 0, halfWidth, size.height);
    gl.setScissor(halfWidth, 0, halfWidth, size.height);
    gl.render(scene, stereoCamera.cameraR);

    gl.setScissorTest(false);
  }, 1);

  return null;
}
