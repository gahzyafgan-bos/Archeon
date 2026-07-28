import { useMuseumStore } from "@/store/useMuseumStore";

/**
 * Single source of truth for "should the on-screen joysticks exist right now".
 *
 * Resolves the user's explicit "Mode Kontrol" preference against automatic
 * detection, so there is always a manual way out if detection ever misjudges a
 * device — an in-app browser with an odd User Agent, a hybrid laptop, a
 * borrowed phone. Auto is the default and does the right thing on real
 * hardware; the other two are escape hatches.
 */
export function useShowTouchControls(): boolean {
  const isTouchDevice = useMuseumStore((s) => s.isTouchDevice);
  const controlMode = useMuseumStore((s) => s.settings.controlMode);

  if (controlMode === "joystick") return true;
  if (controlMode === "keyboard") return false;
  return isTouchDevice;
}
