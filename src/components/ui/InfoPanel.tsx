import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useMuseumStore } from "@/store/useMuseumStore";
import { useAudioGuide } from "@/hooks/useAudioGuide";
import type { Artifact } from "@/types/artifact";

export function InfoPanel() {
  const focusedArtifact = useMuseumStore((s) => s.focusedArtifact);
  const isInfoPanelOpen = useMuseumStore((s) => s.isInfoPanelOpen);
  const toggleInfoPanel = useMuseumStore((s) => s.toggleInfoPanel);
  const focusArtifact = useMuseumStore((s) => s.focusArtifact);
  const isVRMode = useMuseumStore((s) => s.isVRMode);
  // VR mode plays the guide itself (see VRHud) and shows a minimal stereo
  // indicator instead of this drag-to-rotate panel, which needs touch input
  // that's unreachable inside a Cardboard headset.
  const audio = useAudioGuide(isVRMode ? null : focusedArtifact);
  const settings = useMuseumStore((s) => s.settings);

  if (!focusedArtifact || isVRMode) return null;

  const handleClose = () => focusArtifact(null);

  return (
    <div className="fixed inset-0 z-30 pointer-events-none">
      {/* Background blur while an artifact is focused, per spec */}
      <div className="absolute inset-0 backdrop-blur-sm bg-black/20 pointer-events-none transition-opacity duration-500" />

      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-[420px] flex flex-col justify-center p-4 sm:p-6 pointer-events-auto transition-all duration-500 ease-museum ${
          isInfoPanelOpen ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
        }`}
      >
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col max-h-[85dvh] animate-slide-up-fade">
          {/* Mini 360° model viewer */}
          <div className="h-56 sm:h-64 bg-museum-charcoal/60 relative">
            <Canvas camera={{ position: [0, 0.4, 2.6], fov: settings.cameraFOV }}>
              <ambientLight intensity={0.6} />
              <directionalLight position={[3, 4, 2]} intensity={1.4} />
              <MiniArtifact artifact={focusedArtifact} />
              <Environment preset="city" />
              <OrbitControls
                enablePan={false}
                enableZoom={true}
                minDistance={1.4}
                maxDistance={4}
                autoRotate
                autoRotateSpeed={1.2}
              />
            </Canvas>
            <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] tracking-widest uppercase text-museum-mist/80">
              Seret untuk memutar 360°
            </p>
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-museum-bone transition-colors"
              aria-label="Tutup panel, kembali menjelajah"
            >
              ✕
            </button>
          </div>

          {/* Info content */}
          <div className="p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto museum-scroll">
            <div>
              {focusedArtifact.is_ikonik && (
                <span className="text-[10px] tracking-[0.2em] uppercase text-museum-gold">
                  Koleksi Ikonik
                </span>
              )}
              <h2 className="font-display text-2xl text-museum-bone mt-1" style={{
                fontSize: settings.textSize === "small" ? "1.5rem" : settings.textSize === "large" ? "2.5rem" : undefined
              }}>
                {focusedArtifact.nama}
              </h2>
            </div>

            <p className="text-museum-mist text-sm leading-relaxed" style={{
              fontSize: settings.textSize === "small" ? "0.875rem" : settings.textSize === "large" ? "1.25rem" : undefined
            }}>
              {focusedArtifact.deskripsi}
            </p>

            {/* Subtitle section */}
            {settings.showSubtitles && focusedArtifact.transkrip_audio && (
              <div className="p-3 bg-museum-charcoal/40 rounded-lg border border-white/10">
                <p className="text-museum-mist text-xs tracking-widest uppercase mb-2">Transkrip Audio</p>
                <p className="text-museum-bone text-sm leading-relaxed" style={{
                  fontSize: settings.textSize === "small" ? "0.875rem" : settings.textSize === "large" ? "1.125rem" : undefined
                }}>
                  {focusedArtifact.transkrip_audio}
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2 border-t border-white/10">
              <button
                onClick={audio.toggle}
                disabled={!audio.hasAudio}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-museum-gold/50 text-museum-gold text-sm hover:bg-museum-gold/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {audio.isPlaying ? "❚❚ Jeda" : "▶ Audio Guide"}
              </button>
              {!audio.hasAudio && (
                <span className="text-museum-mist/60 text-xs italic">
                  Audio guide belum tersedia
                </span>
              )}
            </div>

            <button
              onClick={() => toggleInfoPanel()}
              className="text-museum-mist text-xs tracking-widest uppercase hover:text-museum-bone transition-colors self-start"
            >
              {isInfoPanelOpen ? "Sembunyikan panel (A)" : "Tampilkan panel (A)"}
            </button>

            <button
              onClick={handleClose}
              className="mt-1 text-sm text-museum-bone/90 border border-white/15 rounded-full px-4 py-2 hover:border-museum-gold/50 transition-colors self-start"
            >
              ← Kembali menjelajah
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniArtifact({ artifact }: { artifact: Artifact }) {
  if (artifact.url_model_3d) {
    return (
      <Suspense fallback={<MiniPlaceholder artifact={artifact} />}>
        <MiniRealModel url={artifact.url_model_3d} rotationY={artifact.model_rotation_y} />
      </Suspense>
    );
  }
  return <MiniPlaceholder artifact={artifact} />;
}

/** Real model preview normalized to fit this fixed-distance mini viewer,
 * independent of the model's actual in-hall scale — it's centered and sized
 * to the same visual footprint regardless of the source asset's real-world dimensions. */
function MiniRealModel({ url, rotationY = 0 }: { url: string; rotationY?: number }) {
  const { scene } = useGLTF(url);
  const { model, offset, fitScale } = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    return { model: clone, offset: center, fitScale: 1.1 / maxDim };
  }, [scene]);

  return (
    <group scale={fitScale} rotation={[0, rotationY, 0]}>
      <primitive object={model} position={[-offset.x, -offset.y, -offset.z]} />
    </group>
  );
}

function MiniPlaceholder({ artifact }: { artifact: Artifact }) {
  const shape = artifact.placeholder_shape;
  return (
    <mesh castShadow>
      {shape === "sphere" && <sphereGeometry args={[0.6, 32, 32]} />}
      {shape === "cylinder" && <cylinderGeometry args={[0.25, 0.25, 1.4, 24]} />}
      {shape === "cone" && <coneGeometry args={[0.65, 1.3, 28]} />}
      {shape === "torus" && <torusGeometry args={[0.55, 0.2, 20, 40]} />}
      {shape === "box" && <boxGeometry args={[0.9, 0.6, 0.9]} />}
      <meshStandardMaterial
        color={artifact.is_ikonik ? "#c9a961" : "#c7c3ba"}
        roughness={0.4}
        metalness={artifact.is_ikonik ? 0.4 : 0.1}
      />
    </mesh>
  );
}
