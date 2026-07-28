import type { RoomId } from "@/types/artifact";

/**
 * A greeter is a person standing in the welcome zone — a host, not an exhibit.
 *
 * Kept in its own type and its own data file, deliberately far away from
 * `artifacts.json`: everything that consumes the artifact list treats its
 * entries as collection items. Filing a member of staff there would put them
 * on the MiniMap as a piece, into any "x of y artefak dikunjungi" tally, and
 * through the artifact content validator, all of which would be wrong.
 */
export interface Greeter {
  /** Stable identifier. Also the expected photo filename — see docs/cara-mengganti-foto-penyambut.md. */
  id: string;
  /** Which hall's welcome zone this person stands in. */
  roomId: RoomId;
  /** Display name. May be empty until the museum supplies it; the label is then simply not drawn. */
  name: string;
  /** Role or title, e.g. "Pemandu Museum". Optional, same empty-means-omit rule. */
  role?: string;
  /** One short line of greeting under the name. Optional, same empty-means-omit rule. */
  caption?: string;
  /** Path under `public/`, e.g. "/images/greeters/greeter-1.webp". Leave unset to
   * use the convention-based lookup (`<id>.webp`, then `<id>.jpg`) so a photo can
   * be dropped in without touching code — see greeterPhoto.ts. */
  photoPath?: string;
  /** World position, metres. y is the floor the figure stands on. */
  position: [number, number, number];
  /** Y rotation in radians, matching the repo's `rotasi_y` convention. */
  rotationY: number;
  /** Which side of the figure the photo board stands on: -1 = the figure's local left, 1 = right. */
  photoSide: -1 | 1;
  /** Palette colour used for this person's clothing, so the two read as distinct people. */
  accentColor: string;
}
