import { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useMuseumStore } from "@/store/useMuseumStore";
import { vrLookSource } from "@/hooks/useDeviceOrientationLook";
import { GREETER_COLLIDER_RADIUS, getGreetersForRoom } from "@/data/greeters";
import type { RoomConfig } from "@/data/roomConfig";
import type { Artifact } from "@/types/artifact";
import { objectFootprintRadius } from "@/utils/artifactSize";
import { buildDecorColliders } from "@/utils/placementValidator";
import { lerpAngle, wrapAngle } from "@/utils/angle";
import { verticalFovForEyeAspect } from "@/utils/vrOptics";

// Shared immutable zero vector — Vector3.lerp() only READS its target, never
// mutates it, so a single frozen instance is safe to reuse as the decelerate
// target instead of allocating `new THREE.Vector3(0,0,0)` every frame the
// player is slowing to a stop (a per-frame GC source on mobile).
const ZERO_VEC = new THREE.Vector3(0, 0, 0);

const BASE_MOVE_SPEED = 4.2; // world units / second
const BASE_LOOK_SPEED = 2.2; // radians / second at full joystick deflection
const PLAYER_RADIUS = 0.5; // simple circular collision radius

/**
 * Hard ceiling on how much time a single frame is allowed to advance the world.
 *
 * Collision here is resolved as ONE discrete step per frame: the next position
 * is computed, then pushed back out of whatever it landed inside. That is fine
 * as long as a single step is small compared to the things it has to collide
 * with — and catastrophic the moment it isn't, because a step longer than an
 * obstacle is wide simply starts and ends on opposite sides of it, with nothing
 * in between for the push-out to react to.
 *
 * The audit measured this happening for real, not in theory. Frame gaps of
 * 1353 ms and 2190 ms were recorded — from model decoding, from the tab being
 * backgrounded, from a screen lock — and at 4.2 m/s the longer one moved the
 * player 9.2 metres in a single collision step. Hall 1 is 15 m deep and the
 * archway trigger is 5 m across, so one hitch could carry a visitor clean over
 * the trigger, or dump them on the far side of the room. Walking straight from
 * the spawn point reached Hall 2 in 1047 ms, a journey of 10.5 m that should
 * take 2.5 seconds.
 *
 * 1/15 s caps one step at 4.2 / 15 = 0.28 m — comfortably inside PLAYER_RADIUS
 * (0.5 m), so the player can never step past their own collision circle no
 * matter how long the browser was away. The cost of clamping is that time
 * "stops" during a hitch instead of jumping: after a 2-second freeze the
 * visitor is where they were, not somewhere across the hall. That is the
 * correct trade — nobody expects to keep walking while the screen is off.
 *
 * Applied to the whole frame, not just movement: an exponential smoother fed a
 * 2-second delta snaps to its target anyway, so every consumer below wants the
 * same clamp.
 */
const MAX_FRAME_DELTA = 1 / 15;

/**
 * How much of a decor object's *placement* footprint is solid.
 *
 * placementValidator's radii answer a different question than collision does:
 * they say how much clear floor a piece is entitled to so the room doesn't read
 * as cluttered, which is deliberately wider than the object. A colonnade pillar
 * is listed at 0.50 m but its shaft is nearer 0.26 m. Using the placement number
 * as-is would stop the visitor a hand's width short of every column — an
 * invisible wall, which reads as a bug even though nothing is wrong.
 *
 * 0.6 lands the collider just outside the visible geometry: solid enough that
 * nobody walks through a pillar, close enough that the stop always has
 * something in front of it to explain itself.
 */
const DECOR_COLLIDER_SCALE = 0.6;
const PROXIMITY_RADIUS = 2.6; // distance at which an artifact becomes "nearby"
const EYE_HEIGHT = 1.7;
const BASE_FOCUS_LERP = 4.5; // higher = snappier ease into/out of the artifact zoom
const ACCELERATION = 6;
const DECELERATION = 8;
const LOOK_SMOOTHING = 8;
const HEAD_BOB_AMPLITUDE = 0.03;
const HEAD_BOB_FREQUENCY = 10;

