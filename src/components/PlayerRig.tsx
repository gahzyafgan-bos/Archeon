import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useMuseumStore } from "@/store/useMuseumStore";
import type { RoomConfig } from "@/data/roomConfig";
import type { Artifact } from "@/types/artifact";

const BASE_MOVE_SPEED = 4.2; // world units / second
const BASE_LOOK_SPEED = 2.2; // radians / second at full joystick deflection
const PLAYER_RADIUS = 0.5; // simple circular collision radius
const PROXIMITY_RADIUS = 2.6; // distance at which an artifact becomes "nearby"
const EYE_HEIGHT = 1.7;
const BASE_FOCUS_LERP = 4.5; // higher = snappier ease into/out of the artifact zoom
const ACCELERATION = 6;
const DECELERATION = 8;
const LOOK_SMOOTHING = 8;
const HEAD_BOB_AMPLITUDE = 0.03;
const HEAD_BOB_FREQUENCY = 10;

// Cubic ease-in-out function
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface PlayerRigProps {
  room: RoomConfig;
  artifacts: Artifact[];
  onEnterDoor: (targetRoom: RoomConfig["doors"][number]) => void;
}

/**
 * Central movement + interaction system. Kept as a single component (rather
 * than splitting movement/collision/proximity across many files) so all
 * per-frame logic reads the camera's authoritative position exactly once.
 */
