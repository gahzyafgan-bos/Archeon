import { useEffect, useRef } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";

/**
 * WASD / Arrow-key movement for desktop. Mirrors the left virtual joystick
 * output (-1..1 on both axes) so the PlayerController never needs to know
 * which input device produced the movement vector.
 */
export function useKeyboardControls() {
  const setMoveInput = useMuseumStore((s) => s.setMoveInput);
  const isMovementLocked = useMuseumStore((s) => s.isMovementLocked);
  const isTouchDevice = useMuseumStore((s) => s.isTouchDevice);
  const keys = useRef({ forward: false, back: false, left: false, right: false });

  useEffect(() => {
    if (isTouchDevice) return; // joystick hook owns movement on touch devices

    const updateVector = () => {
      const { forward, back, left, right } = keys.current;
      const y = (forward ? 1 : 0) - (back ? 1 : 0);
      const x = (right ? 1 : 0) - (left ? 1 : 0);
      setMoveInput(isMovementLocked ? { x: 0, y: 0 } : { x, y });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          keys.current.forward = true;
          break;
        case "KeyS":
        case "ArrowDown":
          keys.current.back = true;
          break;
        case "KeyA":
        case "ArrowLeft":
          keys.current.left = true;
          break;
        case "KeyD":
        case "ArrowRight":
          keys.current.right = true;
          break;
      }
      updateVector();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          keys.current.forward = false;
          break;
        case "KeyS":
        case "ArrowDown":
          keys.current.back = false;
          break;
        case "KeyA":
        case "ArrowLeft":
          keys.current.left = false;
          break;
        case "KeyD":
        case "ArrowRight":
          keys.current.right = false;
          break;
      }
      updateVector();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      setMoveInput({ x: 0, y: 0 });
    };
  }, [isTouchDevice, isMovementLocked, setMoveInput]);
}
