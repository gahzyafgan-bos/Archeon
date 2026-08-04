import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Artifact, RoomId, ZoneId } from "@/types/artifact";
import { GRAPHICS_QUALITIES, type GraphicsQuality } from "@/utils/graphicsPresets";
import {
  IPD_DEFAULT_M,
  IPD_MAX_M,
  IPD_MIN_M,
  LENS_SEPARATION_DEFAULT_MM,
  LENS_SEPARATION_MAX_MM,
  LENS_SEPARATION_MIN_MM,
  SCREEN_WIDTH_DEFAULT_MM,
  SCREEN_WIDTH_MAX_MM,
  SCREEN_WIDTH_MIN_MM,
} from "@/utils/vrOptics";

// Re-exported so existing `import type { RoomId } from "@/store/useMuseumStore"`
// call sites across the app don't need to change — canonical definition now
// lives in types/artifact.ts (Artifact.ruangan needs it too, and types/
// can't import from the store without creating a cycle).
export type { RoomId, ZoneId };

export type MoveVector = { x: number; y: number }; // -1..1, from left joystick
export type LookVector = { x: number; y: number }; // -1..1, from right joystick

/**
 * Union-typed settings are declared as arrays first and the type is derived
 * from the array, not the other way round.
 *
 * The reason is sanitizeSettings below: it has to check a value read from
 * `localStorage` against the members this build accepts, and a bare `type`
 * union does not exist at runtime to check against. Deriving the type from the
 * list means the list can never fall out of step with the type — add a member
 * in one place and both the compiler and the storage validator learn about it.
 */
export const CONTROL_MODES = ["auto", "keyboard", "joystick"] as const;
export const TEXT_SIZES = ["small", "medium", "large"] as const;
export const DEADZONE_SIZES = ["small", "medium", "large"] as const;

export type ControlMode = (typeof CONTROL_MODES)[number];
export type TextSize = (typeof TEXT_SIZES)[number];
export type DeadzoneSize = (typeof DEADZONE_SIZES)[number];

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
  // VR (Cardboard) lens calibration — different Cardboard viewers and faces
  // need different values to make the stereo image actually fuse comfortably.
  vrIPD: number; // world units between eyes; real-world average is ~0.063 (63mm), scene scale is 1 unit = 1 meter
  /**
   * Physical distance, in millimetres, between the two lens centres of the
   * Cardboard viewer — i.e. how far apart the two images must sit ON THE GLASS.
   *
   * This is a completely separate quantity from vrIPD above, and conflating
   * them is why a stereo pair fails to fuse. vrIPD is a distance in the 3D
   * scene and only controls how strong the depth effect is. This one decides
   * whether the eyes can merge the two images at all: each eye looks straight
   * down its own lens axis, so the point of the screen that reads as "dead
   * ahead" is the lens centre, and the two image centres therefore have to be
   * exactly a lens-separation apart. Splitting the screen 50/50 instead puts
   * them half a screen-width apart, which on any large phone is wider than a
   * human face — the eyes would have to diverge, which they cannot do.
   *
   * User-adjustable because cheap viewers vary and some have sliding lenses.
   * Range and default live in utils/vrOptics.ts with the geometry they belong
   * to; nothing here or in the UI may invent its own bounds.
   */
  vrLensSeparationMm: number;
  /**
   * The phone's physical screen width along its LONG edge, in millimetres —
   * the width the two eye viewports are cut out of when the phone is landscape
   * in a headset.
   *
   * The stereo framing needs a real length here and the web exposes none, so
   * this is the one number that must be measured or calibrated. It used to be
   * a hardcoded `25.4 / 140` CSS-dpi guess buried in CardboardStereoView, which
   * was 10-15% off on most phones; since the lens-centre shift is a difference
   * of two similar lengths, that became a ~100% error in the shift and left
   * each eye's image ~4mm too far inboard — far past the ~1-2° of vergence a
   * fixed-focus viewer allows, so the pair simply could not be fused. That is
   * the "double" everyone was seeing.
   *
   * Measure the glass once with a ruler and it is correct on that phone
   * forever. See eyeLensCenterShift in utils/vrOptics.ts.
   */
  vrScreenWidthMm: number;
  vrDistortionK1: number; // barrel pre-distortion, 1st order radial coefficient
  vrDistortionK2: number; // barrel pre-distortion, 2nd order radial coefficient
  // Kualitas Grafis
  graphicsQuality: GraphicsQuality;
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
  vrIPD: IPD_DEFAULT_M,
  vrLensSeparationMm: LENS_SEPARATION_DEFAULT_MM,
  vrScreenWidthMm: SCREEN_WIDTH_DEFAULT_MM,
  vrDistortionK1: 0.22,
  vrDistortionK2: 0.24,
  graphicsQuality: "rendah",
};

