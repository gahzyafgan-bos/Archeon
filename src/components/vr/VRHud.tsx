import { useEffect } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";
import { useAudioGuide } from "@/hooks/useAudioGuide";

function EyeOverlay() {
  const nearbyArtifact = useMuseumStore((s) => s.nearbyArtifact);
  const focusedArtifact = useMuseumStore((s) => s.focusedArtifact);
  const lensSeparationMm = useMuseumStore((s) => s.settings.vrLensSeparationMm);

  return (
    <div className="relative flex-1 h-full flex items-center justify-center">
      {/* Crosshair to help the eye focus while looking around */}
      <div className="w-3 h-3 rounded-full border border-museum-bone/60" />

      {/* Control hints live inside each eye rather than once across the middle
          of the screen: a single centred strip lands on the inner edge of both
          viewports, which is exactly where a Cardboard lens shows least. */}
      <div className="absolute bottom-2 left-0 right-0 text-center px-2 text-museum-mist/45 text-[8px] tracking-widest uppercase leading-relaxed">
        <p>Start = keluar · Select = kalibrasi arah</p>
        <p>D-pad ◀ ▶ = jarak lensa {lensSeparationMm}mm</p>
      </div>

      {/* Nothing is drawn while an artifact is focused: VRInfoPanel now shows
          the name and description as geometry inside the scene, where the
          stereo camera reaches both eyes. Repeating it here would double the
          text and put one copy across the seam between the viewports. */}
      {focusedArtifact ? null : (
        nearbyArtifact && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center px-3 animate-slide-up-fade">
            <p className="text-museum-gold text-[10px] tracking-widest uppercase">Tekan A untuk melihat</p>
            <p className="text-museum-bone text-xs mt-0.5">{nearbyArtifact.nama}</p>
          </div>
        )
      )}
    </div>
  );
}

/**
 * Minimal, entirely touch-free overlay shown while VR mode is active —
 * mirrored across both eye viewports so it reads correctly through the
 * Cardboard lenses. Also owns the fullscreen/orientation-lock cleanup that
 * needs to fire whenever VR mode is switched off (gamepad Start button).
 */
export function VRHud() {
  const isVRMode = useMuseumStore((s) => s.isVRMode);
  const focusedArtifact = useMuseumStore((s) => s.focusedArtifact);

  // InfoPanel's own 360°-drag panel is unusable without touch, so in VR mode
  // the audio guide plays itself as soon as an artifact is focused instead —
  // see the matching `isVRMode ? null : focusedArtifact` guard in InfoPanel.
  useAudioGuide(isVRMode ? focusedArtifact : null, isVRMode);

  useEffect(() => {
    if (isVRMode) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    screen.orientation?.unlock?.();
  }, [isVRMode]);

  if (!isVRMode) return null;

  return (
    <div className="fixed inset-0 z-40 flex pointer-events-none">
      <EyeOverlay />
      <div className="w-px h-full bg-white/5" />
      <EyeOverlay />
    </div>
  );
}
