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
    const isTouch =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(pointer: coarse)").matches;
    setIsTouchDevice(isTouch);

    // Simple heuristic for low-end devices: touch + small screen
    const isLowEnd =
      isTouch ||
      window.screen.width < 768 ||
      navigator.hardwareConcurrency < 4;
    setIsLowEndDevice(isLowEnd);

    // Graphics quality default (only applies while the user hasn't
    // overridden it in SettingsPanel — see applyAutoGraphicsQuality):
    // desktop -> Tinggi, mobile -> Sedang, weak/low-end mobile -> Rendah.
    if (!isTouch) {
      applyAutoGraphicsQuality("tinggi");
    } else if (window.screen.width < 480 || navigator.hardwareConcurrency < 4) {
      applyAutoGraphicsQuality("rendah");
    } else {
      applyAutoGraphicsQuality("sedang");
    }
  }, [setIsTouchDevice, setIsLowEndDevice, applyAutoGraphicsQuality]);
}
