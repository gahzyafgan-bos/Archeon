/**
 * Angle helpers shared by the look/rotation code paths (gyro source +
 * PlayerRig). Both need the exact same wraparound semantics — keeping one
 * implementation means a yaw value can be handed from one to the other
 * without either side re-deriving the ±π convention slightly differently.
 */

const TWO_PI = Math.PI * 2;

/** Folds any angle back into (-π, π]. */
export function wrapAngle(a: number): number {
  let wrapped = a % TWO_PI;
  if (wrapped > Math.PI) wrapped -= TWO_PI;
  if (wrapped < -Math.PI) wrapped += TWO_PI;
  return wrapped;
}

/**
 * Shortest-path angle lerp, so interpolating across the ±π seam takes the
 * short way round instead of spinning almost a full turn backwards.
 */
export function lerpAngle(from: number, to: number, t: number): number {
  let diff = (to - from) % TWO_PI;
  if (diff > Math.PI) diff -= TWO_PI;
  if (diff < -Math.PI) diff += TWO_PI;
  return from + diff * t;
}
