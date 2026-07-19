import { useState } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";

const DISMISS_KEY = "museum-ios-install-dismissed";

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iP(hone|od|ad)/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * iOS Safari has no Fullscreen API for ordinary elements — "Add to Home
 * Screen" is the only real path to an address-bar-free experience there (see
 * useFullscreen's isIOS exclusion). Shown once per device (permanently
 * dismissible), only once onboarding is out of the way so it doesn't compete
 * with that modal, and never on Android/desktop where Chrome's own install
 * prompt (or this component's HUD fullscreen button) already covers it.
 */
export function IOSInstallBanner() {
  const isTouchDevice = useMuseumStore((s) => s.isTouchDevice);
  const hasCompletedOnboarding = useMuseumStore((s) => s.hasCompletedOnboarding);
  const isLoading = useMuseumStore((s) => s.isLoading);
  const isVRMode = useMuseumStore((s) => s.isVRMode);
  const [dismissed, setDismissed] = useState(readDismissed);

  const shouldShow =
    isTouchDevice &&
    isIOSDevice() &&
    !isStandalone() &&
    !dismissed &&
    hasCompletedOnboarding &&
    !isLoading &&
    !isVRMode;

  if (!shouldShow) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Best-effort — worst case the banner reappears next visit.
    }
  };

  return (
    <div
      className="fixed z-20 left-1/2 -translate-x-1/2 glass-panel rounded-full pl-4 pr-2 py-2 flex items-center gap-3 text-museum-bone max-w-[90vw]"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
    >
      <p className="text-xs leading-snug">
        Untuk layar penuh: tap <span className="text-museum-gold">Bagikan</span> lalu{" "}
        <span className="text-museum-gold">Tambahkan ke Layar Utama</span>
      </p>
      <button
        onClick={handleDismiss}
        aria-label="Tutup petunjuk"
        className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-museum-mist hover:text-museum-bone transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
