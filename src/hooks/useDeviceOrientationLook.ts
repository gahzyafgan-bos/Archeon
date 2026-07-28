import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { useMuseumStore } from "@/store/useMuseumStore";
import { wrapAngle } from "@/utils/angle";

// Reusable scratch objects (avoid GC pressure in a ~60Hz event handler).
const euler = new THREE.Euler();
const quaternion = new THREE.Quaternion();
const zAxis = new THREE.Vector3(0, 0, 1);
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° around X: camera looks out the back of the device, not off the top
const resultEuler = new THREE.Euler();

/**
 * The live gyro reading, as a plain mutable object rather than store/React
 * state — read straight out of PlayerRig's `useFrame`.
 *
 * This is deliberate, and it is what keeps the stereo view steady. The reading
 * updates every time the sensor fires (~60Hz); routing that through zustand
 * meant a brand-new `vrLook` object per event, which re-rendered PlayerRig —
 * inside the Canvas — 60 times a second, and made the rendered frame consume
 * the value React last *committed* rather than the value the sensor last
 * *reported*. Because the VR look angle is absolute (unlike the non-VR path,
 * where `lookInput` is a rate that gets integrated and so hides latency), that
 * commit lag turned into uneven per-frame angular steps: constant micro-judder.
 * A mutable object has no such scheduling in between — the renderer always
 * sees the newest sample, exactly once, on its own clock.
 */
export const vrLookSource = {
  /** Yaw relative to the current "forward" baseline, radians, wrapped to (-π, π]. */
  yaw: 0,
  /** Pitch relative to the baseline's level reference, radians. */
  pitch: 0,
  /** False until the first usable sensor sample lands (or right after VR is toggled). */
  hasReading: false,
  /**
   * Bumped whenever a new "forward" baseline is adopted — i.e. on VR entry and
   * on every recenter. At that instant `yaw` jumps discontinuously to ~0, so
   * the consumer must re-anchor instead of interpolating across the jump (see
   * PlayerRig's rebaseVRLook).
   */
  epoch: 0,
};

function degToRad(d: number) {
  return d * (Math.PI / 180);
}

function getScreenOrientationAngle(): number {
  if (typeof screen !== "undefined" && screen.orientation) return screen.orientation.angle;
  return 0;
}

/**
 * Converts a raw deviceorientation reading into an absolute yaw/pitch pair,
 * compensating for the current screen orientation. Adapted from the
 * long-standing three.js DeviceOrientationControls algorithm (alpha/beta/gamma
 * -> quaternion -> screen-orientation correction), which is the standard,
 * battle-tested way to do this rather than hand-rolling trig from scratch.
 */
function computeYawPitch(alpha: number, beta: number, gamma: number, screenOrientAngle: number) {
  euler.set(degToRad(beta), degToRad(alpha), -degToRad(gamma), "YXZ");
  quaternion.setFromEuler(euler);
  quaternion.multiply(q1);
  quaternion.multiply(q0.setFromAxisAngle(zAxis, -degToRad(screenOrientAngle)));
  resultEuler.setFromQuaternion(quaternion, "YXZ");
  return { yaw: resultEuler.y, pitch: resultEuler.x };
}

/**
 * Reads the phone's gyroscope (`deviceorientation`) and publishes an absolute,
 * recentered yaw/pitch into `vrLookSource`, which PlayerRig consumes directly
 * in place of the joystick/mouse-driven `lookInput` while VR mode is active.
 * Does not touch `lookInput` itself, so the non-VR look path is untouched.
 *
 * Smoothing lives in PlayerRig, not here: filtering has to run on the same
 * clock as the frame it feeds, otherwise the filter and the renderer tick at
 * independent rates and reintroduce exactly the unevenness it exists to remove.
 * This hook therefore runs no animation loop of its own.
 */
export function useDeviceOrientationLook() {
  const isVRMode = useMuseumStore((s) => s.isVRMode);
  const vrRecenterSignal = useMuseumStore((s) => s.vrRecenterSignal);

  const baseline = useRef<{ yaw: number; pitch: number } | null>(null);

  useEffect(() => {
    // Entering or leaving VR both start from a clean slate: no baseline, no
    // stale reading, and an epoch bump so PlayerRig re-anchors to whatever
    // heading is on screen right now instead of snapping to the gyro's zero.
    baseline.current = null;
    vrLookSource.yaw = 0;
    vrLookSource.pitch = 0;
    vrLookSource.hasReading = false;
    vrLookSource.epoch += 1;

    if (!isVRMode) return;
    if (typeof DeviceOrientationEvent === "undefined") return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      const { yaw, pitch } = computeYawPitch(e.alpha, e.beta, e.gamma, getScreenOrientationAngle());
      // First reading (or the one right after a recenter request) becomes the
      // new "facing forward, level" baseline.
      if (!baseline.current) {
        baseline.current = { yaw, pitch };
        vrLookSource.epoch += 1;
      }
      vrLookSource.yaw = wrapAngle(yaw - baseline.current.yaw);
      vrLookSource.pitch = pitch - baseline.current.pitch;
      vrLookSource.hasReading = true;
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [isVRMode]);

  // "Kalibrasi Ulang Arah Depan" — dropping the baseline makes the very next
  // orientation reading the new forward/level reference. The epoch bump that
  // follows it lets PlayerRig hold the view perfectly still through the
  // switch: recentering changes which way the PHONE means "forward", it must
  // never move where the player is looking.
  useEffect(() => {
    if (vrRecenterSignal === 0) return;
    baseline.current = null;
  }, [vrRecenterSignal]);

  const isSupported = typeof window !== "undefined" && typeof window.DeviceOrientationEvent !== "undefined";
  const needsExplicitPermission =
    isSupported && typeof window.DeviceOrientationEvent.requestPermission === "function";

  /** Must be called from inside a user-gesture handler (button click) — iOS 13+ requirement. */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    if (!needsExplicitPermission) return true; // Android & older browsers: no explicit prompt
    try {
      const result = await window.DeviceOrientationEvent.requestPermission!();
      return result === "granted";
    } catch {
      return false;
    }
  }, [isSupported, needsExplicitPermission]);

  return { isSupported, needsExplicitPermission, requestPermission };
}
