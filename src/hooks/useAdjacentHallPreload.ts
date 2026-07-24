import { useEffect } from "react";
import type { RoomId } from "@/store/useMuseumStore";
import { ROOM_CONFIGS } from "@/data/roomConfig";
import { getModelUrlsByRoom } from "@/data/artifactRepository";
import { preloadModel } from "@/utils/modelLoader";

type IdleHandle = number;

// requestIdleCallback isn't in Safari/iOS — fall back to a short setTimeout so
// the stagger still happens (just on a fixed delay instead of true idle time).
const ric = (globalThis as {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (h: number) => void;
});

const scheduleIdle = (cb: () => void): IdleHandle =>
  ric.requestIdleCallback ? ric.requestIdleCallback(cb, { timeout: 2500 }) : (setTimeout(cb, 300) as unknown as number);

const cancelIdle = (handle: IdleHandle): void => {
  if (ric.cancelIdleCallback) ric.cancelIdleCallback(handle);
  else clearTimeout(handle);
};

/**
 * Warms the models of every hall reachable from `currentRoom` (its door
 * targets) **one at a time during main-thread idle time**, so walking through
 * the archway finds them already fetched + Draco-decoded in drei's cache
 * instead of cold-loading ~27MB in the single frame the crossfade fires.
 *
 * Two deliberate guards keep this from regressing initial load (constraint:
 * "render awal tidak boleh jadi lebih lambat"):
 *   1. `enabled` — the caller only flips this true once the CURRENT hall has
 *      finished loading, so the next hall never competes with the first paint.
 *   2. requestIdleCallback + one-model-per-callback stagger — decoding is
 *      spread across idle gaps, never piled into one frame, and yields to any
 *      real interaction. Draco decode itself already runs on the loader worker.
 */
export function useAdjacentHallPreload(currentRoom: RoomId, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const targets = ROOM_CONFIGS[currentRoom].doors.map((d) => d.targetRoom);
    const urls = Array.from(new Set(targets.flatMap(getModelUrlsByRoom))).filter(Boolean);
    if (urls.length === 0) return;

    let index = 0;
    let handle: IdleHandle = scheduleIdle(function step() {
      preloadModel(urls[index]);
      index += 1;
      if (index < urls.length) handle = scheduleIdle(step);
    });

    return () => cancelIdle(handle);
  }, [currentRoom, enabled]);
}
