/**
 * Single source of truth for how the museum and the team that built the app
 * are named on screen.
 *
 * Everything that shows a credit — onboarding, loading screen, the Tentang
 * section in Pengaturan — reads from here rather than retyping the string, so
 * a change to the wording can't leave one surface behind.
 */

/** The institution. Subject of the whole app; always spelled in full. */
export const MUSEUM_NAME = "Museum Mpu Tantular";

/** The product. */
export const APP_NAME = "Museum Mpu Tantular Virtual";

/** The team that built it. Capitalised only at the start. */
export const TEAM_NAME = "Archeon";

/** The credit line itself. Museum first, team second — the museum is the
 * subject, Archeon is the maker. */
export const CREDIT_LINE = `${APP_NAME} — by ${TEAM_NAME}`;

/** One-sentence description used in the Tentang section. */
export const APP_TAGLINE =
  "Jelajahi jejak peradaban Jawa Timur secara virtual — dari masa prasejarah, kejayaan Hindu-Buddha, hingga era modern.";

/** Kept in step with package.json manually; shown in Tentang. */
export const APP_VERSION = "0.1.0";

/** Optional team mark. Drop the file in and it appears; until then nothing is
 * rendered in its place — see docs/cara-mengganti-logo-archeon.md. */
export const TEAM_LOGO_PATH = "/images/brand/archeon-logo.webp";
