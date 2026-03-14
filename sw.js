var CACHE_NAME = "kluster-v2";
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
    fetch(e.request).then(function(r) {
      var clone = r.clone();
      caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
      return r;
    }).catch(function() { return caches.match(e.request); })
  );
});

self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    })
  );
});
