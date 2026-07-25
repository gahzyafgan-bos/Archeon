import { useEffect, useRef } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";

/**
 * Button indices per the Gamepad API "standard" layout (Xbox-style pad,
 * the most commonly recognized mapping in browsers) — see README for the
 * documented assumption and how to remap for a different Bluetooth pad.
 */
const BUTTON_INTERACT = 0; // A / X — same action as the touch "X" / desktop "E" prompt
const BUTTON_BACK = 1; // B — step back out of a focused artifact
const BUTTON_RECENTER = 8; // Back/Select — recenter the gyro's "forward"
const BUTTON_EXIT_VR = 9; // Start — leave VR mode without touching the screen

/**
 * Axis indices per the Gamepad API "standard" mapping:
 *   axes[0]/axes[1] = LEFT stick  (X / Y) -> movement
 *   axes[2]/axes[3] = RIGHT stick (X / Y) -> look / POV   <-- previously never read
 * Most Bluetooth HID pads (incl. the REXUS ASTA V2 GX150 V2) report
 * `mapping === "standard"` and follow this. If a given pad differs, the
 * DEV-only axes log below prints the live values so the indices can be
 * verified on-device and adjusted here.
 */
const AXIS_MOVE_X = 0;
const AXIS_MOVE_Y = 1;
const AXIS_LOOK_X = 2;
const AXIS_LOOK_Y = 3;

// Radial deadzone applied to each stick in this hook so a resting stick reads
// exactly {0,0} — kills analog drift at the source (the earlier version fed raw
// axes and relied solely on PlayerRig's deadzone, which let drift leak into the
// look channel and spin the view slowly on some pads).
const STICK_DEADZONE = 0.15;

// Base turn rate (radians/sec at full deflection) for the right stick while in
// VR mode, where PlayerRig reads the gyro's absolute rotation and would ignore
// the shared `lookInput` rate channel. Scaled by the user's look sensitivity.
const VR_STICK_LOOK_SPEED = 2.2;

// Only notify the store when a value actually changes past this epsilon —
// `poll` runs every frame, and writing a fresh {x,y} object each frame would
// re-render every lookInput/moveInput subscriber (e.g. PlayerRig) 60×/sec.
const CHANGE_EPS = 0.002;

function clamp(v: number) {
  return Math.max(-1, Math.min(1, v));
}

/**
 * Radial deadzone: below the threshold the stick reads {0,0}; above it, the
 * remaining magnitude is rescaled back to a full 0..1 range so there's no jump
 * at the deadzone edge. Direction is preserved (better than per-axis clamping,
 * which biases diagonals).
 */
function applyStickDeadzone(x: number, y: number, dz: number) {
  const mag = Math.hypot(x, y);
  if (mag < dz) return { x: 0, y: 0 };
  const scale = ((mag - dz) / (1 - dz)) / mag;
  return { x: clamp(x * scale), y: clamp(y * scale) };
}

/**
 * Polls `navigator.getGamepads()` every frame and drives the same `moveInput`
 * (left stick) and `lookInput` (right stick) the virtual joysticks/keyboard/
 * mouse feed, plus the artifact-interaction/recenter/exit button actions.
 *
 * Movement AND look now work both inside and outside VR mode — the earlier
 * version gated everything behind `isVRMode` and never read the right stick, so
 * outside a Cardboard headset the pad did nothing, and inside it the POV could
 * only be changed by physically moving the phone. Look routing per mode:
 *   - non-VR: right stick -> `lookInput` (PlayerRig integrates it as a rate and
 *     applies the existing deadzone / sensitivity curve / invert-Y, so it feels
 *     identical to the touch look-joystick).
 *   - VR: right stick accumulates `vrLookOffset` on top of the gyro's absolute
 *     look, so it turns the view without fighting head-tracking.
 *
 * The connection-detection part runs regardless of mode so the pre-entry screen
 * can tell the user their pad is actually seen by the browser.
 */
