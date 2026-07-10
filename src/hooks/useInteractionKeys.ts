import { useEffect } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";

/** Maps keyboard shortcuts to the same actions the HUD's "X"/"A" buttons trigger. */
export function useInteractionKeys() {
  const nearbyArtifact = useMuseumStore((s) => s.nearbyArtifact);
  const focusedArtifact = useMuseumStore((s) => s.focusedArtifact);
  const focusArtifact = useMuseumStore((s) => s.focusArtifact);
  const toggleInfoPanel = useMuseumStore((s) => s.toggleInfoPanel);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyE") {
        if (focusedArtifact) return;
        if (nearbyArtifact) focusArtifact(nearbyArtifact);
      } else if (e.code === "KeyA") {
        if (focusedArtifact) toggleInfoPanel();
      } else if (e.code === "Escape") {
        if (focusedArtifact) focusArtifact(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nearbyArtifact, focusedArtifact, focusArtifact, toggleInfoPanel]);
}
