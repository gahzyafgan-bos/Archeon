import { useEffect } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";

/**
 * Detects touch-capable devices so the HUD can auto-show joysticks on
 * mobile/tablet and auto-show the keyboard hint on desktop, per spec section 5.
 * Also detects low-end devices for post-processing fallback.
 */
export function useDeviceDetection() {
  const setIsTouchDevice = useMuseumStore((s) => s.setIsTouchDevice);
  const setIsLowEndDevice = useMuseumStore((s) => s.setIsLowEndDevice);
  const applyAutoGraphicsQuality = useMuseumStore((s) => s.applyAutoGraphicsQuality);

  useEffect(() => {
    // Capability-based, never viewport width: a phone in landscape reports a
    // viewport as wide as a small laptop, so any width threshold would decide
    // it is a desktop and hide the touch controls exactly when they're needed.
    // Never User Agent either — in-app browsers (a link opened inside a chat
    // or shopping app) report strings nothing recognises.
    const detectTouch = () =>
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(pointer: coarse)").matches;

    const isTouch = detectTouch();
    setIsTouchDevice(isTouch);

    // Simple heuristic for low-end devices: touch + small screen
    const isLowEnd =
      isTouch ||
      window.screen.width < 768 ||
      navigator.hardwareConcurrency < 4;
    setIsLowEndDevice(isLowEnd);

    // Safety net: an actual finger on the glass is proof no heuristic can
    // argue with. If detection somehow misjudged the device, the very first
    // touch corrects it. One-way on purpose — a device that has been touched
    // stays a touch device even if a later re-check disagrees.
    const onFirstTouch = () => setIsTouchDevice(true);
    window.addEventListener("touchstart", onFirstTouch, {
      once: true,
      passive: true,
      capture: true,
    });

    // Re-check when the device is rotated or the window resized. The result
    // shouldn't change — none of the three signals above are orientation
    // dependent — but this costs nothing and closes the door on a browser
    // that reports capabilities late during startup.
    const recheck = () => {
      if (detectTouch()) setIsTouchDevice(true);
    };
    window.addEventListener("orientationchange", recheck);
    window.addEventListener("resize", recheck);

    // Graphics quality default (only applies while the user hasn't
    // overridden it in SettingsPanel — see applyAutoGraphicsQuality): always
    // Rendah on first load, on every device, so the first impression is
    // smooth rather than laggy. The user can still raise it manually in
    // SettingsPanel; that choice persists (graphicsQualityCustomized).
    applyAutoGraphicsQuality("rendah");

    return () => {
      window.removeEventListener("touchstart", onFirstTouch, { capture: true });
      window.removeEventListener("orientationchange", recheck);
      window.removeEventListener("resize", recheck);
    };
  }, [setIsTouchDevice, setIsLowEndDevice, applyAutoGraphicsQuality]);
}
