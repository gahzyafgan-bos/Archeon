import { useMuseumStore } from "@/store/useMuseumStore";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

export function PostProcessing() {
  const isLowEndDevice = useMuseumStore((s) => s.isLowEndDevice);

  // Disable all post-processing on low-end devices
  if (isLowEndDevice) return null;

  return (
    <EffectComposer>
      {/* Bloom: only affects emissive/bright elements, not entire scene */}
      <Bloom
        intensity={0.8}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
    </EffectComposer>
  );
}
