// Minimal pass-through service worker — its only job is satisfying Chrome's
// "installable" criteria (a manifest + a registered SW) so the browser offers
// "Add to Home Screen". Deliberately no offline caching: that's out of scope.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
