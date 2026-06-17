var CACHE = 'vrunn-v1';
var ASSETS = [
  '/Empresa-de-motos-/',
  '/Empresa-de-motos-/index.html',
  '/Empresa-de-motos-/style.css',
  '/Empresa-de-motos-/app.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  // Não cacheia chamadas de API (Supabase e Anthropic)
  if (e.request.url.includes('supabase.co') || e.request.url.includes('anthropic.com')) return;
  e.respondWith(
    fetch(e.request).catch(function() { return caches.match(e.request); })
  );
});
