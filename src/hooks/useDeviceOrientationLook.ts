import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { useMuseumStore } from "@/store/useMuseumStore";

const DAMPING = 18; // near-instant — deliberately much snappier than the joystick's LOOK_SMOOTHING
const PITCH_LIMIT = 1.4; // radians, mirrors PlayerRig's own pitch clamp

// Reusable scratch objects (avoid GC pressure in a ~60Hz event handler).
const euler = new THREE.Euler();
const quaternion = new THREE.Quaternion();
const zAxis = new THREE.Vector3(0, 0, 1);
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° around X: camera looks out the back of the device, not off the top
const resultEuler = new THREE.Euler();

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

/** Shortest-path angle lerp so yaw doesn't spin the long way around at the ±π wraparound. */
function lerpAngle(from: number, to: number, t: number) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

function wrapAngle(a: number) {
  let wrapped = a % (Math.PI * 2);
  if (wrapped > Math.PI) wrapped -= Math.PI * 2;
  if (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

/**
 * Reads the phone's gyroscope (`deviceorientation`) and writes an absolute,
 * recentered yaw/pitch into the store's `vrLook`, which PlayerRig consumes
 * directly in place of the joystick/mouse-driven `lookInput` while VR mode
 * is active. Does not touch `lookInput` itself, so the non-VR look path is
 * untouched.
 */
export function useDeviceOrientationLook() {
  const isVRMode = useMuseumStore((s) => s.isVRMode);
  const setVRLook = useMuseumStore((s) => s.setVRLook);
  const vrRecenterSignal = useMuseumStore((s) => s.vrRecenterSignal);

  const baseline = useRef<{ yaw: number; pitch: number } | null>(null);
  const target = useRef({ yaw: 0, pitch: 0 });
  const smoothed = useRef({ yaw: 0, pitch: 0 });

  useEffect(() => {
    if (!isVRMode) {
      baseline.current = null;
      return;
    }
    if (typeof DeviceOrientationEvent === "undefined") return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      const { yaw, pitch } = computeYawPitch(e.alpha, e.beta, e.gamma, getScreenOrientationAngle());
      // First reading (or the one right after a recenter request) becomes the new "facing forward, level" baseline.
      if (!baseline.current) baseline.current = { yaw, pitch };
      target.current = {
        yaw: wrapAngle(yaw - baseline.current.yaw),
        pitch: pitch - baseline.current.pitch,
      };
    };
    window.addEventListener("deviceorientation", handleOrientation);

    let last = performance.now();
    let rafId = requestAnimationFrame(function tick(now) {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = 1 - Math.pow(0.001, delta * DAMPING);
      smoothed.current.yaw = lerpAngle(smoothed.current.yaw, target.current.yaw, t);
      smoothed.current.pitch += (target.current.pitch - smoothed.current.pitch) * t;
      setVRLook({
        yaw: smoothed.current.yaw,
        pitch: Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, smoothed.current.pitch)),
      });
      rafId = requestAnimationFrame(tick);
    });

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      cancelAnimationFrame(rafId);
    };
  }, [isVRMode, setVRLook]);

  // "Kalibrasi Ulang Arah Depan" — dropping the baseline makes the very next
  // orientation reading the new forward/level reference.
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
