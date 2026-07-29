import { useEffect, useMemo } from "react";
import type { ZoneConfig } from "@/data/roomConfig";
import { applyBatikWorldScale, createBatikPattern } from "@/utils/batikPatterns";

const MOTIF_BY_ZONE: Record<string, "kawung" | "parang" | "gajahOling" | "artDeco"> = {
  welcome: "kawung",
  prasejarah: "gajahOling",
  "hindu-buddha": "parang",
  "transisi-iptek": "artDeco",
};

/** Faintest ink in the museum. The floor is the single largest surface in
 * view, so it is the one that most easily overpowers the artefacts standing
 * on it; a zone should be felt underfoot, not announced. */
const FLOOR_MOTIF_STRENGTH = 0.3;

/**
 * The main way a zone reads as "its own area" without a wall in sight (spec
 * section 5): a low-contrast circular batik inlay tinted with the zone's own
 * accent, sized to the zone's footprint radius.
 */
export function ZoneFloorMotif({ zone, floorColor }: { zone: ZoneConfig; floorColor: string }) {
  const radius = zone.radius * 0.55;
  const texture = useMemo(() => {
    // Ground colour is the hall's own floor, not a fixed cream. The inlay has
    // to be the floor with a pattern on it; painted a lighter cream than the
    // floor it becomes a bright disc, and a 5.7 m bright disc under the
    // artefacts is louder than the pattern ever was. This matters more since
    // the floor was darkened — the old cream was near-identical to the old
    // floor colour, so the mismatch didn't show.
    const tex = createBatikPattern(MOTIF_BY_ZONE[zone.id] ?? "kawung", floorColor, zone.accent, 128, FLOOR_MOTIF_STRENGTH);
    // The inlay is as wide as the zone — up to 5.7 m across. Mapped 1:1 that
    // stretched a single 8-cell tile over the whole disc, i.e. one motif every
    // 71 cm: the "raksasa/polkadot" floor. Scaled to world size it is ~12 cm.
    return applyBatikWorldScale(tex, radius * 2);
  }, [zone.id, zone.accent, radius, floorColor]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[zone.center.x, 0.015, zone.center.z]} receiveShadow>
      <circleGeometry args={[radius, 40]} />
      <meshStandardMaterial map={texture} roughness={0.9} transparent opacity={0.85} />
    </mesh>
  );
}
