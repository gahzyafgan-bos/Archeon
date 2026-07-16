import { useEffect } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";
import { useAudioGuide } from "@/hooks/useAudioGuide";

function EyeOverlay() {
  const nearbyArtifact = useMuseumStore((s) => s.nearbyArtifact);
  const focusedArtifact = useMuseumStore((s) => s.focusedArtifact);

  return (
    <div className="relative flex-1 h-full flex items-center justify-center">
      {/* Crosshair to help the eye focus while looking around */}
      <div className="w-3 h-3 rounded-full border border-museum-bone/60" />

      {focusedArtifact ? (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center px-3">
          <p className="text-museum-gold text-[10px] tracking-widest uppercase">{focusedArtifact.nama}</p>
          <p className="text-museum-mist/80 text-[9px] mt-0.5">Tombol B untuk kembali</p>
        </div>
      ) : (
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
      <p className="fixed bottom-3 left-1/2 -translate-x-1/2 text-museum-mist/50 text-[9px] tracking-widest uppercase">
        Start = Keluar Mode VR &nbsp;·&nbsp; Select/Back = Kalibrasi Ulang
      </p>
    </div>
  );
}
