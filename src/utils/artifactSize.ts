import type { Artifact } from "@/types/artifact";

/** Footprint radius (XZ plane, meters) implied by an artifact's `real_world_size`,
 * with the pedestal's overhang margin (spec: "alas ~20-30% lebih lebar dari
 * footprint objek"). `undefined` when the artifact has no real-world size yet —
 * every caller falls back to its own tier/fixed default in that case. */
export function objectFootprintRadius(artifact: Artifact): number | undefined {
  const size = artifact.real_world_size;
  if (!size) return undefined;
  return (Math.max(size.width, size.depth) / 2) * 1.3;
}
