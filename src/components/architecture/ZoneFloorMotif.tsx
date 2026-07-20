import { useMemo } from "react";
import type { ZoneConfig } from "@/data/roomConfig";
import { createBatikPattern } from "@/utils/batikPatterns";

const MOTIF_BY_ZONE: Record<string, "kawung" | "parang" | "gajahOling" | "artDeco"> = {
  welcome: "kawung",
  prasejarah: "gajahOling",
  "hindu-buddha": "parang",
  "transisi-iptek": "artDeco",
};

/**
 * The main way a zone reads as "its own area" without a wall in sight (spec
 * section 5): a low-contrast circular batik inlay tinted with the zone's own
 * accent, sized to the zone's footprint radius.
 */
export function ZoneFloorMotif({ zone }: { zone: ZoneConfig }) {
  const texture = useMemo(
    () => createBatikPattern(MOTIF_BY_ZONE[zone.id] ?? "kawung", "#EDE0C4", zone.accent, 128),
    [zone.id, zone.accent]
  );

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[zone.center.x, 0.015, zone.center.z]} receiveShadow>
      <circleGeometry args={[zone.radius * 0.55, 40]} />
      <meshStandardMaterial map={texture} roughness={0.9} transparent opacity={0.85} />
    </mesh>
  );
}
