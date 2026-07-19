import { useEffect } from "react";

/**
 * Fixes the classic mobile-browser viewport-height bug: CSS `100vh` (and even
 * `height: 100%`) is measured against the *largest* viewport — the one you get
 * once Chrome/Safari's address bar has collapsed — so any full-height layout is
 * silently clipped from top/bottom while the address bar is actually showing.
 *
 * This writes the *真正* visible height into a `--app-height` CSS custom
 * property, sourced from `window.visualViewport` (the only API that reports the
 * currently-visible area, tracking the address bar as it collapses/expands).
 * The root container + R3F <Canvas> wrapper size themselves from this var, so
 * the 3D scene's render area is always exactly what the user can see — no
 * clipping, no distortion, and R3F's own ResizeObserver picks up the change
 * because its parent element genuinely resizes.
 *
 * `100dvh` is used as the CSS-level fallback (see index.css) for the first
 * paint before this effect runs and for any browser without visualViewport.
 */
export function useViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;

    const apply = () => {
      // visualViewport.height is the visible area excluding the on-screen
      // keyboard/address-bar; fall back to innerHeight on old browsers.
      const h = vv?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${Math.round(h)}px`);
    };

    apply();

    // visualViewport fires on address-bar collapse/expand and on pinch-zoom;
    // window resize/orientationchange cover the browsers that lack it.
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);

    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);
}
