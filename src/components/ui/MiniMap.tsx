import { useFrame, useThree } from "@react-three/fiber";
import { ROOM_CONFIGS, getNearestZone } from "@/data/roomConfig";
import { useMuseumStore, type RoomId } from "@/store/useMuseumStore";
import type { Artifact } from "@/types/artifact";

/**
 * Two-hall overview (spec section 8.3) instead of the old single-room grid:
 * a top band for Hall 1, a bottom band for Hall 2, each showing its own
 * zones as colored dots, with the player marker drawn in whichever band is
 * currently active. Two bands (rather than side-by-side) keep each hall's
 * wide landscape aspect ratio legible in a small square canvas.
 *
 *  - `MiniMapFrame`: the DOM <canvas> + glass frame + active-zone caption,
 *    rendered as a normal sibling of the R3F <Canvas>.
 *  - `MiniMapTracker`: mounted *inside* the R3F <Canvas> so it can read
 *    `camera.position` every frame; it draws straight onto the same
 *    <canvas> DOM node via the ref passed down from MuseumExperience, and
 *    also keeps the store's `activeZoneId` in sync for the caption/signage.
 */
const HALL_ORDER: RoomId[] = ["hall-1", "hall-2"];

export function MiniMapFrame({
  canvasRef,
  artifacts,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  artifacts: Artifact[];
}) {
  const activeZoneId = useMuseumStore((s) => s.activeZoneId);
  const activeRoom = useMuseumStore((s) => s.activeRoom);
  const viewedIds = useMuseumStore((s) => s.viewedArtifactIds);
  const zoneLabel = ROOM_CONFIGS[activeRoom].zones.find((z) => z.id === activeZoneId)?.label ?? "";
  const seenHere = artifacts.filter((a) => viewedIds.has(a.id)).length;

  return (
    <div className="fixed top-16 right-5 z-20 w-28 rounded-lg overflow-hidden glass-panel">
      <canvas ref={canvasRef} width={112} height={112} className="w-full h-28" />
      {zoneLabel && (
        <p className="text-[9px] text-center text-museum-bone/90 tracking-wide py-1 px-1 truncate" title={zoneLabel}>
          {zoneLabel}
        </p>
      )}
      {/* Reads the hollow/filled dots above out loud, and is the only place in
          the app that has ever shown the visitor how much of a hall they have
          actually looked at — the store has been recording it since
          viewedArtifactIds was written and no component read it. Also a quiet
          answer to "am I done here?", which is the question a visitor asks
          right before they walk out of a hall having missed half of it. */}
      {artifacts.length > 0 && (
        <p className="text-[9px] text-center text-museum-mist/80 tracking-wide pb-1 px-1">
          {seenHere} dari {artifacts.length} dilihat
        </p>
      )}
    </div>
  );
}

export function MiniMapTracker({
  canvasEl,
  room,
  artifacts,
}: {
  canvasEl: HTMLCanvasElement | null;
  room: RoomId;
  artifacts: Artifact[];
}) {
  const { camera } = useThree();
  const setActiveZoneId = useMuseumStore((s) => s.setActiveZoneId);
  // Safe to subscribe to: markArtifactViewed only allocates a new Set when a
  // visitor actually opens an artifact for the first time, so this re-renders
  // a handful of times across an entire visit, not per frame.
  const viewedIds = useMuseumStore((s) => s.viewedArtifactIds);

  useFrame(() => {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    const w = canvasEl.width;
    const h = canvasEl.height;
    const bandH = h / 2 - 2;

    ctx.clearRect(0, 0, w, h);

    const activeConfig = ROOM_CONFIGS[room];
    const nearestZone = getNearestZone(activeConfig, camera.position.x, camera.position.z);
    setActiveZoneId(nearestZone.id);

    HALL_ORDER.forEach((hallId, bandIndex) => {
      const hall = ROOM_CONFIGS[hallId];
      const { minX, maxX, minZ, maxZ } = hall.bounds;
      const bandY = bandIndex * (bandH + 4);
      const isActiveHall = hallId === room;

      ctx.fillStyle = isActiveHall ? "rgba(212,175,106,0.18)" : "rgba(20,20,22,0.4)";
      ctx.fillRect(0, bandY, w, bandH);

      // Fit the hall's (wide) bounds into the band, preserving aspect ratio.
      const hallW = maxX - minX;
      const hallD = maxZ - minZ;
      const scale = Math.min(w / hallW, bandH / hallD) * 0.9;
      const offsetX = (w - hallW * scale) / 2;
      const offsetY = bandY + (bandH - hallD * scale) / 2;
      const toCanvas = (x: number, z: number) => ({
        px: offsetX + (x - minX) * scale,
        py: offsetY + (z - minZ) * scale,
      });

      // Hall outline
      ctx.strokeStyle = "rgba(201,169,97,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(offsetX, offsetY, hallW * scale, hallD * scale);

      // Zones as small colored dots
      for (const zone of hall.zones) {
        const { px, py } = toCanvas(zone.center.x, zone.center.z);
        ctx.fillStyle = zone.accent;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // The artifacts themselves.
      //
      // The map used to plot zones and nothing else, which made it a compass
      // and not a guide: it could tell a visitor which part of the hall they
      // were standing in, but never where anything actually was, so it could
      // not be used to find a single object in the collection (audit
      // 2026-08-05, P2-5). Together with P0-6 — walking straight from the
      // entrance reaches no artifact at all — that left a visitor with no way
      // to discover the museum except wandering.
      //
      // Hollow ring = not yet opened, filled = already read. That distinction
      // is what turns the map into something you can finish: it answers "what
      // have I still not seen" at a glance, from a Set the store was already
      // keeping and nothing had ever displayed.
      //
      // Only the hall being rendered has an artifact list in memory; the other
      // band stays zones-only rather than guessing.
      if (isActiveHall) {
        for (const a of artifacts) {
          const { px, py } = toCanvas(a.koordinat_ruangan.x, a.koordinat_ruangan.z);
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          if (viewedIds.has(a.id)) {
            ctx.fillStyle = "rgba(232,230,225,0.9)";
            ctx.fill();
          } else {
            ctx.strokeStyle = "rgba(232,230,225,0.85)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // Player marker last, so it is never hidden under an artifact dot.
        const { px, py } = toCanvas(camera.position.x, camera.position.z);
        const dirX = Math.sin(camera.rotation.y) * -5 * scale * (hallW / 20);
        const dirZ = Math.cos(camera.rotation.y) * -5 * scale * (hallW / 20);
        ctx.strokeStyle = "#c9a961";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + dirX, py + dirZ);
        ctx.stroke();

        ctx.fillStyle = "#c9a961";
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  });

  return null;
}
