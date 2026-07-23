import { useMuseumStore } from "@/store/useMuseumStore";

/**
 * True whenever a full-screen DOM overlay (Settings, artifact InfoPanel,
 * Onboarding, the loading screen) is covering the scene. In-scene HUD
 * labels rendered via drei's <Html> (ZoneSignboard, the Hall welcome sign,
 * ArchwayGlimpse door labels) escape normal DOM stacking — drei gives them
 * a very high default z-index so they read correctly above the canvas —
 * so they must check this and skip rendering themselves rather than rely
 * on z-index/backdrop layering to hide them.
 */
export function useIsOverlayActive() {
  const isSettingsOpen = useMuseumStore((s) => s.isSettingsOpen);
  const isInfoPanelOpen = useMuseumStore((s) => s.isInfoPanelOpen);
  const isLoading = useMuseumStore((s) => s.isLoading);
  const hasCompletedOnboarding = useMuseumStore((s) => s.hasCompletedOnboarding);
  return isSettingsOpen || isInfoPanelOpen || isLoading || !hasCompletedOnboarding;
}
