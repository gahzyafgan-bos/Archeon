import React from "react";
import ReactDOM from "react-dom/client";

/**
 * Fonts, served from our own origin.
 *
 * These used to be a single `@import` of fonts.googleapis.com at the top of
 * index.css. That is a render-blocking request to a host we do not control,
 * and it failed in the two situations this museum will actually be used in:
 * a gallery Wi-Fi with no route to the public internet (the text silently
 * fell back to system sans, and Cormorant — the display face the whole
 * identity rests on — simply never arrived), and an installed PWA opened
 * offline. It also handed Google the IP and User-Agent of every visitor,
 * including school groups, with nothing in the app disclosing it.
 *
 * Self-hosted the fonts are ~88 kB of woff2 that Vite fingerprints and emits
 * alongside the bundle, so they cache like any other asset and work with no
 * internet at all.
 *
 * `latin` subset only, and only the weights the design actually uses (see
 * tailwind.config.js): Inter 300/400/500/600 for body copy, Cormorant
 * Garamond 400/500/600 for display. Indonesian needs nothing beyond latin.
 * Imported here rather than from index.css so Vite resolves the package paths
 * through the module graph.
 */
import "@fontsource/inter/latin-300.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/cormorant-garamond/latin-400.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-600.css";

import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registering a service worker is one of the two criteria Chrome checks before
// offering "Add to Home Screen", and since the caching rewrite it is also what
// makes a second visit — or a kiosk device handed to the next visitor — cost
// almost nothing instead of another 40 MB. See public/sw.js.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
