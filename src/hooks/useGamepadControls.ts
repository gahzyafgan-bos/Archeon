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

function clamp(v: number) {
  return Math.max(-1, Math.min(1, v));
}

/**
 * Polls `navigator.getGamepads()` every frame and, while VR mode is active,
 * drives the same `moveInput` the virtual joystick/keyboard hooks use plus
 * the artifact-interaction/recenter/exit actions — all mapped to gamepad
 * buttons since the touchscreen is unreachable inside a Cardboard headset.
 *
 * The connection-detection part runs regardless of VR mode so the pre-entry
 * screen can tell the user their pad is actually seen by the browser.
 */
export function useGamepadControls() {
  const isVRMode = useMuseumStore((s) => s.isVRMode);
  const setMoveInput = useMuseumStore((s) => s.setMoveInput);
  const setIsGamepadConnected = useMuseumStore((s) => s.setIsGamepadConnected);

  const pressedRef = useRef<Record<number, boolean>>({});
  const rafRef = useRef<number | null>(null);

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

    const poll = () => {
      const pad = navigator.getGamepads().find((g): g is Gamepad => g !== null);

      if (pad) {
        if (!useMuseumStore.getState().isGamepadConnected) setIsGamepadConnected(true);

        if (isVRMode) {
          // Deadzone is intentionally not re-applied here: moveInput already
          // passes through PlayerRig's existing settings.deadzone handling
          // regardless of source (joystick/keyboard/gamepad), so filtering
          // twice would just duplicate that logic.
          setMoveInput({ x: clamp(pad.axes[0] ?? 0), y: clamp(-(pad.axes[1] ?? 0)) });

          firePress(pad, BUTTON_INTERACT, () => {
            const state = useMuseumStore.getState();
            if (!state.focusedArtifact && state.nearbyArtifact) {
              state.focusArtifact(state.nearbyArtifact);
            }
          });
          firePress(pad, BUTTON_BACK, () => {
            const state = useMuseumStore.getState();
            if (state.focusedArtifact) state.focusArtifact(null);
          });
          firePress(pad, BUTTON_RECENTER, () => useMuseumStore.getState().requestVRRecenter());
          firePress(pad, BUTTON_EXIT_VR, () => useMuseumStore.getState().setVRMode(false));
        }
      }

      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (isVRMode) setMoveInput({ x: 0, y: 0 });
    };
  }, [isVRMode, setMoveInput, setIsGamepadConnected]);
}
