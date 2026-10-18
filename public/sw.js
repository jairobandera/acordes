// Service worker mínimo: habilita la instalación (acceso directo) y un fallback
// offline simple para el shell. No cachea datos de la API ni de las canciones.
const CACHE = 'acordes-shell-v1';
const SHELL = ['/', '/index.html', '/css/styles.css', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  // Solo GET de navegación/estáticos; la API y el scraping van siempre a la red.
  if (request.method !== 'GET' || request.url.includes('/api/')) return;
  e.respondWith(
    fetch(request).catch(() => caches.match(request).then((r) => r || caches.match('/index.html')))
  );
});