/** Pitch (look up/down) IS clamped — ±1.4 rad ≈ ±80°, just short of straight
 * up/down so the view can never flip over or gimbal-lock. Yaw deliberately has
 * no equivalent constant: see the wrapYaw note in useFrame. */
const PITCH_LIMIT = 1.4;
const TWO_PI = Math.PI * 2;

/**
 * Low-pass strength for the raw gyro reading in VR mode, as the lambda in the
 * project's usual frame-rate-independent `1 - exp(-lambda * delta)` damping.
 *
 * The previous value ran through `1 - pow(0.001, delta * 18)`, which is
 * `1 - exp(-124 * delta)` — an alpha of ~0.87 per 60fps frame, i.e. the sensor
 * was passed through very nearly raw. Phone gyros always carry a little noise,
 * and in a stereo view held centimetres from the eyes that noise reads as a
 * constant shimmer. 25 gives a ~40ms time constant: enough to settle the
 * jitter, short enough that head movement still feels attached to the head
 * (over-smoothing head tracking causes its own "swimming" discomfort).
 */
const VR_LOOK_DAMPING = 25;

/**
 * Each eye's viewport is half the canvas wide and the full canvas tall, so its
 * aspect is half the canvas aspect. This is the same 0.5 that
 * CardboardStereoView hands THREE.StereoCamera, and three multiplies
 * `camera.aspect` by it internally — the two must agree or the eye render and
 * the eye viewport are framed differently.
 */
const STEREO_EYE_ASPECT_MULTIPLIER = 0.5;

// Cubic ease-in-out function
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Deadzone + response curve for one look axis, shared by every look source
 * (touch stick, gamepad right stick, mouse drag) so they all feel the same.
 *
 * Two things it does that the old `|v|^3` didn't:
 *  - rescales from the deadzone edge, so response starts at 0 instead of
 *    jumping to the deadzone value the instant the stick crosses it (and so a
 *    gamepad, whose hook already applied its own radial deadzone, isn't
 *    deadzoned twice);
 *  - blends linear+quadratic instead of cubing. Cubing crushed the mid-range
 *    to almost nothing — a stick held at 60% gave 0.6³ = 0.22, i.e. ~0.48
 *    rad/s, ~13 seconds for one full turn. On a phone that reads as the view
 *    "nyangkut" and refusing to keep rotating. This keeps fine control near
 *    centre (0.3 -> 0.17) while making a normal push actually turn you
 *    (0.6 -> 0.46, ~6s per full turn; full deflection is unchanged at 1.0).
 */
