import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/**
 * Lint configuration.
 *
 * `npm run lint` existed in package.json from the beginning and had never been
 * runnable: ESLint was not installed and there was no config file, so the
 * command failed with "'eslint' is not recognized" (audit 2026-08-05, P1-9).
 * Everything that lint is supposed to catch had therefore never been checked
 * even once — including the five `// eslint-disable-next-line` comments already
 * scattered through the source, which were suppressing rules that were not
 * running.
 *
 * Deliberately calibrated to fail on real defects and stay quiet otherwise. A
 * lint setup that reports two hundred stylistic complaints on its first run is
 * a lint setup nobody will keep, and the release checklist depends on this
 * command being one that reaches zero.
 */
export default tseslint.config(
  {
    // Build output, vendored decoders/transcoders (third-party, minified), and
    // the incremental build cache are not ours to lint.
    ignores: ["dist/**", "public/draco/**", "public/basis/**", "node_modules/**", "*.tsbuildinfo"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // The single most valuable rule here. Every input hook in this app reads
      // store values inside an effect, and a stale dependency array is exactly
      // how a control silently stops responding.
      "react-hooks/exhaustive-deps": "warn",

      // Dead bindings are how three settings ended up shipping with no
      // consumer. Underscore-prefixed args stay allowed for the many R3F
      // callbacks whose first parameter is unused by design (`(_, delta)`).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],

      // The console policy the audit's P2-1 was about: production builds must
      // not narrate. `console.error`/`console.warn` stay allowed because a
      // failure the visitor is being shown SHOULD leave a trace; `info`/`log`
      // must be behind an `import.meta.env.DEV` guard, which the rule cannot
      // see — so they are errors here and the guarded call sites carry an
      // explicit disable comment stating why.
      "no-console": ["error", { allow: ["warn", "error"] }],

      // R3F leans on `any` in a few loader/material seams; a hard error there
      // would force worse code than the seam itself.
      "@typescript-eslint/no-explicit-any": "warn",

      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Node scripts: no browser globals, and printing IS their entire job.
    files: ["scripts/**/*.mjs", "*.config.js", "*.config.ts"],
    languageOptions: { globals: globals.node },
    rules: { "no-console": "off" },
  },
  {
    // The service worker runs in its own global scope, where `self` is a
    // ServiceWorkerGlobalScope rather than a Window — browser globals do not
    // describe it and every `self` reads as undefined without this.
    files: ["public/sw.js"],
    languageOptions: { globals: globals.serviceworker },
  }
);