export function useGamepadControls() {
  const setMoveInput = useMuseumStore((s) => s.setMoveInput);
  const setLookInput = useMuseumStore((s) => s.setLookInput);
  const setVRLookOffset = useMuseumStore((s) => s.setVRLookOffset);
  const setIsGamepadConnected = useMuseumStore((s) => s.setIsGamepadConnected);

  const pressedRef = useRef<Record<number, boolean>>({});
  const rafRef = useRef<number | null>(null);
  // Last values pushed to the store, for change-detection (see CHANGE_EPS).
  const lastMove = useRef({ x: 0, y: 0 });
  const lastLook = useRef({ x: 0, y: 0 });
  // Accumulated VR right-stick offset, mirrored into the store.
  const vrOffset = useRef({ yaw: 0, pitch: 0 });
  const lastPollTime = useRef<number | null>(null);
  const lastAxesLog = useRef(0);

  useEffect(() => {
    const handleConnected = () => setIsGamepadConnected(true);
    const handleDisconnected = () => {
      if (navigator.getGamepads().every((g) => !g)) setIsGamepadConnected(false);
    };
    window.addEventListener("gamepadconnected", handleConnected);
    window.addEventListener("gamepaddisconnected", handleDisconnected);
    return () => {
      window.removeEventListener("gamepadconnected", handleConnected);
      window.removeEventListener("gamepaddisconnected", handleDisconnected);
    };
  }, [setIsGamepadConnected]);

  useEffect(() => {
    if (typeof navigator.getGamepads !== "function") return;

    const firePress = (pad: Gamepad, index: number, onPress: () => void) => {
      const pressed = pad.buttons[index]?.pressed ?? false;
      if (pressed && !pressedRef.current[index]) onPress();
      pressedRef.current[index] = pressed;
    };

    const pushMove = (x: number, y: number) => {
      if (Math.abs(x - lastMove.current.x) < CHANGE_EPS && Math.abs(y - lastMove.current.y) < CHANGE_EPS) return;
      lastMove.current = { x, y };
      setMoveInput({ x, y });
    };
    const pushLook = (x: number, y: number) => {
      if (Math.abs(x - lastLook.current.x) < CHANGE_EPS && Math.abs(y - lastLook.current.y) < CHANGE_EPS) return;
      lastLook.current = { x, y };
      setLookInput({ x, y });
    };
    const resetVROffset = () => {
      if (vrOffset.current.yaw === 0 && vrOffset.current.pitch === 0) return;
      vrOffset.current = { yaw: 0, pitch: 0 };
      setVRLookOffset({ yaw: 0, pitch: 0 });
    };

    const poll = () => {
      const now = performance.now();
      const delta = lastPollTime.current === null ? 0 : Math.min(0.05, (now - lastPollTime.current) / 1000);
      lastPollTime.current = now;

      const pad = navigator.getGamepads().find((g): g is Gamepad => g !== null);

      if (pad) {
        const state = useMuseumStore.getState();
        if (!state.isGamepadConnected) setIsGamepadConnected(true);

        const { isVRMode, settings } = state;

        // --- DEV-only: verify this controller's real axis indices on-device ---
        if (import.meta.env.DEV) {
          const anyActive = pad.axes.some((a) => Math.abs(a ?? 0) > 0.3);
          if (anyActive && now - lastAxesLog.current > 500) {
            lastAxesLog.current = now;
            // eslint-disable-next-line no-console
            console.log(
              `[gamepad] mapping="${pad.mapping}" axes=[${pad.axes.map((a) => (a ?? 0).toFixed(2)).join(", ")}]`
            );
          }
        }

        // --- Left stick -> movement (both modes) ---
        const move = applyStickDeadzone(pad.axes[AXIS_MOVE_X] ?? 0, pad.axes[AXIS_MOVE_Y] ?? 0, STICK_DEADZONE);
        // moveInput.y is forward+; stick-up is negative on the Y axis, so invert.
        pushMove(move.x, -move.y);

        // --- Right stick -> look / POV ---
        const look = applyStickDeadzone(pad.axes[AXIS_LOOK_X] ?? 0, pad.axes[AXIS_LOOK_Y] ?? 0, STICK_DEADZONE);
        if (isVRMode) {
          // Gyro owns the absolute look; the stick only nudges an offset on top.
          // Keep non-VR lookInput at rest so nothing lingers when VR toggles off.
          pushLook(0, 0);
          if (look.x !== 0 || look.y !== 0) {
            const speed = VR_STICK_LOOK_SPEED * settings.lookSensitivity;
            const pitchDir = settings.invertY ? -look.y : look.y;
            vrOffset.current = {
              // Sign matches the non-VR path (PlayerRig subtracts lookInput),
              // so stick-right turns right and stick-up looks up consistently.
              yaw: vrOffset.current.yaw - look.x * speed * delta,
              pitch: Math.max(-1.1, Math.min(1.1, vrOffset.current.pitch - pitchDir * speed * delta)),
            };
            setVRLookOffset(vrOffset.current);
          }
        } else {
          // Feed the raw (deadzoned) stick as a rate; PlayerRig applies the
          // deadzone / cubic sensitivity curve / lookSensitivity / invertY,
          // exactly like the touch right-joystick. Axis directions already
          // match that joystick (right = +x, up = -y).
          resetVROffset();
          pushLook(look.x, look.y);
        }

        // --- Buttons ---
        firePress(pad, BUTTON_INTERACT, () => {
          const s = useMuseumStore.getState();
          if (!s.focusedArtifact && s.nearbyArtifact) s.focusArtifact(s.nearbyArtifact);
        });
        firePress(pad, BUTTON_BACK, () => {
          const s = useMuseumStore.getState();
          if (s.focusedArtifact) s.focusArtifact(null);
        });
        if (isVRMode) {
          firePress(pad, BUTTON_RECENTER, () => {
            resetVROffset(); // recenter clears the accumulated stick turn too
            useMuseumStore.getState().requestVRRecenter();
          });
          firePress(pad, BUTTON_EXIT_VR, () => useMuseumStore.getState().setVRMode(false));
        }
      }

      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      // Don't leave the view drifting or the player walking if the hook unmounts.
      lastPollTime.current = null;
      pushMove(0, 0);
      pushLook(0, 0);
      resetVROffset();
    };
  }, [setMoveInput, setLookInput, setVRLookOffset, setIsGamepadConnected]);
}
