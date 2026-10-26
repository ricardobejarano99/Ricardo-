// Service worker: guarda toda la app para que funcione sin conexión.
// Al publicar cambios, sube VERSION para que los dispositivos descarguen la nueva versión.
const VERSION = 'despacho-1.0.0';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/actions.js',
  './js/app.js',
  './js/backup.js',
  './js/calendar.js',
  './js/catalogos.js',
  './js/crypto.js',
  './js/db.js',
  './js/icons.js',
  './js/plazos.js',
  './js/search.js',
  './js/seed.js',
  './js/store.js',
  './js/util.js',
  './js/views/ajustes.js',
  './js/views/audiencias.js',
  './js/views/calui.js',
  './js/views/common.js',
  './js/views/expedientes.js',
  './js/views/forms.js',
  './js/views/inicio.js',
  './js/views/plazos.js',
  './js/views/tareas.js',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('despacho-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