export function PlayerRig({ room, artifacts, onEnterDoor }: PlayerRigProps) {
  const { camera } = useThree();
  const yaw = useRef(room.spawn.facingY);
  const targetYaw = useRef(room.spawn.facingY);
  const pitch = useRef(0);
  const targetPitch = useRef(0);
  const doorCooldown = useRef(false);
  const savedPose = useRef<{ position: THREE.Vector3; yaw: number; pitch: number } | null>(null);
  const currentVelocity = useRef(new THREE.Vector3(0, 0, 0));
  const walkTime = useRef(0);

  // Reusable vectors to avoid GC pressure
  const targetVelocity = useRef(new THREE.Vector3(0, 0, 0));
  const forward = useRef(new THREE.Vector3(0, 0, 0));
  const strafe = useRef(new THREE.Vector3(0, 0, 0));
  const deltaPos = useRef(new THREE.Vector3(0, 0, 0));
  const lookDir = useRef(new THREE.Vector3(0, 0, 0));

  const moveInput = useMuseumStore((s) => s.moveInput);
  const lookInput = useMuseumStore((s) => s.lookInput);
  const isVRMode = useMuseumStore((s) => s.isVRMode);
  const vrLook = useMuseumStore((s) => s.vrLook);
  const isMovementLocked = useMuseumStore((s) => s.isMovementLocked);
  const setNearbyArtifact = useMuseumStore((s) => s.setNearbyArtifact);
  const nearbyArtifactId = useMuseumStore((s) => s.nearbyArtifact?.id);
  const focusedArtifact = useMuseumStore((s) => s.focusedArtifact);
  const settings = useMuseumStore((s) => s.settings);

  // (Re)place the player at the room's spawn point whenever the room changes or FOV changes.
  useEffect(() => {
    // Use door-specific spawn point if available, otherwise fall back to room default
    const pending = useMuseumStore.getState().pendingSpawnPoint;
    const spawn = pending || room.spawn;

    camera.position.set(spawn.x, EYE_HEIGHT, spawn.z);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = settings.cameraFOV;
      camera.updateProjectionMatrix();
    }
    yaw.current = spawn.facingY;
    targetYaw.current = spawn.facingY;
    pitch.current = 0;
    targetPitch.current = 0;
    currentVelocity.current.set(0, 0, 0);
    doorCooldown.current = true;

    // Clear pending spawn point after use
    if (pending) {
      useMuseumStore.getState().setPendingSpawnPoint(null);
    }

    const t = setTimeout(() => (doorCooldown.current = false), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, camera, settings.cameraFOV]);

  useFrame((_, delta) => {
    // --- Smooth zoom-in/out when an artifact is focused/unfocused ---
    const focusLerp = settings.reduceMotion ? 15 : BASE_FOCUS_LERP;
    if (focusedArtifact) {
      if (!savedPose.current) {
        savedPose.current = {
          position: camera.position.clone(),
          yaw: yaw.current,
          pitch: pitch.current,
        };
      }
      const target = focusedArtifact.koordinat_ruangan;
      const targetPos = new THREE.Vector3(target.x, target.y + 0.3, target.z + 1.6);
      // Use cubic ease-in-out, or faster if reduceMotion enabled
      const t = 1 - Math.pow(0.001, delta * focusLerp);
      const ease = settings.reduceMotion ? 1 : easeInOutCubic(t);
      camera.position.lerp(targetPos, ease);

      lookDir.current.set(target.x, target.y, target.z).sub(camera.position);
      const targetYawVal = Math.atan2(-lookDir.current.x, -lookDir.current.z);
      const targetPitchVal = Math.atan2(
        lookDir.current.y,
        Math.sqrt(lookDir.current.x * lookDir.current.x + lookDir.current.z * lookDir.current.z)
      );
      yaw.current += (targetYawVal - yaw.current) * ease;
      pitch.current += (targetPitchVal - pitch.current) * ease;
      targetYaw.current = yaw.current;
      targetPitch.current = pitch.current;
      camera.rotation.order = "YXZ";
      camera.rotation.set(pitch.current, yaw.current, 0);
      return; // skip normal movement/look/proximity logic while focused
    } else if (savedPose.current) {
      const t = 1 - Math.pow(0.001, delta * focusLerp);
      const ease = settings.reduceMotion ? 1 : easeInOutCubic(t);
      camera.position.lerp(savedPose.current.position, ease);
      yaw.current += (savedPose.current.yaw - yaw.current) * ease;
      pitch.current += (savedPose.current.pitch - pitch.current) * ease;
      targetYaw.current = yaw.current;
      targetPitch.current = pitch.current;
      camera.rotation.order = "YXZ";
      camera.rotation.set(pitch.current, yaw.current, 0);
      if (camera.position.distanceTo(savedPose.current.position) < 0.02 || settings.reduceMotion) {
        camera.position.copy(savedPose.current.position);
        yaw.current = savedPose.current.yaw;
        pitch.current = savedPose.current.pitch;
        targetYaw.current = yaw.current;
        targetPitch.current = pitch.current;
        savedPose.current = null;
      }
      return; // finish easing back before handing control back to the player
    }

    if (isVRMode) {
      // VR Cardboard mode: look direction comes straight from the phone's
      // gyroscope (useDeviceOrientationLook), already smoothed/recentered —
      // bypass the joystick/mouse integration below entirely. Keep yaw/pitch
      // refs in sync so control falls back smoothly if VR mode is toggled off.
      yaw.current = vrLook.yaw;
      pitch.current = vrLook.pitch;
      targetYaw.current = yaw.current;
      targetPitch.current = pitch.current;
    } else {
      // --- Look rotation with deadzone, sensitivity curve & smoothing ---
      // Get deadzone value from settings
      const deadzoneVal =
        settings.deadzone === "small" ? 0.05 : settings.deadzone === "medium" ? 0.1 : 0.2;

      // Apply deadzone
      let lookX = Math.abs(lookInput.x) > deadzoneVal ? lookInput.x : 0;
      let lookY = Math.abs(lookInput.y) > deadzoneVal ? lookInput.y : 0;

      // Apply sensitivity curve (cubic for more precision at low inputs)
      if (lookX !== 0) {
        const sign = Math.sign(lookX);
        lookX = sign * Math.pow(Math.abs(lookX), 3);
      }
      if (lookY !== 0) {
        const sign = Math.sign(lookY);
        lookY = sign * Math.pow(Math.abs(lookY), 3);
      }

      // Apply look sensitivity and invert Y if needed
      const lookSpeed = BASE_LOOK_SPEED * settings.lookSensitivity;
      targetYaw.current -= lookX * lookSpeed * delta;
      targetPitch.current -= (settings.invertY ? -lookY : lookY) * lookSpeed * delta;
      targetPitch.current = Math.max(-1.1, Math.min(1.1, targetPitch.current));

      // Smooth camera rotation
      yaw.current += (targetYaw.current - yaw.current) * LOOK_SMOOTHING * delta;
      pitch.current += (targetPitch.current - pitch.current) * LOOK_SMOOTHING * delta;
    }

    camera.rotation.order = "YXZ";
    camera.rotation.set(pitch.current, yaw.current, 0);

    // --- Movement with acceleration, deceleration, sliding collision & headbob ---
    targetVelocity.current.set(0, 0, 0);
    if (!isMovementLocked) {
      // Apply deadzone to move input
      const deadzoneVal =
        settings.deadzone === "small" ? 0.05 : settings.deadzone === "medium" ? 0.1 : 0.2;
      let moveX = Math.abs(moveInput.x) > deadzoneVal ? moveInput.x : 0;
      let moveY = Math.abs(moveInput.y) > deadzoneVal ? moveInput.y : 0;

      if (moveX !== 0 || moveY !== 0) {
        forward.current.set(
          Math.sin(yaw.current) * -1,
          0,
          Math.cos(yaw.current) * -1
        );
        strafe.current.set(forward.current.z, 0, -forward.current.x);

        targetVelocity.current
          .set(0, 0, 0)
          .addScaledVector(forward.current, moveY)
          .addScaledVector(strafe.current, -moveX)
          .normalize()
          .multiplyScalar(BASE_MOVE_SPEED * settings.moveSensitivity);
      }
    }

    // Acceleration and deceleration
    if (targetVelocity.current.lengthSq() > 0) {
      currentVelocity.current.lerp(targetVelocity.current, ACCELERATION * delta);
      walkTime.current += delta;
    } else {
      currentVelocity.current.lerp(new THREE.Vector3(0, 0, 0), DECELERATION * delta);
      // Fade out walk time smoothly to prevent sudden head bob stop
      walkTime.current = Math.max(0, walkTime.current - delta * 3);
      // When almost stopped, set velocity to zero to stop any residual movement
      if (currentVelocity.current.lengthSq() < 0.001) {
        currentVelocity.current.set(0, 0, 0);
        walkTime.current = 0;
      }
    }

    // Calculate movement delta
    deltaPos.current.copy(currentVelocity.current).multiplyScalar(delta);

    if (deltaPos.current.lengthSq() > 0) {
      let nextX = camera.position.x + deltaPos.current.x;
      let nextZ = camera.position.z + deltaPos.current.z;
      const { minX, maxX, minZ, maxZ } = room.bounds;

      // 1. Collision with room boundaries
      nextX = Math.max(minX + PLAYER_RADIUS, Math.min(maxX - PLAYER_RADIUS, nextX));
      nextZ = Math.max(minZ + PLAYER_RADIUS, Math.min(maxZ - PLAYER_RADIUS, nextZ));

      // 2. Collision with artifacts
      for (const artifact of artifacts) {
        const artifactX = artifact.koordinat_ruangan.x;
        const artifactZ = artifact.koordinat_ruangan.z;
        const artifactRadius = 0.8; // Collision radius for artifacts
        
        const dx = nextX - artifactX;
        const dz = nextZ - artifactZ;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const minDist = PLAYER_RADIUS + artifactRadius;
        
        if (distance < minDist) {
          // Push player away from artifact
          const angle = Math.atan2(dz, dx);
          nextX = artifactX + Math.cos(angle) * minDist;
          nextZ = artifactZ + Math.sin(angle) * minDist;
        }
      }

      camera.position.x = nextX;
      camera.position.z = nextZ;

      // Head bob, disabled if reduceMotion is on
      if (!settings.reduceMotion) {
        const bob = Math.sin(walkTime.current * HEAD_BOB_FREQUENCY) * HEAD_BOB_AMPLITUDE;
        camera.position.y = EYE_HEIGHT + bob;
      } else {
        camera.position.y = EYE_HEIGHT;
      }
    } else {
      camera.position.y = EYE_HEIGHT;
    }

    // --- Doorway detection ---
    if (!doorCooldown.current && !isMovementLocked) {
      for (const door of room.doors) {
        const dx = camera.position.x - door.position.x;
        const dz = camera.position.z - door.position.z;
        if (dx * dx + dz * dz < door.radius * door.radius) {
          doorCooldown.current = true;
          onEnterDoor(door);
          // Longer cooldown to prevent accidental double-transitions
          setTimeout(() => (doorCooldown.current = false), 1500);
          break;
        }
      }
    }

    // --- Artifact proximity (skip while an artifact is already focused) ---
    if (!focusedArtifact) {
      let closest: Artifact | null = null;
      let closestDist = PROXIMITY_RADIUS;
      for (const artifact of artifacts) {
        const dx = camera.position.x - artifact.koordinat_ruangan.x;
        const dz = camera.position.z - artifact.koordinat_ruangan.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < closestDist) {
          closest = artifact;
          closestDist = dist;
        }
      }
      if (closest?.id !== nearbyArtifactId) {
        setNearbyArtifact(closest);
      }
    }
  });

  return null;
}
