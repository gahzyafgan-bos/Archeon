/**
 * Service worker.
 *
 * This file used to be fourteen lines that did `event.respondWith(fetch(...))`
 * — a pass-through whose only job was satisfying Chrome's "installable"
 * criteria so the browser would offer "Add to Home Screen". The 2026-08-05
 * audit is what changed the calculation (section C.5 and note 3):
 *
 *  - An installed PWA re-downloaded the full ~40 MB **every time it was
 *    opened**. "Install" bought fullscreen and nothing else.
 *  - A museum kiosk device handed from visitor to visitor all day paid that
 *    40 MB on every single handover.
 *  - Thirty visitors on a shared 20 Mbps gallery Wi-Fi need ~12.4 minutes to
 *    all be served once. Nothing was being reused between them, or between
 *    visits by the same person.
 *
 * So: cache, but only where caching cannot serve someone a stale museum.
 *
 * ## Version
 *
 * **Bump CACHE_VERSION whenever a file in `public/` is replaced without its
 * name changing** — a new `.glb` for an existing artifact, a re-exported
 * texture, a new greeter photo. Media below is served cache-first and is NOT
 * content-hashed, so an in-place replacement is invisible to every browser
 * that already has the old one until the version changes. Renaming the file
 * instead (as `durga-mahisasuramardhini.glb` did) sidesteps this entirely and
 * is the safer habit.
 *
 * Build output under `/assets/` does not need this: Vite fingerprints those
 * filenames, so a change is already a different URL.
 */
const CACHE_VERSION = "v1";
const SHELL_CACHE = `museum-shell-${CACHE_VERSION}`;
const MEDIA_CACHE = `museum-media-${CACHE_VERSION}`;
const KEEP = [SHELL_CACHE, MEDIA_CACHE];

/**
 * Heavy, immutable-by-convention assets: models, decoders, audio, images.
 *
 * `/audio/` covers the eleven audio-guide narrations under `/audio/guide/`, and
 * covering them *here* — runtime, cache-first, on first use — rather than in a
 * precache list is the deliberate choice. Precaching the folder would add ~2.5
 * MB to the very first load of a museum where most visitors open three or four
 * artifacts and listen to none of them. Cached on first play, the second
 * visitor to that artifact pays nothing, which is the same bargain every model
 * in here already makes.
 *
 * If a precache manifest is ever introduced for the shell, `/audio/guide/` must
 * be excluded from it.
 *
 * One requirement this places on the player: guide audio is loaded through Web
 * Audio (`html5: false` in audio/guideAudio.ts), so it arrives as an ordinary
 * XHR and lands in the cache below. An HTML5 <audio> element would fetch it
 * with `Range:` instead and be handed straight to the network by the guard
 * further down, caching nothing, forever.
 */
const MEDIA_PREFIXES = ["/models/", "/draco/", "/basis/", "/audio/", "/images/", "/icons/"];

self.addEventListener("install", () => {
  // Nothing is precached. The shell's filenames are fingerprinted at build
  // time and this file is not, so it cannot name them without a build step
  // that writes a manifest into it — and precaching the wrong list is worse
  // than precaching none. Everything below fills on first use instead, which
  // for a museum is the same thing: the first visitor of the day warms the
  // cache for every visitor after them.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache from a previous CACHE_VERSION. Without this the old
      // 40 MB of models would sit in storage forever alongside the new ones.
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable, and only our own origin is ours to cache.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Range requests must be left completely alone. The soundtrack is streamed
  // with `Range:` and comes back 206 Partial Content; the Cache API throws on
  // any attempt to store a 206, and a cached full response answered to a range
  // request confuses the media element. Straight to the network.
  if (request.headers.has("range")) return;

  // Never cache the worker itself — a stale service worker is the one bug that
  // cannot be fixed by shipping a fix.
  if (url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event, request));
    return;
  }

  if (MEDIA_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(cacheFirst(event, request, MEDIA_CACHE));
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    // Content-hashed by Vite: the URL changes whenever the bytes do, so a hit
    // here can never be stale.
    event.respondWith(cacheFirst(event, request, SHELL_CACHE));
    return;
  }

  // The manifest, and anything else at the root. Freshness matters more than
  // speed for these and they are tiny.
  event.respondWith(networkFirst(event, request, SHELL_CACHE));
});

/**
 * Hand the write to the event, not to luck.
 *
 * A service worker may be terminated the moment the response it was asked for
 * has been delivered. `cache.put()` on a 9 MB model is not instant, so firing
 * it off and returning meant the browser was free to kill the worker
 * mid-write — and a cache that only fills when the worker happens to survive
 * long enough is not a cache, it is a coin flip. `waitUntil` is what tells the
 * browser the worker is still busy.
 */
function keepAliveFor(event, promise) {
  event.waitUntil(promise.catch(() => {}));
}

/**
 * HTML: network first.
 *
 * The document is what points at every fingerprinted asset, so serving a
 * cached copy first would pin visitors to an old build indefinitely. Falling
 * back to the cache only when the network genuinely fails is what makes the
 * installed app work on a gallery Wi-Fi with no route out.
 */
async function handleNavigation(event, request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) keepAliveFor(event, cache.put(request, response.clone()));
    return response;
  } catch {
    // This is a single-page app: any path is served by the same document, so
    // a cached "/" answers a deep link just as correctly as a cached match.
    return (await cache.match(request)) || (await cache.match("/")) || Response.error();
  }
}

async function cacheFirst(event, request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (isCacheable(response)) {
    keepAliveFor(event, cache.put(request, response.clone()));
  }
  return response;
}

/**
 * Whether a response is safe to store under the URL that was asked for.
 *
 * `basic` excludes opaque cross-origin replies and `ok` excludes ordinary
 * errors, but neither is enough here. This app is hosted as a single-page app,
 * which means the host answers **anything it cannot find with a 200 and the
 * contents of index.html** — the audit caught exactly that happening to
 * `/images/brand/archeon-logo.webp`, a file that does not exist and that came
 * back as a 2.7 kB HTML page (P3-2). Cache-first plus a 200 means one missing
 * asset would be pinned as an HTML document under a `.glb`/`.webp` URL for as
 * long as the cache lives, and the fallback that currently hides it would stop
 * being able to.
 *
 * So: a non-document request must not be satisfied by a document.
 */
function isCacheable(response) {
  if (!response.ok || response.type !== "basic") return false;
  const type = response.headers.get("content-type") || "";
  return !type.includes("text/html");
}

async function networkFirst(event, request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      keepAliveFor(event, cache.put(request, response.clone()));
    }
    return response;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw new Error("offline dan tidak ada salinan tersimpan");
  }
}
