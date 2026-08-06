import { useMemo, useState } from "react";
import { useMuseumStore } from "@/store/useMuseumStore";
import { getArtifactsByRoomSync, hasRealModel } from "@/data/artifactRepository";
import { ROOM_CONFIGS } from "@/data/roomConfig";
import { approachPose } from "@/utils/artifactApproach";
import type { Artifact, RoomId } from "@/types/artifact";

const HALL_ORDER: RoomId[] = ["hall-1", "hall-2"];

/**
 * "Koleksi" — the whole museum as a list.
 *
 * Two findings from the 2026-08-05 audit meet here, and neither could be closed
 * from inside the 3D scene:
 *
 *  - **P0-6.** A visitor who walks straight in from the entrance and does
 *    nothing else crosses the entire Hall 1 without one artifact entering
 *    interaction range, then leaves through the far archway. Measured, five
 *    times: the interaction prompt was null in every sample. The app's default
 *    behaviour was to walk the visitor out of the exhibition. Being able to
 *    pick a piece by name and be put in front of it is the direct fix.
 *
 *  - **P2-4.** 19 of the 32 artifacts have no `.glb` yet. They are correctly
 *    not rendered — an empty pedestal would be worse — but they were also
 *    mentioned nowhere at all. Their curatorial text existed, was verified, and
 *    no visitor could ever reach a word of it. Here they are listed with the
 *    rest and their description is readable in place, which is the honest
 *    middle: the object cannot be shown, so say so and give what there is.
 *
 * Everything is grouped by hall and shows a progress count, because the other
 * half of P0-6 is that a visitor has no way to tell how much they have missed.
 */
export function ArtifactCatalog() {
  const isCatalogOpen = useMuseumStore((s) => s.isCatalogOpen);
  const setIsCatalogOpen = useMuseumStore((s) => s.setIsCatalogOpen);
  const activeRoom = useMuseumStore((s) => s.activeRoom);
  const setActiveRoom = useMuseumStore((s) => s.setActiveRoom);
  const setPendingSpawnPoint = useMuseumStore((s) => s.setPendingSpawnPoint);
  const requestTeleport = useMuseumStore((s) => s.requestTeleport);
  const viewedIds = useMuseumStore((s) => s.viewedArtifactIds);

  // Which model-less entry has its description expanded, if any.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const halls = useMemo(
    () => HALL_ORDER.map((id) => ({ id, config: ROOM_CONFIGS[id], items: getArtifactsByRoomSync(id) })),
    []
  );

  if (!isCatalogOpen) return null;

  /**
   * Take the visitor to a piece.
   *
   * A different hall means the ordinary room-change path already does the work
   * — PlayerRig repositions on `room.id`, and `pendingSpawnPoint` is exactly
   * the hook the archways use. Same hall needs `requestTeleport`, because that
   * effect never fires when the room does not change.
   */
  const visit = (artifact: Artifact) => {
    const pose = approachPose(artifact, ROOM_CONFIGS[artifact.ruangan]);
    if (artifact.ruangan !== activeRoom) {
      setPendingSpawnPoint(pose);
      setActiveRoom(artifact.ruangan);
    } else {
      requestTeleport(pose);
    }
    setIsCatalogOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsCatalogOpen(false);
      }}
    >
      <div className="glass-panel rounded-2xl w-full max-w-lg max-h-[88dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="font-display text-xl text-museum-bone">Koleksi</h2>
            <p className="text-museum-mist/70 text-[11px] mt-0.5">
              Pilih benda untuk langsung berdiri di depannya.
            </p>
          </div>
          <button
            onClick={() => setIsCatalogOpen(false)}
            className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-museum-bone transition-colors shrink-0"
            aria-label="Tutup daftar koleksi"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto museum-scroll px-5 py-4 space-y-6">
          {halls.map((hall) => {
            const visitable = hall.items.filter(hasRealModel);
            const seen = visitable.filter((a) => viewedIds.has(a.id)).length;
            return (
              <section key={hall.id}>
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <h3 className="text-museum-gold text-[11px] tracking-[0.2em] uppercase">
                    {hall.config.name}
                  </h3>
                  <span className="text-museum-mist/60 text-[10px] shrink-0">
                    {seen} dari {visitable.length} dilihat
                  </span>
                </div>

                <ul className="space-y-1.5">
                  {hall.items.map((a) => {
                    const canVisit = hasRealModel(a);
                    const isSeen = viewedIds.has(a.id);
                    const isExpanded = expandedId === a.id;
                    return (
                      <li key={a.id} className="rounded-xl border border-white/10 overflow-hidden">
                        <button
                          onClick={() => (canVisit ? visit(a) : setExpandedId(isExpanded ? null : a.id))}
                          className="w-full text-left px-3.5 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors"
                        >
                          {/* Same vocabulary as the minimap: hollow ring = not
                              yet opened, filled = already read. A piece with no
                              model gets neither — it cannot be visited, so
                              pretending it has a visit state would be a lie. */}
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              !canVisit
                                ? "bg-transparent border border-museum-mist/30"
                                : isSeen
                                  ? "bg-museum-bone"
                                  : "border border-museum-bone/80"
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-sm truncate ${
                                canVisit ? "text-museum-bone" : "text-museum-mist/70"
                              }`}
                            >
                              {a.nama}
                            </span>
                            <span className="block text-museum-mist/60 text-[10px] truncate">
                              {canVisit
                                ? a.deskripsi_singkat
                                : "Belum bisa dikunjungi — ketuk untuk membaca keterangannya"}
                            </span>
                          </span>
                          {canVisit && (
                            <span className="text-museum-gold text-[10px] tracking-wide shrink-0">
                              Kunjungi
                            </span>
                          )}
                        </button>

                        {/* The 19 pieces with no model. The description is the
                            only thing the museum can honestly offer for them,
                            so it is offered here rather than left unreachable. */}
                        {isExpanded && !canVisit && (
                          <div className="px-3.5 pb-3 pt-0.5 space-y-2 border-t border-white/5">
                            {a.deskripsi.split("\n\n").map((para, i) => (
                              <p key={i} className="text-museum-mist text-xs leading-relaxed">
                                {para}
                              </p>
                            ))}
                            {a.fakta_menarik && (
                              <p className="text-museum-gold/90 text-xs leading-relaxed">
                                Tahukah Anda? {a.fakta_menarik}
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          {/* Stated once, at the bottom, rather than repeated on all 19 rows.
              Visitors deserve to know the collection is larger than what the
              museum can currently show them, and why. */}
          <p className="text-museum-mist/50 text-[10px] leading-relaxed pt-1">
            Benda yang belum bisa dikunjungi masih menunggu pemindaian 3D. Keterangannya
            sudah tersedia dan bisa dibaca di daftar ini.
          </p>
        </div>
      </div>
    </div>
  );
}
