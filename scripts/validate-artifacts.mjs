/**
 * Guard against internal/boilerplate text reaching visitors.
 *
 * A museum's credibility rests on what it puts on the label, so a stray
 * "[DRAFT]" or "deskripsi ini perlu dilengkapi kurator" in front of a paying
 * visitor is a reputational problem, not a cosmetic bug. This runs as part of
 * `npm run build` and fails the build outright rather than warning, because a
 * warning in a build log is a warning nobody reads.
 *
 * Node built-ins only — no new dependency for a 100-line checker.
 *
 * Usage: node scripts/validate-artifacts.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(here, "..", "src", "data", "artifacts.json");

/** Text that must never appear in anything a visitor can read. */
const FORBIDDEN = [
  /\bdraft\b/i,
  /perlu di(lengkapi|isi|perbarui|update)/i,
  /\bkurator\b/i,
  /\bTODO\b/,
  /\bTBD\b/,
  /\bFIXME\b/,
  /lorem\s+ipsum/i,
  /\bplaceholder\b/i,
  /\bdummy\b/i,
  /contoh deskripsi/i,
  /(data|informasi|keterangan)\s+(akan\s+)?(menyusul|ditambahkan)/i,
  /belum tersedia/i,
  /\bcoming soon\b/i,
];

/**
 * Exhibition-design vocabulary. These are notes the layout designer wrote to
 * themselves about where a piece stands in the room; they read as gibberish to
 * a visitor, and they leaked into shipped descriptions once already.
 */
const INTERNAL_JARGON = [
  /terminating vista/i,
  /signature piece/i,
  /\bcenterpiece\b/i,
  /sumbu pandang/i,
  /dijadikan vitrine/i,
  /\bplint(h|nya)?\b/i,
  /\bhero shot\b/i,
];

/** Fields rendered to visitors, so subject to every rule above. */
const VISITOR_TEXT_FIELDS = ["nama", "deskripsi", "transkrip_audio"];

const MIN_DESCRIPTION_LENGTH = 40;

const errors = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);

let artifacts;
try {
  artifacts = JSON.parse(readFileSync(DATA_PATH, "utf8"));
} catch (err) {
  console.error(`Tidak bisa membaca ${DATA_PATH}: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(artifacts) || artifacts.length === 0) {
  console.error("artifacts.json kosong atau bukan array.");
  process.exit(1);
}

const seenDescriptions = new Map();

for (const artifact of artifacts) {
  const id = artifact.id ?? "(tanpa id)";

  for (const field of VISITOR_TEXT_FIELDS) {
    const value = artifact[field];
    if (typeof value !== "string") continue;
    for (const pattern of FORBIDDEN) {
      const hit = value.match(pattern);
      if (hit) fail(id, `field "${field}" mengandung teks terlarang: "${hit[0]}"`);
    }
    for (const pattern of INTERNAL_JARGON) {
      const hit = value.match(pattern);
      if (hit) fail(id, `field "${field}" mengandung istilah internal: "${hit[0]}"`);
    }
  }

  const description = artifact.deskripsi;
  if (typeof description !== "string" || description.trim() === "") {
    fail(id, "deskripsi kosong");
    continue;
  }
  if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
    fail(id, `deskripsi terlalu pendek (${description.trim().length} < ${MIN_DESCRIPTION_LENGTH} karakter)`);
  }

  const normalized = description.trim().toLowerCase();
  if (seenDescriptions.has(normalized)) {
    fail(id, `deskripsi identik dengan ${seenDescriptions.get(normalized)}`);
  } else {
    seenDescriptions.set(normalized, id);
  }
}

if (errors.length > 0) {
  console.error(`\nValidasi artefak GAGAL — ${errors.length} masalah:\n`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  console.error("");
  process.exit(1);
}

console.log(`✓ Validasi artefak lolos (${artifacts.length} artefak diperiksa).`);
