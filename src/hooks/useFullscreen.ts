import { useCallback, useEffect, useState } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function readIsFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const doc = document as FullscreenDocument;
  return !!(document.fullscreenElement || doc.webkitFullscreenElement);
}

/**
 * iOS Safari doesn't implement the Fullscreen API for ordinary elements (only
 * `<video>`), even though some versions still expose the constructor —
 * feature-detection alone would false-positive there. The only real
 * fullscreen path on iOS is "Add to Home Screen" (see IOSInstallBanner), so
 * this is excluded outright rather than left to fail silently at request time.
 */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iP(hone|od|ad)/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/**
 * Wraps the Fullscreen API (with the older webkit-prefixed fallback) behind a
 * small reactive interface. `isFullscreen` tracks `fullscreenchange` so any
 * exit — including the system back-gesture the API can't prevent — is
 * reflected immediately, letting the UI re-offer a one-tap way back in.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(readIsFullscreen);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(readIsFullscreen());
    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener("webkitfullscreenchange", handleChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      document.removeEventListener("webkitfullscreenchange", handleChange);
    };
  }, []);

  const isFullscreenSupported =
    !isIOS() && typeof document !== "undefined" && typeof document.documentElement.requestFullscreen === "function";

  /** Must be called synchronously from within a user-gesture handler (no prior `await`) or browsers reject it. */
  const enterFullscreen = useCallback((): Promise<void> => {
    const el = document.documentElement as FullscreenElement;
    try {
      const result = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen?.();
      return Promise.resolve(result).catch(() => {});
    } catch {
      return Promise.resolve();
    }
  }, []);

  const exitFullscreen = useCallback((): Promise<void> => {
    const doc = document as FullscreenDocument;
    try {
      const result = document.exitFullscreen ? document.exitFullscreen() : doc.webkitExitFullscreen?.();
      return Promise.resolve(result).catch(() => {});
    } catch {
      return Promise.resolve();
    }
  }, []);

  return { isFullscreen, isFullscreenSupported, enterFullscreen, exitFullscreen };
}
