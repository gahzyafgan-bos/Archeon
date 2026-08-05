import { useEffect } from "react";
import type { RoomConfig } from "@/data/roomConfig";
import type { Artifact } from "@/types/artifact";
import { preloadModel } from "@/utils/modelLoader";

/**
 * Warms the current hall's models — all of them, immediately — but issues the
 * requests **nearest to the entrance first**.
 *
 * ## Why this exists
 *
 * Hall 1 is 38 MB of `.glb`, and until the visitor is let in they are watching
 * a progress bar: ~13.9 minutes of it on Slow 3G, ~12.4 minutes when thirty
 * people share a 20 Mbps gallery Wi-Fi (audit 2026-08-05, P1-8). A ceiling on
 * that wait now exists (MAX_LOADING_WAIT_MS), so nobody is held for more than
 * twelve seconds — which makes the question "which models have arrived by the
 * time the doors open?" the one that actually decides what the visitor sees.
 *
 * Before this, that was decided by the order artifacts happen to appear in
 * `artifacts.json`. Each `ArtifactMesh` fired its own preload on mount, so the
 * request order was the render order was the JSON order — no relationship to
 * where anyone is standing. On a slow link that routinely meant the 9.1 MB
 * `manusia-purba.glb` at the far end of the hall was occupying a connection
 * while the piece three metres from the spawn point had not been asked for yet.
 *
 * Sorting by distance from the spawn point costs nothing and changes what the
 * first twelve seconds buy: the artifacts the visitor can actually walk to
 * first are the ones that have arrived.
 *
 * ## What this deliberately does NOT do
 *
 * It does not defer anything. Every model is still requested at once, on
 * mount, for every client. `ArtifactMesh` carries an explicit product
 * constraint — *"dari awal dibuka arca dan artefak lain harus sudah ada"* —
 * and the per-distance gate that used to defer loading was removed on purpose
 * so pieces never pop in as the visitor approaches them. Ordering preserves
 * that: the request set is identical, only the sequence changes.
 *
 * The real remedy for P1-8 is smaller assets and streaming the hall in
 * fragments, and neither belongs in a hook. See the note in docs/AUDIT.
 */
export function useOrderedModelPreload(artifacts: Artifact[], room: RoomConfig): void {
  useEffect(() => {
    const withModels = artifacts.filter(
      (a) => typeof a.url_model_3d === "string" && a.url_model_3d.trim().length > 0
    );
    if (withModels.length === 0) return;

    const { x: sx, z: sz } = room.spawn;
    const ordered = [...withModels].sort(
      (a, b) =>
        Math.hypot(a.koordinat_ruangan.x - sx, a.koordinat_ruangan.z - sz) -
        Math.hypot(b.koordinat_ruangan.x - sx, b.koordinat_ruangan.z - sz)
    );

    // Issued synchronously in one pass, not staggered. The browser's own
    // connection scheduling takes it from here, and it honours the order it
    // was asked in — which is the entire point. Staggering with timers would
    // only add latency on the fast connections this must not penalise.
    for (const artifact of ordered) preloadModel(artifact.url_model_3d);
  }, [artifacts, room]);
}
