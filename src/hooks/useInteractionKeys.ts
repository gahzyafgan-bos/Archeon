import { useEffect } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";

/** Maps keyboard shortcuts to the same actions the HUD's "X"/"A" buttons trigger. */
export function useInteractionKeys() {
  const nearbyArtifact = useMuseumStore((s) => s.nearbyArtifact);
  const focusedArtifact = useMuseumStore((s) => s.focusedArtifact);
  const focusArtifact = useMuseumStore((s) => s.focusArtifact);
  const toggleInfoPanel = useMuseumStore((s) => s.toggleInfoPanel);
  const nearbyDoorLabel = useMuseumStore((s) => s.nearbyDoorLabel);
  const confirmDoor = useMuseumStore((s) => s.confirmDoor);
  const isSettingsOpen = useMuseumStore((s) => s.isSettingsOpen);
  const setIsSettingsOpen = useMuseumStore((s) => s.setIsSettingsOpen);
  const isCatalogOpen = useMuseumStore((s) => s.isCatalogOpen);
  const setIsCatalogOpen = useMuseumStore((s) => s.setIsCatalogOpen);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // A full-screen panel owns the keyboard while it is up. Without this,
      // pressing E with Pengaturan open focused whichever artifact happened to
      // be standing behind the dialog — the visitor never saw what they had
      // just opened, and the panel they were actually looking at stayed put.
      const panelOpen = isSettingsOpen || isCatalogOpen;

      if (e.code === "KeyE") {
        if (panelOpen || focusedArtifact) return;
        // An artifact always wins over the archway: a visitor standing in the
        // opening but looking at a piece meant to open the piece.
        if (nearbyArtifact) focusArtifact(nearbyArtifact);
        else if (nearbyDoorLabel) confirmDoor();
      } else if (e.code === "KeyA") {
        if (panelOpen) return;
        if (focusedArtifact) toggleInfoPanel();
      } else if (e.code === "Escape") {
        // Innermost first. Escape has always closed the artifact panel; the two
        // dialogs above it could only be dismissed by finding their ✕ or
        // clicking the backdrop, which is not where anyone's hand goes.
        if (isCatalogOpen) setIsCatalogOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
        else if (focusedArtifact) focusArtifact(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    nearbyArtifact,
    focusedArtifact,
    focusArtifact,
    toggleInfoPanel,
    nearbyDoorLabel,
    confirmDoor,
    isSettingsOpen,
    setIsSettingsOpen,
    isCatalogOpen,
    setIsCatalogOpen,
  ]);
}
