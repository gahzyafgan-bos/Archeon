/**
 * Guard against internal/boilerplate text reaching visitors.
 *
 * A museum's credibility rests on what it puts on the label, so a stray
 * "[DRAFT]" or "deskripsi ini perlu dilengkapi kurator" in front of a paying
 * visitor is a reputational problem, not a cosmetic bug. This runs as part of
 * `npm run build` and fails the build outright rather than warning, because a
 * warning in a build log is a warning nobody reads.
 *
 * Node built-ins only — no new dependency for a checker this size.
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

/**
 * The two leaks that made this pass necessary, now permanent guards.
 *
 * The curator script this text came from was originally written for a single
 * school visit, and it still addressed that audience by name ("...sangat
 * relevan pada santri SMP Sains Tebuireng"). It also carried a production note
 * about why an object photographs well as a 3D model. Neither belongs in front
 * of a general visitor, and both are the kind of thing that quietly returns the
 * next time the script is refreshed — so they fail the build rather than
 * relying on someone re-reading all 32 entries.
 */
const AUDIENCE_AND_PRODUCTION_LEAKS = [
  /\bsantri\b/i,
  /\bSMP\b/,
  /\bTebuireng\b/i,
  /tampilan 3D/i,
  /model 3D/i,
  /\brender\b/i,
  /aplikasi ini/i,
  /ruang virtual/i,
];

/** Fields rendered to visitors, so subject to every rule above. */
const VISITOR_TEXT_FIELDS = ["nama", "deskripsi_singkat", "deskripsi", "fakta_menarik", "transkrip_audio"];

/** Prose fields, i.e. the ones that must read as finished sentences. */
const PROSE_FIELDS = ["deskripsi_singkat", "deskripsi", "fakta_menarik"];

const MIN_SHORT_DESCRIPTION_LENGTH = 40;
const MAX_SHORT_DESCRIPTION_WORDS = 30;
const MIN_DESCRIPTION_LENGTH = 100;

/**
 * The ids as recorded when the curator script was installed. An id is the only
 * stable handle anything else has on an artifact — a rename here silently
 * detaches a description from its object, which is exactly the failure mode
 * this whole pass was written to avoid. Add to this list deliberately when a
 * genuinely new artifact is added.
 */
const KNOWN_IDS = [
  "r1-fosil-pithecanthropus-erectus",
  "r1-fosil-homo-erectus",
  "r1-kapak-perimbas",
  "r1-kapak-genggam",
  "r1-nekara-perunggu",
  "r1-koleksi-batuan",
  "r1-kapak-persegi",
  "r1-fosil-kepala-buaya",
  "r1-fosil-kepala-kerbau",
  "r1-manusia-purba",
  "r2-arca-ganesha",
  "r2-arca-durga-mahisasuramardhini",
  "r2-arca-siwa-mahadewa",
  "r2-arca-wisnu",
  "r2-arca-brahma",
  "r2-arca-parwati",
  "r2-nandi",
  "r2-dwarapala-1",
  "r2-dwarapala-2",
  "r2-relief-bentang-alam",
  "r2-garudeya-emas",
  "r2-prasasti-loceret",
  "r2-prasasti-sangguran-info",
  "r2-surya-stambha",
  "r3-telepon-antik",
  "r3-sepeda-tinggi",
  "r3-sepeda-motor-uap",
  "r3-jam-matahari",
  "r3-teleskop",
  "r3-model-plta",
  "r3-senjata-api-kolonial",
  "r3-simponion",
];

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
const seenIds = new Set();
const known = new Set(KNOWN_IDS);

for (const artifact of artifacts) {
  const id = artifact.id ?? "(tanpa id)";

  // --- id stability -------------------------------------------------------
  if (seenIds.has(id)) fail(id, "id duplikat");
  seenIds.add(id);
  if (!known.has(id)) {
    fail(id, `id tidak ada di daftar tercatat (KNOWN_IDS). Kalau ini artefak baru, tambahkan idnya di scripts/validate-artifacts.mjs`);
  }

  // --- forbidden text -----------------------------------------------------
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
    for (const pattern of AUDIENCE_AND_PRODUCTION_LEAKS) {
      const hit = value.match(pattern);
      if (hit) {
        fail(id, `field "${field}" menyebut audiens spesifik / catatan produksi: "${hit[0]}"`);
      }
    }
  }

  // --- name ---------------------------------------------------------------
  const nama = artifact.nama;
  if (typeof nama !== "string" || nama.trim() === "") {
    fail(id, "nama kosong");
  } else if (nama === nama.toUpperCase() && /[A-Z]/.test(nama)) {
    fail(id, `nama ditulis kapital semua ("${nama}") — pakai Title Case`);
  }

  // --- prose hygiene ------------------------------------------------------
  for (const field of PROSE_FIELDS) {
    const value = artifact[field];
    if (typeof value !== "string") continue;
    if (/ {2,}/.test(value)) fail(id, `field "${field}" mengandung spasi ganda`);
    if (/[ \t]+(\n|$)/.test(value)) fail(id, `field "${field}" mengandung spasi di akhir baris`);
    for (const paragraph of value.split(/\n\s*\n/)) {
      const trimmed = paragraph.trim();
      if (trimmed && !/[.!?"”)]$/.test(trimmed)) {
        fail(id, `field "${field}" punya paragraf yang berakhir tanpa titik: "...${trimmed.slice(-40)}"`);
      }
    }
  }

  // --- deskripsi_singkat --------------------------------------------------
  const short = artifact.deskripsi_singkat;
  if (typeof short !== "string" || short.trim() === "") {
    fail(id, "deskripsi_singkat kosong");
  } else {
    if (short.trim().length < MIN_SHORT_DESCRIPTION_LENGTH) {
      fail(id, `deskripsi_singkat terlalu pendek (${short.trim().length} < ${MIN_SHORT_DESCRIPTION_LENGTH} karakter)`);
    }
    const words = short.trim().split(/\s+/).length;
    if (words > MAX_SHORT_DESCRIPTION_WORDS) {
      fail(id, `deskripsi_singkat terlalu panjang (${words} > ${MAX_SHORT_DESCRIPTION_WORDS} kata)`);
    }
  }

  // --- deskripsi ----------------------------------------------------------
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

  // --- fakta_menarik ------------------------------------------------------
  // Absent is a valid, expected state: most artifacts have no fact that can be
  // sourced, and the UI renders nothing at all for them. What is NOT valid is
  // the field existing as an empty shell, or repeating the description — that
  // is padding, not a fact.
  if ("fakta_menarik" in artifact) {
    const fact = artifact.fakta_menarik;
    if (typeof fact !== "string" || fact.trim() === "") {
      fail(id, 'fakta_menarik ada tapi kosong — hapus fieldnya, jangan diisi "" atau null');
    } else {
      const factSentences = fact
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 25);
      for (const sentence of factSentences) {
        if (normalized.includes(sentence)) {
          fail(id, `fakta_menarik mengulang kalimat yang sudah ada di deskripsi: "${sentence.slice(0, 50)}..."`);
        }
      }
    }
  }
}

for (const id of KNOWN_IDS) {
  if (!seenIds.has(id)) fail(id, "id tercatat tapi tidak ada lagi di artifacts.json");
}

if (errors.length > 0) {
  console.error(`\nValidasi artefak GAGAL — ${errors.length} masalah:\n`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  console.error("");
  process.exit(1);
}

const withFact = artifacts.filter((a) => a.fakta_menarik).length;
console.log(
  `✓ Validasi artefak lolos (${artifacts.length} artefak diperiksa, ${withFact} punya fakta menarik).`
);
