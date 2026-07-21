import { useMuseumStore } from "@/store/useMuseumStore";
import { GRAPHICS_PRESETS, type GraphicsPreset, type GraphicsQuality } from "@/utils/graphicsPresets";

const QUALITY_RANK: Record<GraphicsQuality, number> = { rendah: 0, sedang: 1, tinggi: 2 };
// Stereo VR render draws the whole scene twice per frame — cap the effective
// tier while VR is active regardless of the user's normal pick, then restore
// it the moment VR exits (see CardboardStereoView).
const VR_MAX_QUALITY: GraphicsQuality = "rendah";

/** Resolves the user's chosen graphics tier into concrete render parameters,
 * additionally clamped down while Mode VR is active. */
export function useGraphicsPreset(): GraphicsPreset {
  const graphicsQuality = useMuseumStore((s) => s.settings.graphicsQuality);
  const isVRMode = useMuseumStore((s) => s.isVRMode);

  if (!isVRMode) return GRAPHICS_PRESETS[graphicsQuality];

  const effective = QUALITY_RANK[graphicsQuality] > QUALITY_RANK[VR_MAX_QUALITY] ? VR_MAX_QUALITY : graphicsQuality;
  const base = GRAPHICS_PRESETS[effective];
  // Even at "sedang", force DPR down further and AO off — VR's own render
  // path (CardboardStereoView) already halves DPR itself, this only affects
  // shadow-map-relevant consumers reading this hook.
  return { ...base, ambientOcclusion: false };
}
