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
  },
};

export const GRAPHICS_QUALITY_LABELS: Record<GraphicsQuality, { title: string; desc: string }> = {
  rendah: { title: "Rendah", desc: "Ringan — tanpa bayangan/AO, untuk HP kentang." },
  sedang: { title: "Sedang", desc: "Seimbang — bayangan nyala, AO mati. Cocok untuk mobile." },
  tinggi: { title: "Tinggi", desc: "Bayangan & efek penuh, untuk PC/laptop." },
};
