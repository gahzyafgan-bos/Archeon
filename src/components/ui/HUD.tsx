import { useRef, useState } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";
import { useVirtualJoysticks } from "@/hooks/useVirtualJoysticks";
import { useDeviceOrientationLook } from "@/hooks/useDeviceOrientationLook";
import { useGamepadControls } from "@/hooks/useGamepadControls";
import { ROOM_CONFIGS } from "@/data/roomConfig";
import { SettingsPanel } from "./SettingsPanel";
import { VREntryOverlay } from "../vr/VREntryOverlay";

export function HUD() {
  const isTouchDevice = useMuseumStore((s) => s.isTouchDevice);
  const isLoading = useMuseumStore((s) => s.isLoading);
  const hasCompletedOnboarding = useMuseumStore((s) => s.hasCompletedOnboarding);
  const nearbyArtifact = useMuseumStore((s) => s.nearbyArtifact);
  const focusedArtifact = useMuseumStore((s) => s.focusedArtifact);
  const focusArtifact = useMuseumStore((s) => s.focusArtifact);
  const isAmbienceMuted = useMuseumStore((s) => s.isAmbienceMuted);
  const toggleAmbience = useMuseumStore((s) => s.toggleAmbience);
  const activeRoom = useMuseumStore((s) => s.activeRoom);
  const setIsSettingsOpen = useMuseumStore((s) => s.setIsSettingsOpen);
  const isVRMode = useMuseumStore((s) => s.isVRMode);
  const setVRMode = useMuseumStore((s) => s.setVRMode);

  const leftZoneRef = useRef<HTMLDivElement>(null);
  const rightZoneRef = useRef<HTMLDivElement>(null);
  useVirtualJoysticks(leftZoneRef, rightZoneRef);

  // Mounted here (rather than App.tsx) because HUD is already gated to only
  // exist during actual gameplay — the same lifetime VR entry makes sense in.
  const { isSupported: isVRSupported, requestPermission } = useDeviceOrientationLook();
  useGamepadControls();
  const [isEnteringVR, setIsEnteringVR] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const handleEnterVR = async () => {
    setPermissionDenied(false);
    // Kick off fullscreen synchronously (before any await) so it stays inside
    // this click's user-gesture window — Safari in particular revokes that
    // window after the first await.
    const fullscreenPromise = document.documentElement.requestFullscreen?.().catch(() => {});
    const granted = await requestPermission();
    if (!granted) {
      setPermissionDenied(true);
      return;
    }
    await fullscreenPromise;
    try {
      await screen.orientation?.lock?.("landscape");
    } catch {
      // Best-effort — some browsers/OSes don't support locking at all.
    }
    setIsEnteringVR(true);
  };

  if (isLoading || !hasCompletedOnboarding) return null;

  // Mode VR aktif: HUD sentuh biasa disembunyikan total, VRHud (di App.tsx) mengambil alih.
  if (isVRMode) return null;

  return (
    <>
      {isEnteringVR && (
        <VREntryOverlay
          onContinue={() => {
            setIsEnteringVR(false);
            setVRMode(true);
          }}
          onCancel={() => setIsEnteringVR(false)}
        />
      )}

      {permissionDenied && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 glass-panel rounded-full px-4 py-2 text-museum-mist text-xs">
          Izin sensor gyroscope ditolak — Mode VR butuh akses ini untuk mengontrol arah pandang.
        </div>
      )}
      {/* Room label, top-left — quiet, translucent */}
      <div className="fixed top-5 left-5 z-20 pointer-events-none">
        <p className="text-museum-mist text-[10px] tracking-[0.25em] uppercase">
          {ROOM_CONFIGS[activeRoom].name}
        </p>
      </div>

      {/* Ambience mute toggle, top-right */}
      <div className="fixed top-5 right-5 z-20 flex gap-3">
        {isVRSupported && (
          <button
            onClick={handleEnterVR}
            className="h-9 rounded-full glass-panel flex items-center gap-1.5 px-3 text-museum-bone/80 hover:text-museum-gold transition-colors text-xs tracking-wide"
            aria-label="Masuk Mode VR"
          >
            <IconVRHeadset /> <span className="hidden sm:inline">Masuk Mode VR</span>
          </button>
        )}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-museum-bone/80 hover:text-museum-gold transition-colors"
          aria-label="Buka pengaturan"
        >
          ⚙️
        </button>
        <button
          onClick={toggleAmbience}
          className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-museum-bone/80 hover:text-museum-gold transition-colors"
          aria-label={isAmbienceMuted ? "Aktifkan musik latar" : "Matikan musik latar"}
        >
          {isAmbienceMuted ? <IconMuted /> : <IconVolume />}
        </button>
      </div>

      {/* Interaction prompt: appears when near an artifact, not yet focused */}
      {nearbyArtifact && !focusedArtifact && (
        <div className="fixed bottom-40 left-1/2 -translate-x-1/2 z-20 animate-slide-up-fade">
          <button
            onClick={() => focusArtifact(nearbyArtifact)}
            className="glass-panel rounded-full pl-2 pr-5 py-2 flex items-center gap-3 text-museum-bone hover:border-museum-gold/50 transition-colors"
          >
            <span className="w-7 h-7 rounded-full border border-museum-gold/70 flex items-center justify-center text-museum-gold text-xs font-semibold">
              {isTouchDevice ? "X" : "E"}
            </span>
            <span className="text-sm tracking-wide">Lihat {nearbyArtifact.nama}</span>
          </button>
        </div>
      )}

      {/* Desktop keyboard hint, auto-hidden on touch devices */}
      {!isTouchDevice && !focusedArtifact && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <p className="text-museum-mist/70 text-[11px] tracking-widest uppercase">
            WASD gerak &nbsp;·&nbsp; Drag mouse lihat sekeliling &nbsp;·&nbsp; E interaksi
          </p>
        </div>
      )}

      {/* Virtual joysticks, touch devices only */}
      {isTouchDevice && !focusedArtifact && (
        <>
          <div
            ref={leftZoneRef}
            className="fixed bottom-6 left-6 z-20 w-32 h-32 rounded-full"
            style={{ touchAction: "none" }}
          />
          <div
            ref={rightZoneRef}
            className="fixed bottom-6 right-6 z-20 w-32 h-32 rounded-full"
            style={{ touchAction: "none" }}
          />
        </>
      )}

      {/* Settings Panel */}
      <SettingsPanel />
    </>
  );
}

function IconVolume() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M17.5 8.5a5 5 0 010 7" />
    </svg>
  );
}

function IconVRHeadset() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2.5" y="7" width="19" height="11" rx="3.5" />
      <circle cx="8.5" cy="12.5" r="2" />
      <circle cx="15.5" cy="12.5" r="2" />
      <path d="M9 6V4.5a3 3 0 013-3 3 3 0 013 3V6" />
    </svg>
  );
}

function IconMuted() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16 9l5 6M21 9l-5 6" />
    </svg>
  );
}
