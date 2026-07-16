import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Artifact } from "@/types/artifact";

export type RoomId = "lobby" | "room1" | "room2" | "room3";

export type MoveVector = { x: number; y: number }; // -1..1, from left joystick
export type LookVector = { x: number; y: number }; // -1..1, from right joystick

export type ControlMode = "auto" | "keyboard" | "joystick";
export type TextSize = "small" | "medium" | "large";
export type DeadzoneSize = "small" | "medium" | "large";

export interface Settings {
  // Kontrol & Sensitivitas
  lookSensitivity: number; // 0.5x to 2x, multiplier for 2.2 base
  moveSensitivity: number; // 0.5x to 1.5x, multiplier for 4.2 base
  deadzone: DeadzoneSize;
  invertY: boolean;
  controlMode: ControlMode;
  // Audio
  volumeAmbience: number; // 0 to 100
  volumeGuide: number; // 0 to 100
  volumeUI: number; // 0 to 100
  masterMuted: boolean;
  showSubtitles: boolean;
  // Visual & Kenyamanan
  reduceMotion: boolean;
  cameraFOV: number; // 60 to 85 degrees
  highContrast: boolean;
  textSize: TextSize;
  roomTransitionSpeed: number; // 0.5x to 2x, multiplier for current transition speed
}

const defaultSettings: Settings = {
  lookSensitivity: 1,
  moveSensitivity: 1,
  deadzone: "medium",
  invertY: false,
  controlMode: "auto",
  volumeAmbience: 35,
  volumeGuide: 70,
  volumeUI: 100,
  masterMuted: false,
  showSubtitles: true,
  reduceMotion: false,
  cameraFOV: 68,
  highContrast: false,
  textSize: "medium",
  roomTransitionSpeed: 1,
};

interface MuseumState {
  // --- App / loading ---
  isLoading: boolean;
  loadProgress: number; // 0-100
  setLoadProgress: (v: number) => void;
  finishLoading: () => void;

  // --- Room navigation ---
  activeRoom: RoomId;
  setActiveRoom: (room: RoomId) => void;
  isTransitioning: boolean;
  setTransitioning: (v: boolean) => void;
  pendingSpawnPoint: { x: number; z: number; facingY: number } | null;
  setPendingSpawnPoint: (spawn: { x: number; z: number; facingY: number } | null) => void;

  // --- Player movement (driven by joystick/keyboard hooks) ---
  moveInput: MoveVector;
  setMoveInput: (v: MoveVector) => void;
  lookInput: LookVector;
  setLookInput: (v: LookVector) => void;
  isMovementLocked: boolean; // locked while zoomed into an artifact
  setMovementLocked: (v: boolean) => void;

  // --- Artifact interaction ---
  nearbyArtifact: Artifact | null; // artifact in interaction range, not yet focused
  setNearbyArtifact: (a: Artifact | null) => void;
  focusedArtifact: Artifact | null; // artifact currently zoomed-in / panel open
  focusArtifact: (a: Artifact | null) => void;
  isInfoPanelOpen: boolean;
  toggleInfoPanel: () => void;

  // --- Audio ---
  isAmbienceMuted: boolean;
  toggleAmbience: () => void;
  isGuideAudioPlaying: boolean;
  setGuideAudioPlaying: (v: boolean) => void;

  // --- Exploration checklist (optional feature) ---
  viewedArtifactIds: Set<string>;
  markArtifactViewed: (id: string) => void;

  // --- Input device detection ---
  isTouchDevice: boolean;
  setIsTouchDevice: (v: boolean) => void;
  isLowEndDevice: boolean;
  setIsLowEndDevice: (v: boolean) => void;

  // --- Onboarding ---
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (v: boolean) => void;

  // --- Settings Panel ---
  isSettingsOpen: boolean;
  setIsSettingsOpen: (v: boolean) => void;
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  resetSettings: () => void;

