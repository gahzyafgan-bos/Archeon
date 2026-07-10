import artifactsJson from "./artifacts.json";
import type { Artifact, RoomId } from "@/types/artifact";

const ALL_ARTIFACTS = artifactsJson as Artifact[];

/**
 * Data access layer for artifacts.
 *
 * Today this reads from the local `artifacts.json` file. To switch to the
 * real backend described in the requirements
 * (`GET /api/artifacts?ruangan=room1`), replace the body of these two
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
