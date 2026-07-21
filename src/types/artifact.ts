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
  deskripsi: string;
  /** Path to a .glb/.gltf model. Leave empty string to use a placeholder primitive. */
  url_model_3d: string;
  /** Placeholder shape used while there's no real model yet. */
  placeholder_shape: "box" | "sphere" | "cylinder" | "cone" | "torus";
  /** Path to the audio guide file (mp3/ogg), or empty string if none yet. */
  url_audio: string;
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
}
