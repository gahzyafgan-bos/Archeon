/**
 * Depth-fighting control for everything painted onto the floor.
 *
 * The hall's floor is not one surface. It is a plain slab with a stack of flat
 * decals laid over it — batik border trims, a per-zone inlay, the centre
 * medallion and its ring, the walking path and its arrows, the glimpse strip
 * under each archway. They are separated by 5 to 20 millimetres of height,
 * which is enough to define an order and nowhere near enough to survive a
 * depth buffer.
 *
 * Two things conspire against those millimetres. A standing visitor sees the
 * floor almost edge-on, which is the worst case for depth precision, and it
 * has to hold up across a 24-metre hall. On a phone with a 16-bit depth buffer
 * a single depth step out at the far wall is around three centimetres — larger
 * than the entire stack. The result is the shimmering, tearing patches that
 * crawl as the visitor turns.
 *
 * Raising the camera's near plane (see MuseumExperience) buys back most of the
 * precision. `polygonOffset` closes the rest, and does it by construction
 * rather than by margin: it biases a surface's depth values at rasterisation
 * time, so the decal is *decided* to be in front of the floor instead of
 * merely being 5 mm closer and hoping the buffer can tell.
 *
 * Give each layer the offset matching where it belongs in the stack, so the
 * order on screen is the order written here rather than whatever the depth
 * buffer rounds to. Height offsets are kept as they were: they still express
 * the intent readably, and they are what a reader looks at first.
 */
export const FLOOR_LAYER = {
  /** Batik trim along the long walls, and the archway peek strip. */
  trim: 1,
  /** Per-zone inlay motif. */
  zoneMotif: 2,
  /** Centre installation medallion. */
  medallion: 3,
  /** Brass ring inside that medallion. */
  medallionRing: 4,
  /** Walking path between zones. */
  path: 5,
  /** Direction arrows on top of the path. */
  pathArrow: 6,
} as const;

export type FloorLayer = (typeof FLOOR_LAYER)[keyof typeof FLOOR_LAYER];

/**
 * Material props that lift a floor decal cleanly off whatever is beneath it.
 *
 * Spread onto the decal's material: `<meshStandardMaterial {...floorDecal(FLOOR_LAYER.path)} … />`.
 * Negative values pull the fragment towards the camera, which is the direction
 * a decal needs; the magnitude only has to separate it from its neighbours, so
 * the layer index doubles as the amount.
 */
export function floorDecal(layer: FloorLayer): {
  polygonOffset: true;
  polygonOffsetFactor: number;
  polygonOffsetUnits: number;
} {
  return {
    polygonOffset: true,
    polygonOffsetFactor: -layer,
    polygonOffsetUnits: -layer,
  };
}

/**
 * The same, for a floor decal whose material is `transparent`.
 *
 * polygonOffset alone does not settle these. A transparent material still
 * writes depth by default in three.js, and transparent objects are drawn in a
 * second pass ordered *by distance from the camera* — so the trim, the zone
 * inlay, the walking path and its arrows were being re-sorted against each
 * other every time the visitor moved. Two decals whose centres are nearly
 * equidistant swap places from one frame to the next, and because each one had
 * written depth, the loser is punched out where they overlap. That is a
 * flicker that only appears while walking, which is precisely how it was
 * reported: "glitch glitch" saat bergerak.
 *
 * `depthWrite: false` stops a flat decal from occluding the flat decal beside
 * it, and an explicit `renderOrder` (pass the same layer number to the mesh)
 * replaces distance sorting with a fixed painter's order. Between them the
 * stacking order stops depending on where anyone is standing.
 *
 * Safe here specifically because every one of these lies flat on the floor
 * with nothing between it and the slab: they are painted onto a surface, not
 * volumes that need to occlude one another. Solid geometry standing on the
 * floor — pedestals, pillars, artifacts — is opaque, drawn first, and still
 * writes the depth these decals test against, so nothing bleeds through it.
 */
export function transparentFloorDecal(layer: FloorLayer): {
  polygonOffset: true;
  polygonOffsetFactor: number;
  polygonOffsetUnits: number;
  depthWrite: false;
} {
  return { ...floorDecal(layer), depthWrite: false };
}

/**
 * Draw order for the contact-shadow plane, which has to stay above the whole
 * decal stack — a shadow falls on the inlays and the path, not under them.
 * One past the highest decal layer.
 */
export const CONTACT_SHADOW_ORDER = 7;