const clampNumber = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

/** Falls back to `fallback` unless the stored value is one of `allowed`. Used
 *  for every union-typed setting, because a union is exactly the kind of value
 *  that survives in storage after the code stopped accepting it. */
function pickOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

const asBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

/**
 * Pulls EVERY persisted setting back into a value the app can actually render.
 *
 * This used to clamp the three VR optics numbers and nothing else, on the
 * reasoning that they were the only ones a visitor could push out of range by
 * hand. That reasoning missed where bad values really come from: not from the
 * sliders, but from an OLDER BUILD. `localStorage` outlives the code that wrote
 * it. The moment a union member is renamed or dropped — a graphics tier, a
 * deadzone size, a control mode — every returning visitor rehydrates a value
 * this build has never heard of.
 *
 * The measured consequence (audit 2026-08-05, P0-3) was not a wrong setting but
 * a white screen: `graphicsQuality: "ultra"` made `GRAPHICS_PRESETS[quality]`
 * undefined, and the first read of `.shadowsEnabled` threw before React
 * committed a single frame. There is no way for a visitor to recover from that,
 * because nothing on a blank page can tell them to clear their site data.
 *
 * So the rule here is: storage is untrusted input. Every field is validated
 * against the same ranges and unions the UI offers, and anything that fails
 * falls back to its default instead of reaching a renderer.
 */
function sanitizeSettings(settings: Partial<Settings> | undefined): Settings {
  const s = settings ?? {};
  return {
    // Kontrol & sensitivitas — ranges mirror SettingsPanel's slider bounds.
    lookSensitivity: clampNumber(s.lookSensitivity, 0.5, 2, defaultSettings.lookSensitivity),
    moveSensitivity: clampNumber(s.moveSensitivity, 0.5, 1.5, defaultSettings.moveSensitivity),
    deadzone: pickOneOf(s.deadzone, DEADZONE_SIZES, defaultSettings.deadzone),
    invertY: asBoolean(s.invertY, defaultSettings.invertY),
    controlMode: pickOneOf(s.controlMode, CONTROL_MODES, defaultSettings.controlMode),
    // Audio
    volumeAmbience: clampNumber(s.volumeAmbience, 0, 100, defaultSettings.volumeAmbience),
    volumeGuide: clampNumber(s.volumeGuide, 0, 100, defaultSettings.volumeGuide),
    volumeUI: clampNumber(s.volumeUI, 0, 100, defaultSettings.volumeUI),
    masterMuted: asBoolean(s.masterMuted, defaultSettings.masterMuted),
    showSubtitles: asBoolean(s.showSubtitles, defaultSettings.showSubtitles),
    // Visual & kenyamanan
    reduceMotion: asBoolean(s.reduceMotion, defaultSettings.reduceMotion),
    cameraFOV: clampNumber(s.cameraFOV, 60, 85, defaultSettings.cameraFOV),
    highContrast: asBoolean(s.highContrast, defaultSettings.highContrast),
    textSize: pickOneOf(s.textSize, TEXT_SIZES, defaultSettings.textSize),
    roomTransitionSpeed: clampNumber(s.roomTransitionSpeed, 0.5, 2, defaultSettings.roomTransitionSpeed),
    // VR optics — ranges live in utils/vrOptics.ts with the geometry that
    // justifies them; nothing here may invent its own bounds.
    vrIPD: clampNumber(s.vrIPD, IPD_MIN_M, IPD_MAX_M, IPD_DEFAULT_M),
    vrLensSeparationMm: clampNumber(
      s.vrLensSeparationMm,
      LENS_SEPARATION_MIN_MM,
      LENS_SEPARATION_MAX_MM,
      LENS_SEPARATION_DEFAULT_MM
    ),
    vrScreenWidthMm: clampNumber(
      s.vrScreenWidthMm,
      SCREEN_WIDTH_MIN_MM,
      SCREEN_WIDTH_MAX_MM,
      SCREEN_WIDTH_DEFAULT_MM
    ),
    vrDistortionK1: clampNumber(s.vrDistortionK1, 0, 0.5, defaultSettings.vrDistortionK1),
    vrDistortionK2: clampNumber(s.vrDistortionK2, 0, 0.5, defaultSettings.vrDistortionK2),
    // The one that actually caused the white screen.
    graphicsQuality: pickOneOf(s.graphicsQuality, GRAPHICS_QUALITIES, defaultSettings.graphicsQuality),
  };
}

