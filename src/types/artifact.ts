export type RoomId = "lobby" | "room1" | "room2" | "room3";

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
  ruangan: RoomId;
  /** Iconic pieces get a dramatic spotlight + pedestal; others are in a shared vitrine. */
  is_ikonik: boolean;
}
