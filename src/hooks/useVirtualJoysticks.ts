import { useEffect, useRef } from "react";
import nipplejs from "nipplejs";
import { useMuseumStore } from "@/store/useMuseumStore";
import { useShowTouchControls } from "./useShowTouchControls";

/**
 * Creates the two nipplejs joysticks described in the spec:
 *  - left zone  -> movement (forward/back/strafe)
 *  - right zone -> look / camera rotation
 *
 * Both write into the same store fields the keyboard/mouse hooks use, so
 * the PlayerController is completely input-agnostic.
 *
 * Both sticks are RATE controls, not absolute pointers: the vector written to
 * the store is "which way and how hard the stick is pushed", and PlayerRig
 * integrates it over time (`targetYaw -= x * speed * delta`). That is what lets
 * the look stick spin the camera a full 360° as many times as the player keeps
 * holding it — nothing here ever maps a stick position to an absolute camera
 * angle, which would cap rotation at the ±π that `atan2` can express.
 */

/** nipplejs handle travel, px. Bigger than the old 50 so the thumb has real
 * room before it runs out of glass — see LOOK_SATURATION. */
const STICK_SIZE = 120;
const MAX_TRAVEL = STICK_SIZE / 2;

/**
 * Fraction of the stick's travel at which the LOOK stick already reports full
 * deflection. The look stick lives in the bottom-right corner, so "push right
 * and hold to keep turning" pushes the thumb toward the edge of the screen —
 * overshoot there fires `touchcancel`, nipplejs ends the gesture, and the
 * rotation stops dead mid-turn. That is the "noleh mentok, harus geser ulang"
 * symptom: not a rotation limit, but the gesture being dropped at the bezel.
 * Saturating at 75% means max turn rate is reached well before the rim, so the
 * player never has to fight for the last pixels of travel.
 */
const LOOK_SATURATION = 0.75;

/**
 * Takes the zone ELEMENTS, not refs to them.
 *
 * This distinction is the whole ballgame. A `useRef` object keeps the same
 * identity forever, so an effect listing it as a dependency never re-runs when
 * the element it points at is finally attached — and these zones mount late,
 * only once loading and onboarding are done. The effect would fire while
 * `ref.current` was still null, bail out, and never get another chance:
 * two empty 160px divs in the DOM and no joystick inside either of them.
 * Passing the elements themselves (via callback refs upstream) means React
 * re-runs this every time a zone attaches or detaches, which is exactly when
 * nipplejs needs to be created or torn down.
 */
export function useVirtualJoysticks(
  leftZone: HTMLElement | null,
  rightZone: HTMLElement | null
) {
  const setMoveInput = useMuseumStore((s) => s.setMoveInput);
  const setLookInput = useMuseumStore((s) => s.setLookInput);
  const showTouchControls = useShowTouchControls();
  const managers = useRef<ReturnType<typeof nipplejs.create>[]>([]);

  useEffect(() => {
    if (!showTouchControls) return;
    if (!leftZone || !rightZone) return;

    const common = {
      mode: "static" as const,
      position: { left: "50%", top: "50%" },
      size: STICK_SIZE,
      // 0.35 left the pale right-hand stick almost invisible against the
      // gallery's bright ivory floor. Paired with the dark backing disc the
      // zones now carry (see HUD), both sticks read clearly at rest without
      // becoming a heavy overlay.
      restOpacity: 0.6,
      restJoystick: true,
      // Re-measure the zone on each gesture — the HUD sits on a fixed layer
      // whose offset changes when the mobile address bar collapses/expands.
      dynamicPage: true,
    };

    const leftManager = nipplejs.create({
      ...common,
      zone: leftZone,
      color: "#c9a961",
    });

    const rightManager = nipplejs.create({
      ...common,
      zone: rightZone,
      color: "#e8e6e1",
    });

    leftManager.on("move", (_evt, data) => {
      // Read the lock live instead of closing over it: re-running this effect
      // to pick up a new value would destroy the nipplejs instances mid-drag,
      // which drops the active touch (no `end` event) and strands whatever
      // vector was last written in the store.
      if (useMuseumStore.getState().isMovementLocked) return;
      const distance = Math.min(data.distance, MAX_TRAVEL) / MAX_TRAVEL;
      const rad = data.angle.radian;
      setMoveInput({
        x: Math.cos(rad) * distance,
        y: Math.sin(rad) * distance,
      });
    });
    leftManager.on("end", () => setMoveInput({ x: 0, y: 0 }));

    rightManager.on("move", (_evt, data) => {
      const distance = Math.min(data.distance / (MAX_TRAVEL * LOOK_SATURATION), 1);
      // `data.angle.radian` is the DIRECTION the stick is pushed (0..2π, full
      // circle). It is used only to decompose that push into x/y components —
      // it is never treated as a camera heading, so there is no ±π ceiling on
      // how far the player can keep turning.
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
      // Destroying a manager never fires `end`, so zero both channels by hand —
      // otherwise a teardown mid-drag leaves the camera turning (or the player
      // walking) forever with no stick on screen to stop it.
      setMoveInput({ x: 0, y: 0 });
      setLookInput({ x: 0, y: 0 });
    };
  }, [showTouchControls, leftZone, rightZone, setMoveInput, setLookInput]);
}
