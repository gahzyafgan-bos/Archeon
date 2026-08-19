/** Two big open halls (see roomConfig.ts) — each hall is its own fetch/collision unit. */
export type RoomId = "hall-1" | "hall-2";

/** Themed area within a hall (see roomConfig.ts `zones`). Zones are a visual/
 * spatial grouping only — they don't affect data fetching or collision, both
 * of which stay per-hall. */
export type ZoneId = "welcome" | "prasejarah" | "hindu-buddha" | "transisi-iptek";

/**
 * Data model for a single museum artifact.
 * This mirrors the shape expected from the backend REST API
 * (`id, nama, deskripsi, url_model_3d, url_audio, koordinat_ruangan, url_thumbnail`)
 * so this local JSON can be swapped for a real `fetch()` call later
 * without changing any component code — see src/data/README.md.
 */
export interface Artifact {
  id: string;
  nama: string;
  /**
   * One self-contained sentence (15–25 words) summarising the piece — the
   * label a visitor reads when there is no room for the full text. The VR
   * panel uses it instead of chopping `deskripsi` mid-sentence, which is what
   * it used to do.
   *
   * Written to stand alone: it is never the opening of `deskripsi` truncated,
   * so the two can be shown together without reading as a stutter.
   */
  deskripsi_singkat: string;
  /** Long-form label text. Two paragraphs separated by a blank line: what the
   * object is, then why it matters. Renderers must split on `\n\n` — a single
   * `<p>` collapses the break and runs both paragraphs together. */
  deskripsi: string;
  /**
   * One verifiable "Tahukah Anda?" fact, 1–2 sentences, shown in its own
   * accented block.
   *
   * Optional on purpose, and **omitted entirely** rather than set to `""` or
   * `null` when there is nothing sourced to say. Not every artifact has one and
   * that is the correct outcome: a museum is judged on accuracy, not on filling
   * every column. Every value here has a recorded source in
   * `docs/sumber-fakta-menarik.md`; anything that cannot be sourced does not
   * get written. Renderers must drop the whole block — label, box, and divider
   * — when the field is absent.
   */
  fakta_menarik?: string;
  /** Path to a .glb/.gltf model. Leave empty string to use a placeholder primitive. */
  url_model_3d: string;
  /** Placeholder shape used while there's no real model yet. */
  placeholder_shape: "box" | "sphere" | "cylinder" | "cone" | "torus";
  /**
   * Legacy audio field from the backend contract. Superseded by `audioGuide`
   * and empty on every entry — nothing in the app reads it any more. Kept only
   * so the shape still mirrors the REST payload documented above; new work must
   * use `audioGuide`.
   *
   * @deprecated pakai `audioGuide`.
   */
  url_audio: string;
  /**
   * Narasi pemandu audio berbahasa Indonesia untuk artefak ini.
   *
   * Optional, and absent for most of the collection — only 11 of the 32
   * artifacts have a recording. Absent is a normal, expected state: the player
   * renders **nothing at all** for those, rather than a dead grey button. A
   * button that is not there reads as "this piece has no narration"; a disabled
   * one reads as "the app is broken".
   *
   * Deliberately stored on the artifact rather than in a side-car mapping file:
   * a separate map is one more thing to keep in sync by hand, and the failure
   * mode of getting it wrong (narration playing over the wrong object) is the
   * worst one this feature has.
   */
  audioGuide?: {
    /** Absolute path under `public/`, e.g. "/audio/guide/garudeya.m4a". Must be
     * `.m4a` (AAC) — enforced by scripts/validate-artifacts.mjs. */
    src: string;
    /** Length in seconds, recorded here so the panel can show "0:12 / 1:05"
     * before a single byte of audio has been fetched. */
    durationSec: number;
    /**
     * Whether the narration's *content* has been confirmed to describe this
     * object. `false` hides the play button entirely — the file is registered
     * and validated, it just does not play yet.
     *
     * Exists because of `r2-surya-stambha`, whose written script describes a
     * bronze ceremonial axe while the object on display is a pillar (see
     * docs/artefak-butuh-verifikasi-kurator.md 0.1/0.2). The recording was made
     * from that script, so it may narrate the wrong object. Once the museum
     * confirms, flipping this to `true` is the entire fix — no code change.
     */
    contentVerified: boolean;
  };
  /** Transcript of the audio guide for subtitles/accessibility. */
  transkrip_audio?: string;
  /** Position of the artifact inside its room, in 3D world units. */
  koordinat_ruangan: { x: number; y: number; z: number };
  /** Optional Y-axis rotation (radians) so pieces can face the walkway. */
  rotasi_y?: number;
  url_thumbnail: string;
  /** Which hall this artifact loads/collides with — see artifactRepository.ts. */
  ruangan: RoomId;
  /** Which themed zone within that hall it's displayed in — purely presentational. */
  zoneId: ZoneId;
  /** Iconic pieces get a dramatic spotlight + pedestal; others are in a shared vitrine.
   * Curatorial flag only — drives the "Koleksi Ikonik" badge in InfoPanel. Doesn't
   * control physical staging; see `display_tier` for that. */
  is_ikonik: boolean;
  /** Presentational staging tier (museum hero/hierarchy spec): "signature" is the
   * one museum-wide showpiece (Garudeya Emas), "hero" is each zone's single staged
   * centerpiece, "featured" is a secondary elevated piece (still `is_ikonik`, just
   * not the chosen hero), "regular" is everything else. Optional — omitted means
   * "regular" unless `is_ikonik` is true, in which case it falls back to "featured"
   * so existing iconic pieces keep their elevated look unless explicitly retiered. */
  display_tier?: "signature" | "hero" | "featured" | "regular";
  /** Physical stand height in meters (world Y of the pedestal/vitrine/niche shelf
   * top, i.e. where the artifact rests) — the main antidote to "semua di alas
   * identik setinggi sama". Optional, falls back to a tier-based default. */
  pedestal_height?: number;
  /** How the piece is physically displayed. "pedestal" (default) stands on the
   * floor; "vitrine" sits in a small glass case on a low table (for small
   * clustered/educational collections); "niche" is wall-mounted on a shallow
   * ledge with a backing panel (for reliefs/inscriptions/flat pieces) — for
   * "niche", `rotasi_y` must face the piece out of the wall it's mounted on. */
  display_mode?: "pedestal" | "vitrine" | "niche";
  /** Uniform scale correction for the real `.glb` referenced by `url_model_3d`, for
   * assets that don't land exactly on the 1 unit = 1 meter standard. Optional, default 1. */
  model_scale?: number;
  /** Vertical offset (meters) correction for the real `.glb`, for assets whose pivot
   * isn't exactly at the object's base as required by the asset standard. Optional, default 0. */
  model_y_offset?: number;
  /** Extra Y-axis rotation (radians) applied to the real `.glb` only, on top of the
   * artifact's own `rotasi_y`, to correct facing direction. Optional, default 0. */
  model_rotation_y?: number;
  /** Reference real-world dimensions (meters) of the actual object this artifact
   * represents — the source of truth both the placeholder primitive and any real
   * `.glb` model scale to (1 unit = 1 meter convention). Optional — artifacts
   * without it fall back to the old fixed per-shape placeholder size. */
  real_world_size?: { width: number; height: number; depth: number };
  /**
   * Base surface appearance for a `.glb` that ships with NO textures at all.
   *
   * A few models in `public/models/` are bare geometry exports: no images, one
   * material, `baseColorFactor` left at glTF's default 0.8 grey. Nothing in the
   * app turns those white — they were authored that way, and the result reads
   * as an unpainted mock-up rather than a museum object. This lets the data
   * give such a model a plausible base colour until a properly textured export
   * replaces it.
   *
   * Deliberately opt-in per artifact and stored in the data, not the component:
   * it is an authoring decision about one asset, and it should disappear by
   * deleting a field the day a real texture arrives. Artifacts whose model has
   * its own textures must NOT set this — it would overwrite them.
   * See docs/artefak-butuh-verifikasi-kurator.md.
   */
  material_override?: { color: string; metalness?: number; roughness?: number };
}
