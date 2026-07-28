import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Greeter } from "@/types/greeter";

/** Folder the museum drops greeter photos into. See docs/cara-mengganti-foto-penyambut.md. */
export const GREETER_PHOTO_DIR = "/images/greeters/";

/** Tried in order, so `greeter-1.webp` wins over `greeter-1.jpg` when both exist. */
const PHOTO_EXTENSIONS = ["webp", "jpg", "jpeg", "png"] as const;

/** Portrait 3:4, matching the printed-photo proportion of the board. */
export const PHOTO_ASPECT = 0.75;

/**
 * Cover-crop instead of stretch: fill the 3:4 frame completely and let the
 * overflowing edge fall outside the plane. A photo that isn't exactly 3:4 gets
 * trimmed, never squashed — a squashed face is instantly readable as wrong,
 * a slightly tighter crop is not.
 */
function applyCoverCrop(texture: THREE.Texture, targetAspect: number) {
  const image = texture.image as { width: number; height: number } | undefined;
  if (!image?.width || !image?.height) return;
  const sourceAspect = image.width / image.height;
  if (sourceAspect > targetAspect) {
    texture.repeat.set(targetAspect / sourceAspect, 1);
    texture.offset.set((1 - targetAspect / sourceAspect) / 2, 0);
  } else {
    texture.repeat.set(1, sourceAspect / targetAspect);
    texture.offset.set(0, (1 - sourceAspect / targetAspect) / 2);
  }
}

/**
 * Loads a greeter's photo, or resolves to null when the museum hasn't supplied
 * one yet.
 *
 * Deliberately convention-driven rather than data-driven: with no `photoPath`
 * set, dropping `public/images/greeters/greeter-1.webp` into place and
 * refreshing is enough — no code edit, no data edit. The price is a failed
 * request per candidate filename until a photo exists; that is the browser's
 * own network log, not an app error, and nothing here throws, warns, or
 * renders differently because of it.
 */
export function useGreeterPhoto(greeter: Greeter): THREE.Texture | null {
  const gl = useThree((s) => s.gl);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: THREE.Texture | null = null;

    const candidates = greeter.photoPath
      ? [greeter.photoPath]
      : PHOTO_EXTENSIONS.map((ext) => `${GREETER_PHOTO_DIR}${greeter.id}.${ext}`);

    const loader = new THREE.TextureLoader();
    const tryCandidate = (index: number) => {
      if (cancelled || index >= candidates.length) return;
      loader.load(
        candidates[index],
        (tex) => {
          if (cancelled) {
            tex.dispose();
            return;
          }
          // Without SRGBColorSpace three treats the file's already-gamma-encoded
          // bytes as linear and the photo renders washed out — the single most
          // common mistake with photographic textures in three.js.
          tex.colorSpace = THREE.SRGBColorSpace;
          // Mipmaps stop the photo shimmering when seen from across the hall;
          // anisotropy keeps it sharp at the oblique angle it is normally read
          // from (nobody stands square in front of a welcome board).
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
          applyCoverCrop(tex, PHOTO_ASPECT);
          tex.needsUpdate = true;
          loaded = tex;
          setTexture(tex);
        },
        undefined,
        // Missing file: silently fall through to the next candidate, then to
        // the plain fallback panel. No console noise of our own, no crash.
        () => tryCandidate(index + 1)
      );
    };
    tryCandidate(0);

    return () => {
      cancelled = true;
      loaded?.dispose();
    };
  }, [greeter.id, greeter.photoPath, gl]);

  return texture;
}

let fallbackTexture: THREE.Texture | null = null;

/**
 * What fills the frame before a photo exists: a soft sand-toned gradient, the
 * way an unfilled frame in a real museum is just a blank mat. No "placeholder"
 * text, no cross, nothing internal for a visitor to read.
 */
export function getPhotoFallbackTexture(): THREE.Texture {
  if (fallbackTexture) return fallbackTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#EDE0C6");
    gradient.addColorStop(0.55, "#E4D5B7");
    gradient.addColorStop(1, "#D6C4A2");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  fallbackTexture = tex;
  return tex;
}

/** Pixel size of the name plate's canvas — 512x176 is ~2.9:1, the plate's own aspect. */
const LABEL_WIDTH = 512;
const LABEL_HEIGHT = 176;

/**
 * Name/role/greeting drawn into a canvas texture rather than a drei <Html>
 * label.
 *
 * <Html> is DOM: it is positioned once, from the main camera, so in Mode VR —
 * where the scene is rendered twice into an offscreen target — it would land in
 * the wrong place or not at all. A texture is ordinary geometry and simply
 * works in both eyes.
 *
 * Returns null when there is nothing to say, so an empty plate is never drawn.
 */
export function useGreeterLabelTexture(greeter: Greeter): THREE.Texture | null {
  const name = greeter.name?.trim() ?? "";
  const role = greeter.role?.trim() ?? "";
  const caption = greeter.caption?.trim() ?? "";

  return useMemo(() => {
    if (!name && !role && !caption) return null;

    const canvas = document.createElement("canvas");
    canvas.width = LABEL_WIDTH;
    canvas.height = LABEL_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Lay out only the lines that actually exist, centred as a block, so a
    // name-only plate isn't top-heavy and a missing role leaves no gap.
    const lines: { text: string; font: string; color: string; height: number }[] = [];
    if (name) lines.push({ text: name, font: "600 54px Georgia, 'Times New Roman', serif", color: "#F2E9D8", height: 62 });
    if (role) lines.push({ text: role, font: "400 34px system-ui, sans-serif", color: "#E4D5B7", height: 44 });
    if (caption) lines.push({ text: caption, font: "italic 400 30px Georgia, serif", color: "#D8C7A6", height: 40 });

    const totalHeight = lines.reduce((sum, l) => sum + l.height, 0);
    let y = (LABEL_HEIGHT - totalHeight) / 2;
    for (const line of lines) {
      ctx.font = line.font;
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, LABEL_WIDTH / 2, y + line.height / 2, LABEL_WIDTH - 24);
      y += line.height;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [name, role, caption]);
}