interface MuseumState {
  // --- App / loading ---
  isLoading: boolean;
  loadProgress: number; // 0-100
  setLoadProgress: (v: number) => void;
  finishLoading: () => void;
  /**
   * True while the GPU has taken its rendering context away from us.
   *
   * Not a cosmetic flag: without it the canvas simply goes black and the DOM
   * HUD keeps floating over the void, which is what the audit found. A phone
   * that runs out of VRAM, a tab left in the background too long, or a driver
   * reset all land here — routinely, on exactly the low-end devices this app
   * targets. See WebGLContextGuard.
   */
  isRendererLost: boolean;
  setRendererLost: (v: boolean) => void;
  /**
   * Set when loading has stopped being able to finish on its own — either an
   * asset request failed outright, or the progress bar has not moved for long
   * enough that no amount of further waiting will help.
   *
   * Needed because the loading gate is `dataReady && !glActive`, and a request
   * that never settles keeps `glActive` true forever. The audit measured that
   * as a progress bar frozen at 94% with no message, no timeout and no button —
   * a visitor whose Wi-Fi dropped for two seconds was simply stuck there.
   */
  loadError: null | "failed" | "stalled";
  setLoadError: (v: null | "failed" | "stalled") => void;

  // --- Hall navigation ---
  activeRoom: RoomId;
  setActiveRoom: (room: RoomId) => void;
  isTransitioning: boolean;
  setTransitioning: (v: boolean) => void;
  pendingSpawnPoint: { x: number; z: number; facingY: number } | null;
  setPendingSpawnPoint: (spawn: { x: number; z: number; facingY: number } | null) => void;
  /** Nearest zone to the player's current position — purely presentational
   * (minimap highlight, signage, per-zone ambience), doesn't gate anything. */
  activeZoneId: ZoneId;
  setActiveZoneId: (zone: ZoneId) => void;
  /**
   * Label of the archway the player is currently standing in, or null.
   *
   * Crossing used to happen the instant the trigger radius was touched. That
   * turned the single most common thing a first-time visitor does — walk
   * forward — into "leave the exhibition", and the audit measured the full
   * consequence: from the spawn point, straight ahead, not one artifact in
   * Hall 1 ever comes within interaction range before the archway takes you
   * out of it. The nearest miss is 1.30 m.
   *
   * So the archway now announces itself and waits, using the same prompt
   * vocabulary artifacts already use. The visual design is untouched — it is
   * still an open walk-through, not a door, and there is still no fade or name
   * card between halls. What changed is only that crossing is now something
   * the visitor chooses.
   */
  nearbyDoorLabel: string | null;
  setNearbyDoorLabel: (v: string | null) => void;
  /** Bumped by any "confirm" input (E / touch prompt / gamepad A). PlayerRig
   *  owns the actual transition and watches this from its frame loop. */
  doorConfirmSignal: number;
  confirmDoor: () => void;

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
  /** True once the user has explicitly picked a graphics quality tier in
   * SettingsPanel — after that, useDeviceDetection's auto-default no longer
   * overwrites their choice. */
  graphicsQualityCustomized: boolean;
  setGraphicsQuality: (quality: GraphicsQuality) => void;
  /** Device-detection default — only takes effect while the user hasn't customized it. */
  applyAutoGraphicsQuality: (quality: GraphicsQuality) => void;

