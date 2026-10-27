// Offline support. App files: serve from cache, refresh in the background
// (so updates arrive on the next launch). Audio and fonts: cache forever once fetched.

const SHELL = 'shell-v5';
const MEDIA = 'audio-v1';
const FONTS = 'fonts-v1';
const FILES = [
  './', 'index.html', 'report.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/audio.js', 'js/course.js', 'js/fsrs.js', 'js/store.js', 'js/story.js', 'js/progress.js', 'js/report.js',
  'data/course.json', 'data/story.json', 'audio/manifest.json',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => ![SHELL, MEDIA, FONTS].includes(k)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(FONTS, e.request));
    return;
  }
  if (url.origin !== location.origin) return;

  if (url.pathname.includes('/audio/') && url.pathname.endsWith('.mp3')) {
    e.respondWith(cacheFirst(MEDIA, e.request));
    return;
  }

  e.respondWith(caches.open(SHELL).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then((res) => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => hit);
    return hit || fresh;
  }));
});
