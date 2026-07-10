import { useEffect, useRef } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";

/**
 * Mouse-drag look control for desktop: click-and-drag rotates the camera,
 * feeding the same lookInput vector the right virtual joystick produces on
 * touch devices.
 */
export function useMouseLookControls(domElement: HTMLElement | null) {
  const setLookInput = useMuseumStore((s) => s.setLookInput);
  const isTouchDevice = useMuseumStore((s) => s.isTouchDevice);
  const isMovementLocked = useMuseumStore((s) => s.isMovementLocked);
  const settings = useMuseumStore((s) => s.settings);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isTouchDevice || !domElement) return;

    const onPointerDown = (e: PointerEvent) => {
      if (isMovementLocked) return;
      isDragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current || isMovementLocked) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      // Scale down + clamp so a single mouse-move event behaves like an
      // instantaneous joystick deflection rather than raw pixel deltas.
      // Use look sensitivity from settings
      const baseSensitivity = 0.15;
      const sensitivity = baseSensitivity * settings.lookSensitivity;
      setLookInput({
        x: Math.max(-1, Math.min(1, dx * sensitivity)),
        y: Math.max(-1, Math.min(1, dy * sensitivity * (settings.invertY ? -1 : 1))),
      });
    };

    const onPointerUp = () => {
      isDragging.current = false;
      setLookInput({ x: 0, y: 0 });
    };

    domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [domElement, isTouchDevice, isMovementLocked, setLookInput, settings.lookSensitivity, settings.invertY]);
}
