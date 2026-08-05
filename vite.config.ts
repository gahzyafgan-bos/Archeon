import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// import basicSsl from "@vitejs/plugin-basic-ssl";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // basicSsl serves the dev server over HTTPS with a self-signed cert. This is
  // REQUIRED for testing Mode VR on a phone over the LAN: mobile browsers only
  // expose the gyroscope (`DeviceOrientationEvent`) on a secure context, so
  // over plain HTTP the sensor — and therefore VR mode — silently never works.
  // On the phone you'll get a one-time "connection not private" warning for the
  // self-signed cert; tap Advanced → Proceed once and the sensor becomes
  // available. Production hosting is HTTPS already, so this only affects dev.
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["afgan.edufund.biz.id", "localhost"]
  },
  assetsInclude: ["**/*.glb", "**/*.gltf"],
  build: {
    rollupOptions: {
      output: {
        /**
         * Splits the one 1.77 MB bundle the audit found (P2-7) along the only
         * line in it that matters: what we wrote versus what we installed.
         *
         * The win is caching, and it is worth being precise rather than
         * claiming a faster first visit: every byte below is needed to draw the
         * first frame, so a cold load still transfers the same total. What
         * changes is every load after it, and every deploy. The dependencies
         * are ~90% of the bundle and change only when they are upgraded; the
         * museum's own code changes constantly. As one file, a one-line copy
         * fix re-downloaded the entire renderer — on museum Wi-Fi, for every
         * visitor, on every release. Split, that same fix costs 58 kB gzip.
         *
         * Deliberately NOT split further. Separating `three` from the rest
         * produced "Circular chunk: three -> vendor -> three": drei pulls in
         * `three/examples/jsm/*` modules, which depend on small packages that
         * themselves import three, so no cut through node_modules along
         * package names is acyclic. Chasing it would trade fewer bytes for more
         * round trips anyway, and round trips are precisely what the
         * connections this app has to survive are worst at.
         */
        manualChunks(id) {
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
    // The default 500 kB fires on the vendor chunk no matter what we do — a
    // WebGL renderer plus its scene-graph layer is simply that size — and a
    // warning that can never be actioned trains everyone to ignore the build
    // output entirely. Raised to just above what vendor legitimately weighs so
    // it still fires if a chunk grows past anything we can explain.
    chunkSizeWarningLimit: 1600,
  },
});
