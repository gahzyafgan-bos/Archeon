import { useEffect, useRef } from "react";
import nipplejs from "nipplejs";
import { useMuseumStore } from "@/store/useMuseumStore";

/**
 * Creates the two nipplejs joysticks described in the spec:
 *  - left zone  -> movement (forward/back/strafe)
 *  - right zone -> look / camera rotation
 *
 * Both write into the same store fields the keyboard/mouse hooks use, so
 * the PlayerController is completely input-agnostic.
 */
export function useVirtualJoysticks(
  leftZoneRef: React.RefObject<HTMLDivElement>,
  rightZoneRef: React.RefObject<HTMLDivElement>
) {
  const setMoveInput = useMuseumStore((s) => s.setMoveInput);
  const setLookInput = useMuseumStore((s) => s.setLookInput);
  const isTouchDevice = useMuseumStore((s) => s.isTouchDevice);
  const isMovementLocked = useMuseumStore((s) => s.isMovementLocked);
  const managers = useRef<ReturnType<typeof nipplejs.create>[]>([]);

  useEffect(() => {
    if (!isTouchDevice) return;
    if (!leftZoneRef.current || !rightZoneRef.current) return;

    const leftManager = nipplejs.create({
      zone: leftZoneRef.current,
      mode: "static",
      position: { left: "50%", top: "50%" },
      color: "#c9a961",
      size: 100,
      restOpacity: 0.35,
    });

    const rightManager = nipplejs.create({
      zone: rightZoneRef.current,
      mode: "static",
      position: { left: "50%", top: "50%" },
      color: "#e8e6e1",
      size: 100,
      restOpacity: 0.35,
    });

    leftManager.on("move", (_evt, data) => {
      if (isMovementLocked) return;
      const distance = Math.min(data.distance, 50) / 50;
      const rad = data.angle.radian;
      setMoveInput({
        x: Math.cos(rad) * distance,
        y: Math.sin(rad) * distance,
      });
    });
    leftManager.on("end", () => setMoveInput({ x: 0, y: 0 }));

    rightManager.on("move", (_evt, data) => {
      const distance = Math.min(data.distance, 50) / 50;
      const rad = data.angle.radian;
      setLookInput({
        x: Math.cos(rad) * distance,
        y: -Math.sin(rad) * distance,
      });
    });
    rightManager.on("end", () => setLookInput({ x: 0, y: 0 }));

    managers.current = [leftManager, rightManager];

    return () => {
      managers.current.forEach((m) => m.destroy());
      managers.current = [];
    };
  }, [isTouchDevice, isMovementLocked, leftZoneRef, rightZoneRef, setMoveInput, setLookInput]);
}
