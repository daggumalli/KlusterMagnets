var CACHE_NAME = "kluster-v1";
var ASSETS = [
  "/index.html",
  "/css/style.css",
  "/js/config.js",
  "/js/physics.js",
  "/js/renderer.js",
  "/js/audio.js",
  "/js/haptics.js",
  "/js/ai.js",
  "/js/ui.js",
  "/js/game.js",
  "/js/app.js",
  "/manifest.json",
];

self.addEventListener("install", function(e) {
  e.waitUntil(caches.open(CACHE_NAME).then(function(c) { return c.addAll(ASSETS); }));
});

self.addEventListener("fetch", function(e) {
  e.respondWith(
    caches.match(e.request).then(function(r) { return r || fetch(e.request); })
  );
});

self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    })
  );
});
