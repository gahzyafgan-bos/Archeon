import { useGLTF } from "@react-three/drei";
import { KTX2Loader } from "three-stdlib";
import type { GLTFLoader } from "three-stdlib";
import type { WebGLRenderer } from "three";

/**
 * Local Draco decoder path (vendored in `public/draco/`, see ArtifactMesh's
 * doc block for why the CDN default was unreliable here).
 *
 * This constant is the single source of truth: EVERY `useGLTF()` /
 * `useGLTF.preload()` call in the app must pass this exact same string.
 * drei keys its loader cache by (url + draco path) — a mismatched path spins
 * up a second DRACOLoader and decodes the same model twice, defeating the
 * whole point of preloading. Import it; never re-type the literal.
 */
export const DRACO_DECODER_PATH = "/draco/";

/**
 * The heavy models' textures are KTX2 (Basis UASTC) now, not PNG (see
 * scripts/encode-ktx2.mjs) — GPU-compressed, so the phone uploads a fraction
 * of the VRAM and the Basis transcode runs off the main thread instead of
 * hitching on a big PNG decode. That needs a KTX2Loader wired into the same
 * GLTFLoader drei uses, pointed at the Basis transcoder we vendor in
 * `public/basis/` (copied from three's examples, same offline rationale as
 * Draco).
 *
 * A single shared KTX2Loader instance is reused everywhere so its GPU-support
 * detection and transcoder worker pool aren't rebuilt per model. `detectSupport`
 * needs the live WebGLRenderer, which only exists inside the Canvas — call
 * `initKTX2Support(gl)` once from a component in the scene (see <KTX2Support/>
 * in MuseumExperience) before any model with KTX2 textures is decoded. The
 * cross-hall idle preloader only starts after the current hall has settled, by
 * which point support is already detected.
 */
const BASIS_TRANSCODER_PATH = "/basis/";
let ktx2Loader: KTX2Loader | null = null;

function getKTX2Loader(): KTX2Loader {
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader().setTranscoderPath(BASIS_TRANSCODER_PATH);
  }
  return ktx2Loader;
}

/** Detect the renderer's supported GPU texture formats once — required before
 * the shared KTX2Loader can transcode. Safe to call more than once. */
export function initKTX2Support(gl: WebGLRenderer): void {
  getKTX2Loader().detectSupport(gl);
}

/** drei `extendLoader` hook: attaches the shared KTX2Loader to the GLTFLoader
 * so KHR_texture_basisu textures decode. Passed identically to every
 * `useGLTF` / `useGLTF.preload` call so drei keys one cache entry per model. */
export const extendModelLoader = (loader: GLTFLoader): void => {
  loader.setKTX2Loader(getKTX2Loader());
};

/** Preload + decode one `.glb` into drei's cache ahead of time (no-op for an
 * empty url), so a later `useGLTF(url)` resolves from cache with no
 * main-thread decode hitch. Draco geometry + Basis texture transcoding both
 * run on their loaders' workers, so this is safe to fan out across idle time.
 * Must pass the SAME (draco, meshopt, extendLoader) args as the render-time
 * useGLTF so it warms the same cache key. */
export function preloadModel(url: string | undefined | null): void {
  if (url && url.trim().length > 0) {
    useGLTF.preload(url, DRACO_DECODER_PATH, true, extendModelLoader);
  }
}
