export type GraphicsQuality = "rendah" | "sedang" | "tinggi";

export interface GraphicsPreset {
  /** [min, max] devicePixelRatio cap passed to <Canvas dpr>. */
  dpr: [number, number];
  shadowsEnabled: boolean;
  shadowMapSize: number;
  contactShadowResolution: number;
  ambientOcclusion: boolean;
  environmentMap: boolean;
  environmentIntensity: number;
  /** How many of the hall's fill point-lights render (see RoomShell). */
  accentLightCount: number;
  /** Full-screen EffectComposer (Bloom/HueSaturation/BrightnessContrast/
   * Vignette) — the single most expensive thing on a weak/integrated GPU,
   * so it's off entirely at Rendah instead of just trimming individual
   * effects (see PostProcessing.tsx / MuseumExperience.tsx). */
  postProcessingEnabled: boolean;
  /** MSAA on the WebGLRenderer — off at Rendah alongside the composer. */
  antialias: boolean;
  /** Passed to <Canvas gl>. Rendah runs a touch hotter to compensate for
   * the saturation/contrast the (now-disabled) grading trio used to add. */
  toneMappingExposure: number;
}

// Grading (tone mapping, saturation/contrast, contact shadow) stays on for
// every tier because it's what actually fixes the washed-out look and is
// cheap enough for low-end phones — only the expensive stuff (real shadow
// maps, AO, env map, higher DPR) is gated here.
export const GRAPHICS_PRESETS: Record<GraphicsQuality, GraphicsPreset> = {
  rendah: {
    dpr: [1, 1],
    shadowsEnabled: false,
    shadowMapSize: 1024,
    contactShadowResolution: 256,
    ambientOcclusion: false,
    environmentMap: false,
    environmentIntensity: 0,
    accentLightCount: 1,
    postProcessingEnabled: false,
    antialias: false,
    toneMappingExposure: 1.05,
  },
  sedang: {
    dpr: [1, 1.5],
    shadowsEnabled: true,
    shadowMapSize: 1024,
    contactShadowResolution: 512,
    ambientOcclusion: false,
    environmentMap: true,
    environmentIntensity: 0.15,
    accentLightCount: 2,
    postProcessingEnabled: true,
    antialias: true,
    toneMappingExposure: 0.95,
  },
  tinggi: {
    dpr: [1, 2],
    shadowsEnabled: true,
    shadowMapSize: 2048,
    contactShadowResolution: 1024,
    ambientOcclusion: true,
    environmentMap: true,
    environmentIntensity: 0.25,
    accentLightCount: 2,
    postProcessingEnabled: true,
    antialias: true,
    toneMappingExposure: 0.95,
  },
};

export const GRAPHICS_QUALITY_LABELS: Record<GraphicsQuality, { title: string; desc: string }> = {
  rendah: { title: "Rendah", desc: "Ringan — tanpa bayangan/AO, untuk HP kentang." },
  sedang: { title: "Sedang", desc: "Seimbang — bayangan nyala, AO mati. Cocok untuk mobile." },
  tinggi: { title: "Tinggi", desc: "Bayangan & efek penuh, untuk PC/laptop." },
};