function shapeLookAxis(value: number, deadzone: number): number {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  const m = Math.min(1, (magnitude - deadzone) / (1 - deadzone));
  return Math.sign(value) * (0.4 * m + 0.6 * m * m);
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
  const { camera, size } = useThree();
  const yaw = useRef(room.spawn.facingY);
  const targetYaw = useRef(room.spawn.facingY);
  const pitch = useRef(0);
  const targetPitch = useRef(0);
  const doorCooldown = useRef(false);
  // Last archway label pushed to the store — kept so the store is written only
  // when it actually changes rather than on every frame — and the last confirm
  // signal already consumed.
  const lastPublishedDoorLabel = useRef<string | null>(null);
  const doorConfirmSeen = useRef(useMuseumStore.getState().doorConfirmSignal);
  const savedPose = useRef<{ position: THREE.Vector3; yaw: number; pitch: number } | null>(null);
  const currentVelocity = useRef(new THREE.Vector3(0, 0, 0));
  const walkTime = useRef(0);

  // Reusable vectors to avoid GC pressure
  const targetVelocity = useRef(new THREE.Vector3(0, 0, 0));
  const forward = useRef(new THREE.Vector3(0, 0, 0));
  const strafe = useRef(new THREE.Vector3(0, 0, 0));
  const deltaPos = useRef(new THREE.Vector3(0, 0, 0));
  const lookDir = useRef(new THREE.Vector3(0, 0, 0));
  const facingDir = useRef(new THREE.Vector3(0, 0, 0));
  // Reused focus-zoom target (was allocated fresh every frame while an
  // artifact is focused — see the focus block in useFrame).
  const focusTargetPos = useRef(new THREE.Vector3(0, 0, 0));
  // DEV-only: throttle for the look telemetry below. Total turn is tracked
  // separately from `yaw` (which wraps) so a device test can read "how many
  // full turns did holding the stick actually produce".
  const lastLookLog = useRef(0);
  const totalYawTurned = useRef(0);

  // --- VR head-look state ---
  // World-space heading that the gyro's (recentered, so ~0 = "forward") yaw is
  // applied on top of. Without it, activating VR would slam the view to world
  // yaw 0 regardless of where the player was facing a frame earlier.
  const vrYawBase = useRef(0);
  // Smoothed gyro reading. Lives here, not in the sensor hook, so the filter
  // advances exactly once per rendered frame on the renderer's own delta.
  const vrSmoothed = useRef({ yaw: 0, pitch: 0 });
  const vrEpochSeen = useRef(-1);

  // Static per-artifact collision/proximity data, computed once per artifact
  // list instead of recomputing objectFootprintRadius() twice per artifact
  // every frame (collision loop + proximity loop below). Artifact positions
  // are fixed, so their collision radius and `E`-trigger radius never change
  // between frames — only the player moves. (spec Fase 5: "dihitung sekali
  // saat load/posisi berubah, bukan tiap frame".)
  const colliders = useMemo(
    () =>
      artifacts.map((artifact) => {
        const footprint = objectFootprintRadius(artifact) ?? 0;
        return {
          artifact,
          x: artifact.koordinat_ruangan.x,
          z: artifact.koordinat_ruangan.z,
          // Grows with real_world_size so a life-size bicycle/statue isn't
          // walkable-through past a flat 0.8m stand-in radius.
          collisionRadius: Math.max(0.8, footprint),
          // Big real-world objects trigger the `E` prompt from farther away
          // than their old miniature placeholder did.
          triggerRadius: PROXIMITY_RADIUS + footprint,
        };
      }),
    [artifacts]
  );

  // The welcome-zone greeters are people, not artifacts, so they carry no
  // proximity/`E` trigger — only a plain capsule so a visitor can't walk
  // through someone. Same precomputed shape as `colliders`; they never move.
  const greeterColliders = useMemo(
    () =>
      getGreetersForRoom(room.id).map((greeter) => ({
        x: greeter.position[0],
        z: greeter.position[2],
        collisionRadius: GREETER_COLLIDER_RADIUS,
      })),
    [room.id]
  );

  // Pillars, signboards, the Dwarapala pair, the centre installation, the
  // stone clusters. Taken from the placement validator so the collider set and
  // the rendered set are the same list — see buildDecorColliders.
  //
  // The validator's radius is a *placement* footprint: how much clear floor the
  // piece is entitled to, which is deliberately more generous than the object
  // itself. Walking into an invisible wall half a metre from a pillar feels
  // like a bug, so the collider is pulled in to the geometry it represents.
  const decorColliders = useMemo(
    () =>
      buildDecorColliders(room, artifacts).map((o) => ({
        x: o.x,
        z: o.z,
        collisionRadius: Math.max(0.2, o.radius * DECOR_COLLIDER_SCALE),
      })),
    [room, artifacts]
  );

  // `moveInput` / `lookInput` / `vrLookOffset` are deliberately NOT subscribed
  // to: every one of them is rewritten as a fresh object on every poll of
  // whichever input is being held (gamepad, joystick), so subscribing meant
  // this component — mounted inside the Canvas — re-rendered ~60×/sec for the
  // entire time the player was moving or looking, and the frame then used the
  // value React had last committed rather than the newest one. They're read
  // out of the store imperatively inside useFrame instead, which is both
  // cheaper and always current. Everything below changes rarely enough that a
  // normal subscription is the right tool.
  const isVRMode = useMuseumStore((s) => s.isVRMode);
  const isMovementLocked = useMuseumStore((s) => s.isMovementLocked);
  const setNearbyArtifact = useMuseumStore((s) => s.setNearbyArtifact);
  const nearbyArtifactId = useMuseumStore((s) => s.nearbyArtifact?.id);
  const focusedArtifact = useMuseumStore((s) => s.focusedArtifact);
  const settings = useMuseumStore((s) => s.settings);

  // Camera FOV, kept in one place so there is a single owner of the value —
  // this effect is the ONLY thing in the app that writes camera.fov. It has to
  // be re-asserted on every hall change too, otherwise walking through an
  // archway mid-session would quietly hand the stereo view the user's
  // flat-screen FOV back.
  //
  // Mono and VR are allowed to differ here, and only here. In VR the field of
  // view is not a taste setting: the Cardboard lens shows each eye a fixed
  // ~90° and the render has to match it or the world is the wrong size. What
  // is deliberate is which axis is pinned — the HORIZONTAL field is the
  // constant and the vertical is derived from the eye viewport's real aspect
  // (see vrOptics). Pinning the vertical instead, as a bare `fov = 80` did,
  // hands every phone a different horizontal field and so a different apparent
  // world scale, because the eye viewport's shape follows the handset's.
  useEffect(() => {
    if (!('fov' in camera)) return;
    const eyeAspect = (size.width / size.height) * STEREO_EYE_ASPECT_MULTIPLIER;
    (camera as THREE.PerspectiveCamera).fov = isVRMode
      ? verticalFovForEyeAspect(eyeAspect)
      : settings.cameraFOV;
    // Changing fov without this does nothing at all — the projection matrix is
    // only rebuilt on demand.
    camera.updateProjectionMatrix();
  }, [camera, isVRMode, settings.cameraFOV, room.id, size.width, size.height]);

  // (Re)place the player at the room's spawn point whenever the room changes.
  useEffect(() => {
    // Use door-specific spawn point if available, otherwise fall back to room default
    const pending = useMuseumStore.getState().pendingSpawnPoint;
    const spawn = pending || room.spawn;

    camera.position.set(spawn.x, EYE_HEIGHT, spawn.z);
    yaw.current = spawn.facingY;
    targetYaw.current = spawn.facingY;
    pitch.current = 0;
    targetPitch.current = 0;
    currentVelocity.current.set(0, 0, 0);
    doorCooldown.current = true;
    // The archway prompt belongs to the hall the player just left; carrying it
    // across would offer to cross a doorway that is no longer under their feet.
    lastPublishedDoorLabel.current = null;
    useMuseumStore.getState().setNearbyDoorLabel(null);

    // Clear pending spawn point after use
    if (pending) {
      useMuseumStore.getState().setPendingSpawnPoint(null);
    }

    const t = setTimeout(() => (doorCooldown.current = false), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, camera]);

  /**
   * Re-anchors VR head-look so that the view does not move at this instant.
   * Called whenever the gyro's frame of reference jumps out from under us —
   * on VR entry, on every recenter, and when the artifact-focus animation
   * hands control back — by choosing `vrYawBase` such that the yaw currently
   * on screen is exactly what the new reading reproduces. Also snaps the
   * smoothing state to the live sample, so the filter doesn't spend its time
   * constant catching up across a discontinuity it should never have seen.
   */
  const rebaseVRLook = () => {
    const offset = useMuseumStore.getState().vrLookOffset;
    vrSmoothed.current.yaw = vrLookSource.yaw;
    vrSmoothed.current.pitch = vrLookSource.pitch;
    vrEpochSeen.current = vrLookSource.epoch;
    vrYawBase.current = wrapAngle(yaw.current - vrLookSource.yaw - offset.yaw);
  };

  useFrame((_, rawDelta) => {
    // Every use of `delta` below this line is the clamped one — see
    // MAX_FRAME_DELTA for why a raw frame delta is not safe to integrate.
    const delta = Math.min(rawDelta, MAX_FRAME_DELTA);
    const { moveInput, lookInput, vrLookOffset } = useMuseumStore.getState();

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
      const targetPos = focusTargetPos.current;
      if (isVRMode) {
        // Approach from whichever side the visitor already stands on, at a
        // distance that grows with the object.
        //
        // The flat-screen path below always parks the camera at a fixed
        // z + 1.6, which is fine there because the info panel and its blur
        // cover most of the view anyway. In VR that framing IS the entire
        // view, and a fixed +Z offset walks the camera straight into a wall
        // whenever a piece is displayed against the far side of the room, or
        // straight inside the object itself now that a bicycle is 1.6m wide
        // and a motorcycle 1.9m. Either way the visitor's whole world goes
        // dark — which is exactly the reported symptom.
        const from = savedPose.current.position;
        const dx = from.x - target.x;
        const dz = from.z - target.z;
        const len = Math.hypot(dx, dz) || 1;
        const size = focusedArtifact.real_world_size;
        const extent = size ? Math.max(size.width, size.height, size.depth) : 0;
        const standoff = Math.max(1.5, extent * 1.15 + 0.9);
        targetPos.set(
          target.x + (dx / len) * standoff,
          Math.max(1.2, target.y + 0.25),
          target.z + (dz / len) * standoff
        );
      } else {
        targetPos.set(target.x, target.y + 0.3, target.z + 1.6);
      }
      // Use cubic ease-in-out, or faster if reduceMotion enabled
      const t = 1 - Math.pow(0.001, delta * focusLerp);
      const ease = settings.reduceMotion ? 1 : easeInOutCubic(t);
      camera.position.lerp(targetPos, ease);

      if (isVRMode) {
        // Never wrest the view away from the head. Turning someone's gaze for
        // them inside a headset is disorienting at best; since we now approach
        // from the side they were already standing on, the piece stays in
        // front of them anyway. Position eases in, direction stays theirs.
        if (vrLookSource.epoch !== vrEpochSeen.current) {
          rebaseVRLook();
        } else if (vrLookSource.hasReading) {
          const smoothing = 1 - Math.exp(-VR_LOOK_DAMPING * delta);
          vrSmoothed.current.yaw = lerpAngle(vrSmoothed.current.yaw, vrLookSource.yaw, smoothing);
          vrSmoothed.current.pitch += (vrLookSource.pitch - vrSmoothed.current.pitch) * smoothing;
        }
        yaw.current = wrapAngle(vrYawBase.current + vrSmoothed.current.yaw + vrLookOffset.yaw);
        pitch.current = Math.max(
          -PITCH_LIMIT,
          Math.min(PITCH_LIMIT, vrSmoothed.current.pitch + vrLookOffset.pitch)
        );
      } else {
        lookDir.current.set(target.x, target.y, target.z).sub(camera.position);
        const targetYawVal = Math.atan2(-lookDir.current.x, -lookDir.current.z);
        const targetPitchVal = Math.atan2(
          lookDir.current.y,
          Math.sqrt(lookDir.current.x * lookDir.current.x + lookDir.current.z * lookDir.current.z)
        );
        yaw.current += (targetYawVal - yaw.current) * ease;
        pitch.current += (targetPitchVal - pitch.current) * ease;
      }
      targetYaw.current = yaw.current;
      targetPitch.current = pitch.current;
      camera.rotation.order = "YXZ";
      camera.rotation.set(pitch.current, yaw.current, 0);
      return; // skip normal movement/look/proximity logic while focused
    } else if (savedPose.current) {
      const t = 1 - Math.pow(0.001, delta * focusLerp);
      const ease = settings.reduceMotion ? 1 : easeInOutCubic(t);
      camera.position.lerp(savedPose.current.position, ease);
      // In VR the head kept control of the view the whole time the artifact was
      // focused, so there is no rotation to give back — only the position eases
      // home. Forcing the saved heading here would yank the view for no reason.
      if (!isVRMode) {
        yaw.current += (savedPose.current.yaw - yaw.current) * ease;
        pitch.current += (savedPose.current.pitch - pitch.current) * ease;
      }
      targetYaw.current = yaw.current;
      targetPitch.current = pitch.current;
      camera.rotation.order = "YXZ";
      camera.rotation.set(pitch.current, yaw.current, 0);
      if (camera.position.distanceTo(savedPose.current.position) < 0.02 || settings.reduceMotion) {
        camera.position.copy(savedPose.current.position);
        if (!isVRMode) {
          yaw.current = savedPose.current.yaw;
          pitch.current = savedPose.current.pitch;
        }
        targetYaw.current = yaw.current;
        targetPitch.current = pitch.current;
        savedPose.current = null;
      }
      return; // finish easing back before handing control back to the player
    }

    if (isVRMode) {
      // VR Cardboard mode: look direction comes from the phone's gyroscope
      // (vrLookSource, published by useDeviceOrientationLook) — bypass the
      // joystick/mouse integration below entirely. The gamepad right stick may
      // add an extra yaw/pitch offset on top (vrLookOffset) for players who
      // can't physically swivel; it's zero unless the stick is used, so
      // head-look stays authoritative by default. Keep yaw/pitch refs in sync
      // so control falls back smoothly if VR mode is toggled off.
      if (vrLookSource.epoch !== vrEpochSeen.current) {
        // A new "forward" baseline was just adopted (VR entry / recenter): the
        // reported yaw has jumped to ~0. Re-anchor rather than interpolate.
        rebaseVRLook();
      } else if (vrLookSource.hasReading) {
        // Filter the raw sensor here, on the render clock, so every frame
        // advances the low-pass exactly once by its own delta.
        const t = 1 - Math.exp(-VR_LOOK_DAMPING * delta);
        vrSmoothed.current.yaw = lerpAngle(vrSmoothed.current.yaw, vrLookSource.yaw, t);
        vrSmoothed.current.pitch += (vrLookSource.pitch - vrSmoothed.current.pitch) * t;
      }

      yaw.current = wrapAngle(vrYawBase.current + vrSmoothed.current.yaw + vrLookOffset.yaw);
      pitch.current = Math.max(
        -PITCH_LIMIT,
        Math.min(PITCH_LIMIT, vrSmoothed.current.pitch + vrLookOffset.pitch)
      );
      targetYaw.current = yaw.current;
      targetPitch.current = pitch.current;
    } else {
      // --- Look rotation with deadzone, sensitivity curve & smoothing ---
      // Get deadzone value from settings
      const deadzoneVal =
        settings.deadzone === "small" ? 0.05 : settings.deadzone === "medium" ? 0.1 : 0.2;

      // Deadzone + response curve (see shapeLookAxis).
      const lookX = shapeLookAxis(lookInput.x, deadzoneVal);
      const lookY = shapeLookAxis(lookInput.y, deadzoneVal);

      // `lookInput` is a RATE, not an angle: it says how hard the stick is
      // pushed, and is integrated here over delta time. That is what makes the
      // turn incremental — hold the stick and yaw keeps accumulating, so the
      // player can spin 360° as many times as they like.
      const lookSpeed = BASE_LOOK_SPEED * settings.lookSensitivity;
      const yawDelta = -lookX * lookSpeed * delta;
      targetYaw.current += yawDelta;
      totalYawTurned.current += yawDelta;

      // DEV-only look telemetry (same throttled pattern as useGamepadControls'
      // axes log). Lets an on-device test confirm the fix directly: hold the
      // look stick one way and `turns` must keep climbing without ever
      // settling, while `pitch` stops at the ±1.40 limit by design.
      if (import.meta.env.DEV && (lookX !== 0 || lookY !== 0)) {
        const now = performance.now();
        if (now - lastLookLog.current > 500) {
          lastLookLog.current = now;
          // eslint-disable-next-line no-console
          console.log(
            `[look] in=(${lookInput.x.toFixed(2)}, ${lookInput.y.toFixed(2)}) ` +
              `shaped=(${lookX.toFixed(2)}, ${lookY.toFixed(2)}) ` +
              `yaw=${yaw.current.toFixed(2)} pitch=${pitch.current.toFixed(2)} ` +
              `turns=${(totalYawTurned.current / TWO_PI).toFixed(2)}`
          );
        }
      }

      // Yaw is NEVER clamped — clamping it is exactly what stops a player from
      // turning past a fixed heading. To keep the accumulated value from
      // growing without bound (float precision), wrap it back into (-π, π] by
      // MODULO, and shift the smoothed `yaw` by the same whole number of turns.
      // Shifting both together leaves (target - yaw) bit-for-bit identical, so
      // the smoothing below can't see the wrap: no jump or stall at ±180°.
      if (targetYaw.current > Math.PI || targetYaw.current < -Math.PI) {
        const turns = Math.round(targetYaw.current / TWO_PI);
        targetYaw.current -= turns * TWO_PI;
        yaw.current -= turns * TWO_PI;
      }

      // Pitch, unlike yaw, IS clamped — looking past ~80° up/down would flip
      // the view over. This limit is correct behaviour, not a bug.
      targetPitch.current -= (settings.invertY ? -lookY : lookY) * lookSpeed * delta;
      targetPitch.current = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, targetPitch.current));

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
      const moveX = Math.abs(moveInput.x) > deadzoneVal ? moveInput.x : 0;
      const moveY = Math.abs(moveInput.y) > deadzoneVal ? moveInput.y : 0;

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
      currentVelocity.current.lerp(ZERO_VEC, DECELERATION * delta);
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

      // 2. Collision with artifacts (radii precomputed once in `colliders`)
      for (const c of colliders) {
        const dx = nextX - c.x;
        const dz = nextZ - c.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const minDist = PLAYER_RADIUS + c.collisionRadius;

        if (distance < minDist) {
          // Push player away from artifact
          const angle = Math.atan2(dz, dx);
          nextX = c.x + Math.cos(angle) * minDist;
          nextZ = c.z + Math.sin(angle) * minDist;
        }
      }

      // 3. Collision with the welcome-zone greeters — same slide-around
      // response, kept as its own loop (rather than one merged array built
      // per frame) so nothing is allocated here.
      for (const g of greeterColliders) {
        const dx = nextX - g.x;
        const dz = nextZ - g.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const minDist = PLAYER_RADIUS + g.collisionRadius;

        if (distance < minDist) {
          const angle = Math.atan2(dz, dx);
          nextX = g.x + Math.cos(angle) * minDist;
          nextZ = g.z + Math.sin(angle) * minDist;
        }
      }

      // 4. Collision with the hall's own architecture and set dressing.
      // Same response again, same reason for a separate loop.
      for (const d of decorColliders) {
        const dx = nextX - d.x;
        const dz = nextZ - d.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const minDist = PLAYER_RADIUS + d.collisionRadius;

        if (distance < minDist) {
          const angle = Math.atan2(dz, dx);
          nextX = d.x + Math.cos(angle) * minDist;
          nextZ = d.z + Math.sin(angle) * minDist;
        }
      }

      camera.position.x = nextX;
      camera.position.z = nextZ;

      // Head bob, disabled if reduceMotion is on — and always off in VR. A
      // 3cm vertical oscillation at 10Hz is a subtle touch on a flat screen,
      // but through Cardboard lenses it's the whole world shaking, and camera
      // motion the inner ear didn't ask for is the classic trigger for
      // simulator sickness.
      if (!settings.reduceMotion && !isVRMode) {
        const bob = Math.sin(walkTime.current * HEAD_BOB_FREQUENCY) * HEAD_BOB_AMPLITUDE;
        camera.position.y = EYE_HEIGHT + bob;
      } else {
        camera.position.y = EYE_HEIGHT;
      }
    } else {
      camera.position.y = EYE_HEIGHT;
    }

    // --- Doorway detection ---
    // Standing in the archway no longer crosses it. The trigger geometry is
    // unchanged; what it produces now is a prompt, and the crossing itself
    // waits for `doorConfirmSignal`. See the store's nearbyDoorLabel for the
    // measurement that motivated this.
    let doorInRange: (typeof room.doors)[number] | null = null;
    if (!doorCooldown.current && !isMovementLocked && !focusedArtifact) {
      for (const door of room.doors) {
        const dx = camera.position.x - door.position.x;
        const dz = camera.position.z - door.position.z;
        if (dx * dx + dz * dz < door.radius * door.radius) {
          doorInRange = door;
          break;
        }
      }
    }
    const doorLabel = doorInRange?.label ?? null;
    if (doorLabel !== lastPublishedDoorLabel.current) {
      lastPublishedDoorLabel.current = doorLabel;
      useMuseumStore.getState().setNearbyDoorLabel(doorLabel);
    }

    const confirmSignal = useMuseumStore.getState().doorConfirmSignal;
    if (confirmSignal !== doorConfirmSeen.current) {
      doorConfirmSeen.current = confirmSignal;
      if (doorInRange) {
        doorCooldown.current = true;
        lastPublishedDoorLabel.current = null;
        useMuseumStore.getState().setNearbyDoorLabel(null);
        onEnterDoor(doorInRange);
        // Keeps the arrival point from immediately re-prompting for the
        // archway the visitor just came out of.
        setTimeout(() => (doorCooldown.current = false), 1500);
      }
    }

    // --- Artifact proximity (skip while an artifact is already focused) ---
    if (!focusedArtifact) {
      // Where the player is actually looking (XZ plane), so the `E` label
      // matches the piece in front of them. Without this, in a packed row the
      // raw-closest-center artifact wins even when the player faces a different
      // one — the "Lihat Telepon Antik" label appearing while standing at the
      // bicycle, because two trigger zones (a wide bike + a nearby table) overlap
      // and the table's center happened to be marginally closer.
      camera.getWorldDirection(facingDir.current);

      // Prefer the closest artifact the player is FACING; fall back to the
      // closest overall only when nothing in range is in front (so turning
      // toward a piece still selects it, but a piece behind you never steals
      // the label from the one you're looking at).
      let closestFront: Artifact | null = null;
      let closestFrontDist = Infinity;
      let closestAny: Artifact | null = null;
      let closestAnyDist = Infinity;
      for (const c of colliders) {
        const toX = c.x - camera.position.x;
        const toZ = c.z - camera.position.z;
        const dist = Math.sqrt(toX * toX + toZ * toZ);
        // triggerRadius precomputed once (grows with real_world_size so big
        // pieces raise the `E` prompt from farther out than a mini placeholder).
        if (dist >= c.triggerRadius) continue;

        if (dist < closestAnyDist) {
          closestAny = c.artifact;
          closestAnyDist = dist;
        }
        // Facing test on the XZ plane: dot of the look direction with the
        // (normalized) direction to the artifact. > 0 means it's in the front
        // half — i.e. roughly where the camera points, not behind the player.
        const invLen = dist > 1e-4 ? 1 / dist : 0;
        const facing = facingDir.current.x * toX * invLen + facingDir.current.z * toZ * invLen;
        if (facing > 0 && dist < closestFrontDist) {
          closestFront = c.artifact;
          closestFrontDist = dist;
        }
      }
      const closest = closestFront ?? closestAny;
      if (closest?.id !== nearbyArtifactId) {
        setNearbyArtifact(closest);
      }
    }
  });

  return null;
}
