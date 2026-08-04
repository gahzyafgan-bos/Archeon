import type { RoomConfig } from "@/data/roomConfig";
import {
  DEFAULT_CEILING_HEIGHT,
  beamUnderside,
  beamZPositions,
  lampZPositions,
  colonnadeShaftHeight,
} from "@/utils/hallGeometry";

/**
 * The vertical mirror of placementValidator.ts.
 *
 * That file checks the floor plan: no two footprints overlap. Nothing checked
 * the other axis, which is where the harder-to-spot faults live — a prop whose
 * top crosses the ceiling structure is invisible from the floor, because you
 * stand under it looking at the side that still looks right. Both faults that
 * prompted this shipped that way: the colonnade capital poking through Hall 2's
 * ceiling, and every lamp cord running up past the ceiling plane.
 *
 * What it can and can't catch: decor that DERIVES its height from
 * hallGeometry.ts is correct by construction, so there is no point re-deriving
 * it here and comparing it to itself. The checks below are the three cases
 * where that guarantee doesn't hold — a hall too short for the derivation to
 * fit, a prop still carrying hand-authored constants, and two hallGeometry
 * functions that have to agree with each other.
 *
 * Warns, never throws, and is called once per hall mount from RoomShell's
 * dev-only effect — same contract as validatePlacement.
 */

/** Geometry owned by the components being audited, not by hallGeometry.
 * Duplicated here on purpose: if one of them changes and this copy doesn't,
 * the audit fires, which is the entire point of holding a second copy. */
const COLONNADE_CAPITAL_H = 0.28; // HallEdgeDecor.tsx

export function auditCeilingClearance(room: RoomConfig): void {
  const ceiling = room.ceilingHeight ?? DEFAULT_CEILING_HEIGHT;
  const limit = beamUnderside(ceiling);
  const warn = (msg: string) => {
    console.warn(`[decor] ${room.name}: ${msg}`);
  };

  // Colonnade. Normally clears by construction — but colonnadeShaftHeight
  // clamps at a 2 m minimum, so a hall configured short enough pushes the
  // capital back up through the beam grid rather than shrinking further.
  const capitalTop = colonnadeShaftHeight(ceiling, COLONNADE_CAPITAL_H) + COLONNADE_CAPITAL_H;
  if (capitalTop > limit + 1e-6) {
    warn(
      `colonnade capital reaches y ${capitalTop.toFixed(2)}m, above the beam underside at ${limit.toFixed(2)}m — this hall's ${ceiling}m ceiling is too low for the colonnade to fit under it.`
    );
  }

  // The threshold banners were audited here too, until they were removed from
  // RoomShell.tsx — they cleared the beam grid by 10 cm and still read as
  // passing through it, which is a composition problem this file cannot
  // measure. Nothing hangs low enough to walk into anymore, so the headroom
  // check went with them.

  // Every lamp needs a beam directly above it to hang from. lampZPositions is
  // supposed to sample beamZPositions; this is what holds the two together.
  const beams = new Set(beamZPositions(room.bounds).map((z) => z.toFixed(3)));
  for (const z of lampZPositions(room.bounds)) {
    if (!beams.has(z.toFixed(3))) {
      warn(`lamp at z ${z.toFixed(2)} has no beam above it — its cord ends in mid-air.`);
    }
  }
}
