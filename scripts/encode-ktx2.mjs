// One-off asset pipeline: recompress the raw PNG textures inside each heavy
// Draco `.glb` to GPU-compressed KTX2 (Basis UASTC + Zstd supercompression),
// in place. ~97% of every heavy model's size was uncompressed PNG (see the
// audit in the perf work) — KTX2 gives the GPU a natively-compressed texture:
// far less VRAM on mobile and the transcode happens off the main thread, which
// removes the "hitch when the big arca first uploads" without touching
// geometry (Draco is preserved) or resolution (look preserved).
//
// Pure-npm (ktx2-encoder's bundled Basis WASM + sharp for PNG decode) — no
// system `toktx`/`basisu` binary. Originals are recoverable via git.
//
// Run: node scripts/encode-ktx2.mjs
import { readdirSync, statSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import sharp from "sharp";
import { ktx2 } from "ktx2-encoder/gltf-transform";

const MODELS_DIR = "public/models";

// PNG/JPEG -> raw RGBA, required by the encoder in Node (no browser ImageBitmap).
const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(Buffer.from(buffer))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
};

// UASTC (high fidelity, effectively look-preserving) + Zstd supercompression so
// the KTX2 is also smaller on disk. sRGB transfer flag MUST match the slot:
// wrong sRGB on a normal/roughness map shifts how the GPU samples it. So run
// separate passes per slot family with the correct color space.
const base = { isUASTC: true, needSupercompression: true, imageDecoder };
const passes = [
  // Color data authored in sRGB.
  { ...base, slots: /baseColor|emissive/i, isPerceptual: true, isSetKTX2SRGBTransferFunc: true },
  // Tangent-space normals — linear, tuned for normal maps.
  { ...base, slots: /normal/i, isNormalMap: true, isPerceptual: false, isSetKTX2SRGBTransferFunc: false },
  // Linear data maps (metalness/roughness/occlusion).
  { ...base, slots: /metallicRoughness|occlusion/i, isPerceptual: false, isSetKTX2SRGBTransferFunc: false },
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});

const mb = (n) => (n / 1e6).toFixed(2) + "MB";
const files = readdirSync(MODELS_DIR).filter((f) => f.endsWith(".glb"));
let processed = 0;

for (const file of files) {
  const path = `${MODELS_DIR}/${file}`;
  const before = statSync(path).size;
  const doc = await io.read(path);

  const pngs = doc.getRoot().listTextures().filter((t) => {
    const m = t.getMimeType();
    return m === "image/png" || m === "image/jpeg";
  });
  if (pngs.length === 0) {
    console.log(`skip  ${file.padEnd(34)} (no compressible textures)`);
    continue;
  }

  await doc.transform(...passes.map((opts) => ktx2(opts)));
  await io.write(path, doc);

  const after = statSync(path).size;
  console.log(`ok    ${file.padEnd(34)} ${mb(before)} -> ${mb(after)}  (${pngs.length} tex)`);
  processed += 1;
}

console.log(`\nDone. ${processed} model(s) recompressed to KTX2.`);
