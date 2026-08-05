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
    // This used to hand "rendah" to every device including desktops, on the
    // reasoning that a smooth first impression beats a pretty one. The
    // reasoning is right; applying it to a machine with a real GPU was not.
    // A desktop visitor was being shown the phone build — no ambient
    // occlusion, fewest lights, shadows off — of a museum whose whole point
    // is how the artefacts are lit, and nothing ever told them a better
    // version existed.
    //
    // "sedang" rather than "tinggi" for the good case: nothing here can
    // measure the actual GPU, only count cores, so the guess stays one tier
    // short of the top and the visitor can take the last step themselves.
    applyAutoGraphicsQuality(isLowEnd || isTouch ? "rendah" : "sedang");

    return () => {
      window.removeEventListener("touchstart", onFirstTouch, { capture: true });
      window.removeEventListener("orientationchange", recheck);
      window.removeEventListener("resize", recheck);
    };
  }, [setIsTouchDevice, setIsLowEndDevice, applyAutoGraphicsQuality]);
}