  // --- VR Cardboard mode ---
  isVRMode: boolean;
  setVRMode: (v: boolean) => void;
  /** Absolute look rotation (radians) derived from the phone's gyroscope, consumed by PlayerRig instead of lookInput while isVRMode is true. */
  vrLook: { yaw: number; pitch: number };
  setVRLook: (v: { yaw: number; pitch: number }) => void;
  /** Bumped by useGamepadControls' recenter button; useDeviceOrientationLook watches it to re-baseline "facing forward". */
  vrRecenterSignal: number;
  requestVRRecenter: () => void;
  isGamepadConnected: boolean;
  setIsGamepadConnected: (v: boolean) => void;
}

export const useMuseumStore = create<MuseumState>()(
  persist(
    (set, get) => ({
      isLoading: true,
      loadProgress: 0,
      setLoadProgress: (v) => set({ loadProgress: v }),
      finishLoading: () => set((state) => ({ isLoading: false, isMovementLocked: !state.hasCompletedOnboarding })),

      hasCompletedOnboarding: false,
      setHasCompletedOnboarding: (v) => set({ hasCompletedOnboarding: v, isMovementLocked: !v }),

      activeRoom: "lobby",
      setActiveRoom: (room) => set({ activeRoom: room }),
      isTransitioning: false,
      setTransitioning: (v) => set({ isTransitioning: v }),
      pendingSpawnPoint: null,
      setPendingSpawnPoint: (spawn) => set({ pendingSpawnPoint: spawn }),

      moveInput: { x: 0, y: 0 },
      setMoveInput: (v) => set({ moveInput: v }),
      lookInput: { x: 0, y: 0 },
      setLookInput: (v) => set({ lookInput: v }),
      isMovementLocked: false,
      setMovementLocked: (v) => set({ isMovementLocked: v }),

      nearbyArtifact: null,
      setNearbyArtifact: (a) => set({ nearbyArtifact: a }),
      focusedArtifact: null,
      focusArtifact: (a) =>
        set((state) => ({
          focusedArtifact: a,
          isMovementLocked: a !== null,
          isInfoPanelOpen: a !== null,
          viewedArtifactIds: a
            ? new Set(state.viewedArtifactIds).add(a.id)
            : state.viewedArtifactIds,
        })),
      isInfoPanelOpen: false,
      toggleInfoPanel: () => set((state) => ({ isInfoPanelOpen: !state.isInfoPanelOpen })),

      isAmbienceMuted: false,
      toggleAmbience: () => set((state) => ({ isAmbienceMuted: !state.isAmbienceMuted })),
      isGuideAudioPlaying: false,
      setGuideAudioPlaying: (v) => set({ isGuideAudioPlaying: v }),

      viewedArtifactIds: new Set(),
      markArtifactViewed: (id) =>
        set((state) => ({ viewedArtifactIds: new Set(state.viewedArtifactIds).add(id) })),

      isTouchDevice: false,
      setIsTouchDevice: (v) => set({ isTouchDevice: v }),
      isLowEndDevice: false,
      setIsLowEndDevice: (v) => set({ isLowEndDevice: v }),

      isSettingsOpen: false,
      setIsSettingsOpen: (v) => set({ isSettingsOpen: v }),
      settings: defaultSettings,
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      resetSettings: () =>
        set((state) => ({
          settings: defaultSettings,
        })),

      isVRMode: false,
      setVRMode: (v) => set({ isVRMode: v }),
      vrLook: { yaw: 0, pitch: 0 },
      setVRLook: (v) => set({ vrLook: v }),
      vrRecenterSignal: 0,
      requestVRRecenter: () => set((state) => ({ vrRecenterSignal: state.vrRecenterSignal + 1 })),
      isGamepadConnected: false,
      setIsGamepadConnected: (v) => set({ isGamepadConnected: v }),
    }),
    {
      name: "museum-settings",
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);
