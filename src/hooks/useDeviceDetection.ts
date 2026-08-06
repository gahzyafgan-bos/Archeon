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

    // Is this machine likely to struggle?
    //
    // The old version answered "yes" for every touch device on earth, which
    // made the flag useless — a tablet and a five-year-old budget phone are
    // not the same problem — and nothing read it anyway (audit 2026-08-05).
    // Now it is the input to the graphics default below, so it has to mean
    // something.
    //
    // Only signals the browser actually reports about the hardware are used.
    // Screen width stays out of it entirely: it describes the panel, not the
    // GPU behind it, and a phone in landscape reports laptop numbers.
    //
    // `deviceMemory` is Chromium-only and coarse (rounded to 0.5/1/2/4/8), but
    // where it exists it is the single best signal available for the devices
    // this museum will actually meet. Absent, we simply don't count it.
    const cores = navigator.hardwareConcurrency ?? 0;
    const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const isLowEnd =
      (cores > 0 && cores < 4) ||
      (memoryGb !== undefined && memoryGb <= 4) ||
      // A touch device that reports nothing about itself: assume the worse of
      // the two, because being wrong toward "rendah" costs some shadow detail
      // and being wrong the other way costs a slideshow.
      (isTouch && cores === 0 && memoryGb === undefined);
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

    // Graphics quality default. Only applies while the user hasn't overridden
    // it in SettingsPanel — that choice persists (graphicsQualityCustomized).
    //
    // ALWAYS "rendah", on every device. This is a product decision, and it has
    // now been made twice.
    //
    // The audit called the blanket default a defect (P2-8: "auto-preset selalu
    // rendah — memberi PC desktop preset HP kentang") and it was changed to
    // hand desktops "sedang". That was wrong, for two reasons the owner named
    // directly:
    //
    //  1. Rendah is not merely a dimmer Sedang. Moving up turns on shadows,
    //     post-processing AND dust particles at once, and each one brought
    //     visible artefacts to a build that had been clean — shadow acne
    //     swimming across the floor, specks around the archway. A tier nobody
    //     had been running is a tier nobody had been testing.
    //  2. First render gets materially heavier, and there is no way from here
    //     to tell a capable desktop from a weak one. `hardwareConcurrency` and
    //     `deviceMemory` count cores and gigabytes; neither says anything about
    //     the GPU, which is the part that decides whether this stutters.
    //
    // A visitor who wants more can still pick Sedang or Tinggi in Pengaturan,
    // and that choice is remembered. Guessing on their behalf is what cost us
    // this. `isLowEnd` stays computed above because it is genuine device
    // information other code may want; it just no longer decides this.
    applyAutoGraphicsQuality("rendah");

    return () => {
      window.removeEventListener("touchstart", onFirstTouch, { capture: true });
      window.removeEventListener("orientationchange", recheck);
      window.removeEventListener("resize", recheck);
    };
  }, [setIsTouchDevice, setIsLowEndDevice, applyAutoGraphicsQuality]);
}
