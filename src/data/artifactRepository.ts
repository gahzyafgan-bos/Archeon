import artifactsJson from "./artifacts.json";
import type { Artifact, RoomId } from "@/types/artifact";

const ALL_ARTIFACTS = artifactsJson as Artifact[];

/**
 * An artifact is *renderable in the scene* only once it has a real 3D model
 * asset (`url_model_3d` pointing at a `.glb`). Artifacts still awaiting their
 * model (empty `url_model_3d`) are deliberately kept in the dataset — so
 * dropping the file in later auto-shows them with zero code change — but are
 * NOT mounted into the scene: no mesh, no pedestal, no `E` interaction anchor.
 *
 * This is the single source of truth for "sembunyikan placeholder tanpa model
 * asli": the presentation layer (MuseumExperience) filters the fetched list
 * through this so both rendering (RoomShell/ArtifactMesh) and interaction
 * (PlayerRig collision + nearby detection) skip modelless pieces together,
 * with no empty stands or phantom prompts left behind. Data is never mutated. */
export function hasRealModel(a: Artifact): boolean {
  return typeof a.url_model_3d === "string" && a.url_model_3d.trim().length > 0;
}

/**
 * Data access layer for artifacts.
 *
 * Today this reads from the local `artifacts.json` file. To switch to the
 * real backend described in the requirements
 * (`GET /api/artifacts?ruangan=hall-1`), replace the body of these two
 * functions with `fetch()` calls — every component that consumes this file
 * (Room components, InfoPanel, etc.) stays unchanged because they only
 * depend on the `Artifact` type, not on where the data comes from.
 */
export async function fetchArtifactsByRoom(room: RoomId): Promise<Artifact[]> {
  // Simulated network delay so the loading screen has something to show.
  await new Promise((resolve) => setTimeout(resolve, 150));
  return ALL_ARTIFACTS.filter((a) => a.ruangan === room);
}

export async function fetchAllArtifacts(): Promise<Artifact[]> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return ALL_ARTIFACTS;
}

export function getArtifactsByRoomSync(room: RoomId): Artifact[] {
  return ALL_ARTIFACTS.filter((a) => a.ruangan === room);
}
