import { useGLTF } from "@react-three/drei";

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

/** Preload + decode one `.glb` into drei's cache ahead of time (no-op for an
 * empty url), so a later `useGLTF(url)` resolves from cache with no
 * main-thread decode hitch. Draco decoding itself runs on the loader's worker,
 * so this is safe to fan out across idle time. */
export function preloadModel(url: string | undefined | null): void {
  if (url && url.trim().length > 0) {
    useGLTF.preload(url, DRACO_DECODER_PATH);
  }
}