  // --- VR Cardboard mode ---
  isVRMode: boolean;
  setVRMode: (v: boolean) => void;
  /**
   * NOTE: the gyro's own absolute look rotation deliberately does NOT live in
   * this store — it updates ~60×/sec, and a store write per sample re-rendered
   * PlayerRig inside the Canvas every frame. It's published as a mutable
   * object (`vrLookSource` in useDeviceOrientationLook) and read imperatively
   * from useFrame instead. The offset below is safe to keep here: it only
   * changes while the gamepad stick is actually being pushed, and nothing
   * re-renders on it.
   *
   * Extra yaw/pitch (radians) the gamepad right stick accumulates on top of
   * the gyro's absolute look while in VR mode — lets the pad turn the view
   * for players who can't physically swivel, without overwriting the gyro.
   * Reset to zero on recenter / VR toggle. Transient (not persisted).
   */
  vrLookOffset: { yaw: number; pitch: number };
  setVRLookOffset: (v: { yaw: number; pitch: number }) => void;
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
      isRendererLost: false,
      setRendererLost: (v) => set({ isRendererLost: v }),
      loadError: null,
      setLoadError: (v) => set({ loadError: v }),
      setLoadProgress: (v) => set({ loadProgress: v }),
      finishLoading: () => set((state) => ({ isLoading: false, isMovementLocked: !state.hasCompletedOnboarding })),

      hasCompletedOnboarding: false,
      setHasCompletedOnboarding: (v) => set({ hasCompletedOnboarding: v, isMovementLocked: !v }),

      activeRoom: "hall-1",
      setActiveRoom: (room) => set({ activeRoom: room }),
      activeZoneId: "welcome",
      setActiveZoneId: (zone) => set({ activeZoneId: zone }),
      nearbyDoorLabel: null,
      setNearbyDoorLabel: (v) => set({ nearbyDoorLabel: v }),
      doorConfirmSignal: 0,
      confirmDoor: () => set((state) => ({ doorConfirmSignal: state.doorConfirmSignal + 1 })),
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

      graphicsQualityCustomized: false,
      setGraphicsQuality: (quality) =>
        set((state) => ({
          settings: { ...state.settings, graphicsQuality: quality },
          graphicsQualityCustomized: true,
        })),
      applyAutoGraphicsQuality: (quality) =>
        set((state) =>
          state.graphicsQualityCustomized
            ? {}
            : { settings: { ...state.settings, graphicsQuality: quality } }
        ),

      isVRMode: false,
      setVRMode: (v) => set({ isVRMode: v }),
      vrLookOffset: { yaw: 0, pitch: 0 },
      setVRLookOffset: (v) => set({ vrLookOffset: v }),
      vrRecenterSignal: 0,
      requestVRRecenter: () => set((state) => ({ vrRecenterSignal: state.vrRecenterSignal + 1 })),
      isGamepadConnected: false,
      setIsGamepadConnected: (v) => set({ isGamepadConnected: v }),
    }),
    {
      name: "museum-settings",
      partialize: (state) => ({
        settings: state.settings,
        graphicsQualityCustomized: state.graphicsQualityCustomized,
      }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ...persistedState,
        // Validated on the way OUT of storage, not just on the way in from the
        // UI — storage is untrusted input written by a build that no longer
        // exists. See sanitizeSettings for the full reasoning; the short
        // version is that one unknown graphics tier used to be a white screen.
        settings: sanitizeSettings({
          ...currentState.settings,
          ...(persistedState?.settings || {}),
        }),
        // Persisted alongside settings, and equally capable of being garbage.
        graphicsQualityCustomized: persistedState?.graphicsQualityCustomized === true,
      }),
    }
  )
);
