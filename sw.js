var CACHE = 'vrunn-v4';
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

self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) { data = { title: 'Vrunn', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Vrunn', {
      body: data.body || '',
      icon: '/Empresa-de-motos-/logo.png',
      badge: '/Empresa-de-motos-/logo.png',
      tag: data.tag || 'vrunn-alerta',
      data: { url: data.url || '/Empresa-de-motos-/' }
    })
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/Empresa-de-motos-/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf('/Empresa-de-motos-/') !== -1 && 'focus' in list[i]) return list[i].focus();
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', function(e) {
  // Não cacheia chamadas de API (Supabase e Anthropic)
  if (e.request.url.includes('supabase.co') || e.request.url.includes('anthropic.com')) return;
  e.respondWith(
    fetch(e.request).catch(function() { return caches.match(e.request); })
  );
});
