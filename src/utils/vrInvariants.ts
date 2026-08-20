/**
 * Dev-mode invariant checks for the Cardboard stereo path.
 *
 * The point is not to find today's bug — it is to make sure the three rules
 * that keep being broken cannot be broken again silently. Every VR regression
 * this project has had (yellow, black, framing, ghosting, left/right asymmetry)
 * shared one trait: nothing in the code disagreed out loud, so the first report
 * came from a person holding a phone, days later, describing a symptom.
 *
 * The invariants:
 *   1. **Equal eye viewports.** Tolerance 0 px. Two images of different sizes
 *      cannot be fused; see vrViewport.ts.
 *   2. **Symmetric overlay.** The DOM HUD's two halves must sit at the same
 *      offset from their own eye's centre, within 1 px.
 *   3. **One head pose per frame.** Both eyes must be rendered from the same
 *      instant of head orientation. Two poses in a frame is a vertical/temporal
 *      disparity the visual system reads as the world tearing in half.
 *
 * All of it is behind VR_DIAG_ENABLED (import.meta.env.DEV, which Vite
 * statically replaces), so the whole module tree-shakes out of a production
 * build and costs a shipped visitor nothing.
 *
 * Warnings are throttled per invariant. A per-frame check that fails will fail
 * ~60 times a second, and a console that has scrolled 4000 identical lines is
 * as useless as a silent one.
 */

// Deliberately NOT imported from vrDiagnostics: that module prints this one's
// summary in its dump, and a cycle whose entry point is a module-scope const is
// how a temporal-dead-zone crash gets shipped. `import.meta.env.DEV` is a
// literal Vite substitutes at build time, so both copies are the same boolean
// and both branches vanish from a production bundle.
const VR_DIAG_ENABLED = import.meta.env.DEV;

const WARN_INTERVAL_MS = 3000;

export interface VrInvariantState {
  /** Human-readable text of every invariant currently failing, newest wins. */
  failures: Record<string, string>;
  /** How many times each invariant has failed since VR was entered. */
  counts: Record<string, number>;
}

export const vrInvariants: VrInvariantState = {
  failures: {},
  counts: {},
};

const lastWarnAt: Record<string, number> = {};

/**
 * Records the result of one invariant check.
 *
 * `key` groups a check across frames (it is what gets throttled and what the
 * on-screen readout lists); `detail` is built by the caller only when the check
 * has already failed, so the string work never happens on a healthy frame.
 */
export function checkVrInvariant(key: string, ok: boolean, detail: () => string): void {
  if (!VR_DIAG_ENABLED) return;

  if (ok) {
    if (vrInvariants.failures[key]) delete vrInvariants.failures[key];
    return;
  }

  const message = detail();
  vrInvariants.failures[key] = message;
  vrInvariants.counts[key] = (vrInvariants.counts[key] ?? 0) + 1;

  const now = performance.now();
  if (now - (lastWarnAt[key] ?? -Infinity) < WARN_INTERVAL_MS) return;
  lastWarnAt[key] = now;
  console.warn(
    `[vr-invariant] ${key}: ${message} (×${vrInvariants.counts[key]} sejak masuk VR)`
  );
}

/** Clears the record. Called on VR entry so counts describe the current session. */
export function resetVrInvariants(): void {
  if (!VR_DIAG_ENABLED) return;
  for (const k of Object.keys(vrInvariants.failures)) delete vrInvariants.failures[k];
  for (const k of Object.keys(vrInvariants.counts)) delete vrInvariants.counts[k];
  for (const k of Object.keys(lastWarnAt)) delete lastWarnAt[k];
}

/** One-line summary for the in-headset readout: "" when everything holds. */
export function vrInvariantSummary(): string {
  if (!VR_DIAG_ENABLED) return "";
  const keys = Object.keys(vrInvariants.failures);
  if (keys.length === 0) return "";
  return keys.map((k) => `${k}×${vrInvariants.counts[k]}`).join(" · ");
}

// --- Invariant 3: one head pose per frame -----------------------------------
//
// Measured rather than asserted from the shape of the code. The rule is easy to
// break from a distance: any useFrame callback that moves the rig or calls
// updateMatrixWorld() and happens to be scheduled between the two eye renders
// shifts the right eye's viewpoint without touching this file at all. So the
// check reads the matrix three actually rendered the left eye with, and
// compares it to the matrix present when the right eye goes out.

const poseSnapshot = new Float64Array(16);
let poseSnapshotValid = false;

/** Call immediately after the LEFT eye has been rendered. */
export function snapshotHeadPose(elements: ArrayLike<number>): void {
  if (!VR_DIAG_ENABLED) return;
  for (let i = 0; i < 16; i++) poseSnapshot[i] = elements[i];
  poseSnapshotValid = true;
}

/**
 * Call immediately before the RIGHT eye is rendered. Compares against the
 * snapshot; any difference at all means a second pose entered the frame.
 *
 * Tolerance is 0, not an epsilon: nothing legitimately writes to the head
 * matrix between the two calls, so the two copies are either bit-identical or
 * something moved.
 */
export function verifyHeadPoseUnchanged(elements: ArrayLike<number>): void {
  if (!VR_DIAG_ENABLED || !poseSnapshotValid) return;
  let worstIndex = -1;
  let worstDelta = 0;
  for (let i = 0; i < 16; i++) {
    const d = Math.abs(poseSnapshot[i] - elements[i]);
    if (d > worstDelta) {
      worstDelta = d;
      worstIndex = i;
    }
  }
  checkVrInvariant(
    "pose-per-frame",
    worstDelta === 0,
    () =>
      `matriks kepala berubah di antara render mata kiri dan kanan ` +
      `(elemen ${worstIndex} bergeser ${worstDelta.toExponential(3)}). ` +
      `Ada useFrame lain yang menggerakkan rig/kamera di tengah frame VR.`
  );
}
