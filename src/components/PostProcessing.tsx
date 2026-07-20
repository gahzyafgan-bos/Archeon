import { EffectComposer, Bloom, HueSaturation, BrightnessContrast, Vignette, N8AO } from "@react-three/postprocessing";
import { useGraphicsPreset } from "@/hooks/useGraphicsPreset";

/**
 * Color grading + accent bloom. The grading trio (Bloom/HueSaturation/
 * BrightnessContrast) stays on at every graphics-quality tier — it's cheap
 * and it's what actually fixes the washed-out look (see spec section 3).
 * Only Ambient Occlusion is gated to the Tinggi preset; it's the one effect
 * here with a real GPU cost.
 */
export function PostProcessing() {
  const graphicsPreset = useGraphicsPreset();

  // EffectComposer's children type only accepts JSX.Element | JSX.Element[]
  // (no bare `false`), so the AO toggle has to be filtered out of an array
  // rather than inlined as `{cond && <N8AO/>}`.
  const effects = [
    graphicsPreset.ambientOcclusion && (
      <N8AO key="ao" aoRadius={1.2} intensity={1.1} distanceFalloff={1} color="#1a140c" />
    ),
    // Bloom: high threshold so only genuinely bright sources (lamps,
    // spotlight cores) glow — not the whole ivory wall — and a modest
    // intensity so it reads as an accent, not a white haze.
    <Bloom key="bloom" intensity={0.4} luminanceThreshold={0.82} luminanceSmoothing={0.85} mipmapBlur />,
    // Restores saturation the flatter fill lighting used to wash out.
    <HueSaturation key="huesat" saturation={0.15} />,
    // Contrast back up, brightness nudged down slightly — this is what
    // brings midtones back after raising overall scene brightness.
    <BrightnessContrast key="contrast" contrast={0.15} brightness={-0.045} />,
    <Vignette key="vignette" eskil={false} offset={0.28} darkness={0.55} />,
  ].filter(Boolean) as JSX.Element[];

  return <EffectComposer>{effects}</EffectComposer>;
}
