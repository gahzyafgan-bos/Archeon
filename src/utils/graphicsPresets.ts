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

  // --- Mode VR profile ------------------------------------------------------
  // VR gets its own row per tier, written down here as a TABLE rather than
  // applied as a hidden multiplier at the call site. The version this replaced
  // was `dpr={isVRMode ? [1, 1] : graphicsPreset.dpr}` buried in
  // MuseumExperience: it threw devicePixelRatio away entirely, so every tier
  // rendered VR at the same low resolution and the quality slider did nothing
  // at all in a headset — while still costing what the tier costs. Two knobs,
  // deliberately separate, because they buy very different things per unit of
  // GPU time:

  /** [min, max] devicePixelRatio for the canvas while VR is active.
   *
   * This sizes the FINAL image: the two barrel-distortion quads are drawn at
   * this resolution, and it is the grid the panel actually shows. It is cheap
   * to raise — two full-screen quads with a few ops of radial maths — and it
   * is what stops the compositor stretching a small canvas across a 1080p
   * panel. Raise this before touching vrEyeScale. */
  vrDpr: [number, number];

  /** Size of each eye's off-screen scene render, as a fraction of that eye's
   * on-screen width in drawing-buffer pixels.
   *
   * This is the expensive knob — it scales the full scene shading pass, twice
   * per frame. Values above 1.0 are SUPERSAMPLING and are the right thing to
   * want here: the barrel pass magnifies the middle of each eye by
   * (1 + k1 + k2) ≈ 1.46, so a 1.0 render is already stretched ~1.5x at the
   * exact spot the visitor is looking. Rendering below 1.0 and then magnifying
   * is what produced the blocky "voxel" edges. */
  vrEyeScale: number;

  /** MSAA samples on each eye's render target.
   *
   * Not the same thing as the `antialias` flag above. Once the scene is drawn
   * into a WebGLRenderTarget the canvas's own MSAA no longer applies at all,
   * which is why VR had hard stair-stepped edges at every tier while mono
   * looked fine — the render targets were created with the default of 0.
   * Requires a WebGL2 context with EXT_color_buffer_float, since the targets
   * are half-float (see createEyeRenderTarget); feature-detected at the call
   * site and quietly dropped to 0 where unsupported. */
  vrMsaaSamples: number;
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
    // Softest tier, but still ~1.8x the pixels the old forced-dpr-1 path gave
    // it. No MSAA: this tier exists for phones where bandwidth is the binding
    // constraint, and a multisampled half-float target is bandwidth.
    vrDpr: [1, 1.5],
    vrEyeScale: 0.8,
    vrMsaaSamples: 0,
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
    // Native-ish per eye plus 4x MSAA. Paid for by rendering the shadow map
    // once per frame instead of once per eye (see CardboardStereoView).
    vrDpr: [1, 2],
    vrEyeScale: 0.95,
    vrMsaaSamples: 4,
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
    // The only tier that actually supersamples: 1.15 per eye, so the middle of
    // the lens — magnified ~1.46x by the barrel pass — still lands close to
    // native instead of well under it.
    vrDpr: [1, 2],
    vrEyeScale: 1.15,
    vrMsaaSamples: 4,
  },
};

/**
 * The tiers that actually exist, as a runtime list.
 *
 * Derived from GRAPHICS_PRESETS rather than retyped, so it cannot name a tier
 * the table doesn't have. Consumed by the store's storage sanitiser: a
 * `graphicsQuality` rehydrated from an older build ("ultra") has to be caught
 * here, because GRAPHICS_PRESETS[unknown] is undefined and the first
 * `.shadowsEnabled` read on it throws before React commits a frame — a white
 * screen with no way back for the visitor (audit 2026-08-05, P0-3).
 */
export const GRAPHICS_QUALITIES = Object.keys(GRAPHICS_PRESETS) as GraphicsQuality[];

export const GRAPHICS_QUALITY_LABELS: Record<GraphicsQuality, { title: string; desc: string }> = {
  rendah: { title: "Rendah", desc: "Ringan — tanpa bayangan/AO, untuk HP kentang." },
  sedang: { title: "Sedang", desc: "Seimbang — bayangan nyala, AO mati. Cocok untuk mobile." },
  tinggi: { title: "Tinggi", desc: "Bayangan & efek penuh, untuk PC/laptop." },
};
