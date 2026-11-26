/* 생각펼치기 — 끊겨도 열리게 파일을 담아 둔다. 판을 바꾸면 이름(v)을 올린다. */
const CACHE = 'saenggak-v3';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'layout.js', 'templates.js', 'export.js', 'sync.js', 'config.js', 'firebase-backend.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'favicon.ico'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  // 이 앱 파일과 파이어베이스 프로그램 파일만 담는다 (로그인·저장소 통신은 건드리지 않음)
  if (u.origin !== location.origin && !(u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/'))) return;
  if (u.origin === location.origin && (u.pathname.includes('/__') || u.pathname.includes('/tests/'))) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
