import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useMuseumStore } from "@/store/useMuseumStore";
import { useAudioGuide } from "@/hooks/useAudioGuide";
import { DRACO_DECODER_PATH, extendModelLoader } from "@/utils/modelLoader";
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
        className={`absolute right-0 top-0 h-full w-full sm:w-[420px] flex flex-col justify-center p-4 sm:p-6 short:p-2 pointer-events-auto transition-all duration-500 ease-museum ${
          isInfoPanelOpen ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
        }`}
      >
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col max-h-[85dvh] short:max-h-[96dvh] animate-slide-up-fade">
          {/* Mini 360° model viewer. `shrink-0` keeps it from being squeezed
              into nothing, but it gets a much shorter slot on a phone in
              landscape — at h-56 it alone ate two thirds of the ~390px the
              panel has to work with there, leaving the description and the
              buttons below it nowhere to go. */}
          <div className="h-56 sm:h-64 short:h-32 shrink-0 bg-museum-charcoal/60 relative">
            <Canvas camera={{ position: [0, 0.4, 2.6], fov: settings.cameraFOV }}>
              {/* Three plain lights instead of <Environment preset="city" />.
                  That preset was doing two harmful things at once. It fetched a
                  multi-megabyte HDR from a third-party CDN — every panel open,
                  from a host we don't control, which simply fails on a museum
                  network with no route to the internet. And it built a fresh
                  PMREM cubemap per open with nothing disposing it: the audit
                  measured 184 textures and 390 buffers leaked across 20
                  open/close cycles, invisible to the JS heap profiler because
                  it is all GPU memory. On a phone that is the road to a lost
                  context. A key/fill/rim trio costs nothing, never touches the
                  network, and reads better on a small preview than an
                  environment map the viewer can't see the source of anyway. */}
              <ambientLight intensity={0.75} />
              <directionalLight position={[3, 4, 2]} intensity={1.5} />
              <directionalLight position={[-3, 1.5, -2]} intensity={0.5} color="#cfd8e8" />
              <MiniArtifact artifact={focusedArtifact} />
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

          {/* Info content.
              `flex-1 min-h-0` is what actually makes `overflow-y-auto` work
              here. A flex item defaults to `min-height: auto`, i.e. it refuses
              to shrink below its content — so this box grew past the parent's
              max-height, the scrollbar never appeared, and the parent's
              `overflow-hidden` simply clipped the tail off. That's the
              "kepotong dan tidak bisa di-scroll" symptom: everything below the
              fold, including the Audio Guide and "Kembali menjelajah" buttons,
              was unreachable on any short viewport.
              `touch-action: pan-y` tells the browser a vertical drag in here is
              a scroll, so it never gets claimed as a 3D-view gesture. */}
          <div
            className="p-5 sm:p-6 short:p-4 flex-1 min-h-0 flex flex-col gap-4 short:gap-3 overflow-y-auto overscroll-contain museum-scroll"
            style={{ touchAction: "pan-y" }}
          >
            <div>
              {focusedArtifact.is_ikonik && (
                <span className="text-[10px] tracking-[0.2em] uppercase text-museum-gold">
                  Koleksi Ikonik
                </span>
              )}
              <h2 className="font-display text-2xl short:text-xl text-museum-bone mt-1" style={{
                fontSize: settings.textSize === "small" ? "1.5rem" : settings.textSize === "large" ? "2.5rem" : undefined
              }}>
                {focusedArtifact.nama}
              </h2>
            </div>

            {/* One <p> per paragraph. The data stores `deskripsi` as two
                paragraphs joined by a blank line, and HTML collapses that into
                a single space — so a lone <p> ran "apa benda ini" straight into
                "kenapa benda ini penting" as one grey wall of text. */}
            <div className="flex flex-col gap-3 short:gap-2">
              {focusedArtifact.deskripsi.split(/\n\s*\n/).map((paragraph, i) => (
                <p key={i} className="text-museum-mist text-sm leading-relaxed" style={{
                  fontSize: settings.textSize === "small" ? "0.875rem" : settings.textSize === "large" ? "1.25rem" : undefined
                }}>
                  {paragraph}
                </p>
              ))}
            </div>

            {/* "Tahukah Anda?" — only rendered when the artifact actually has a
                sourced fact. No placeholder heading, no empty box, no dangling
                divider for the ones that don't; see `fakta_menarik` in
                types/artifact.ts for why most artifacts have none.
                A brass rule on the left rather than the sand-on-ivory of the
                spec: this panel's ground is charcoal, and sand fill here would
                read as a warning banner instead of an aside. */}
            {focusedArtifact.fakta_menarik && (
              <div className="border-l-2 border-museum-gold/70 pl-3 py-1 bg-museum-gold/[0.06] rounded-r">
                <p className="text-[10px] tracking-[0.2em] uppercase text-museum-gold mb-1">
                  Tahukah Anda?
                </p>
                <p className="text-museum-bone/90 text-sm leading-relaxed" style={{
                  fontSize: settings.textSize === "small" ? "0.8125rem" : settings.textSize === "large" ? "1.125rem" : undefined
                }}>
                  {focusedArtifact.fakta_menarik}
                </p>
              </div>
            )}

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
        <MiniRealModel
          url={artifact.url_model_3d}
          rotationY={artifact.model_rotation_y}
          materialOverride={artifact.material_override}
        />
      </Suspense>
    );
  }
  return <MiniPlaceholder artifact={artifact} />;
}

