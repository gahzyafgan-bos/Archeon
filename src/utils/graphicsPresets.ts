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
  /** Every non-elevated (regular-tier) artifact used to carry its own
   * always-on fill spotLight regardless of preset — with ~15-19 artifacts
   * mounted per hall at once, that's 15-19 extra real lights every
   * fragment in the scene gets shaded against on top of ambient/hemisphere/
   * directional/accent, which forward-rendering pays for on every pixel of
   * every material (spec 4b.4: "batasi jumlah real light di mobile").
   * False on Rendah — those pieces fall back to their existing emissive
   * tint (isNearby highlight) instead, which is effectively free. */
  perArtifactFillLights: boolean;
  /** DustParticles (additive-blended point sprites around hero/featured/
   * signature pieces) cost real overdraw on mobile GPUs (spec 4b.3:
   * "kurangi efek overdraw... partikel debu... di mobile dikurangi
   * drastis") — off entirely at Rendah rather than just fewer particles. */
  dustParticlesEnabled: boolean;
  /** <Canvas camera far>. Both halls are well under 35m across — a shorter
   * far plane on mobile gives frustum culling a tighter volume to reject
   * against (spec 4b.5: fog/draw distance dipendekkan). */
  cameraFar: number;
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
    perArtifactFillLights: false,
    dustParticlesEnabled: false,
    cameraFar: 40,
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
    perArtifactFillLights: true,
    dustParticlesEnabled: true,
    cameraFar: 80,
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
    perArtifactFillLights: true,
    dustParticlesEnabled: true,
    cameraFar: 200,
  },
};

export const GRAPHICS_QUALITY_LABELS: Record<GraphicsQuality, { title: string; desc: string }> = {
  rendah: { title: "Rendah", desc: "Ringan — tanpa bayangan/AO, untuk HP kentang." },
  sedang: { title: "Sedang", desc: "Seimbang — bayangan nyala, AO mati. Cocok untuk mobile." },
  tinggi: { title: "Tinggi", desc: "Bayangan & efek penuh, untuk PC/laptop." },
};