/** Real model preview normalized to fit this fixed-distance mini viewer,
 * independent of the model's actual in-hall scale — it's centered and sized
 * to the same visual footprint regardless of the source asset's real-world dimensions. */
function MiniRealModel({
  url,
  rotationY = 0,
  materialOverride,
}: {
  url: string;
  rotationY?: number;
  materialOverride?: Artifact["material_override"];
}) {
  // Same loader configuration as the main scene, per the invariant documented
  // in modelLoader.ts: the local Draco decoder plus the shared KTX2Loader. A
  // bare useGLTF(url) here has no KTX2Loader attached, so a model whose
  // textures are Basis-compressed would decode without any of them and render
  // untextured — and it only avoided that by happening to hit the cache entry
  // the main scene had already filled.
  const { scene } = useGLTF(url, DRACO_DECODER_PATH, true, extendModelLoader);
  const { model, offset, fitScale, ownedMaterials } = useMemo(() => {
    const clone = scene.clone(true);
    // Clone before recolouring — see the matching note in ArtifactMesh.
    // `owned` is everything THIS component created and is therefore the only
    // thing it is allowed to dispose: the source materials belong to the
    // cached GLTF that the main scene is still rendering from, and disposing
    // those would blank the artifact in the hall behind the panel.
    const owned: THREE.Material[] = [];
    if (materialOverride) {
      clone.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const recoloured = sources.map((source) => {
          const copy = source.clone();
          if ("color" in copy) (copy as THREE.MeshStandardMaterial).color.set(materialOverride.color);
          if (materialOverride.metalness !== undefined && "metalness" in copy) {
            (copy as THREE.MeshStandardMaterial).metalness = materialOverride.metalness;
          }
          if (materialOverride.roughness !== undefined && "roughness" in copy) {
            (copy as THREE.MeshStandardMaterial).roughness = materialOverride.roughness;
          }
          owned.push(copy);
          return copy;
        });
        mesh.material = Array.isArray(mesh.material) ? recoloured : recoloured[0];
      });
    }
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    return { model: clone, offset: center, fitScale: 1.1 / maxDim, ownedMaterials: owned };
  }, [scene, materialOverride]);

  useEffect(() => () => ownedMaterials.forEach((m) => m.dispose()), [ownedMaterials]);

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
