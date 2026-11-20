// TILT CHECK 서비스 워커 — 앱 파일을 폰에 저장해 두고, 인터넷 없이도 연다.
// 빌드할 때 VERSION 과 ASSETS 가 자동으로 채워진다 (vite.config.ts).
const VERSION = '__VERSION__';
const ASSETS = [/*__ASSETS__*/];
const CACHE = 'tiltcheck-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tiltcheck-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // 화면 이동(문서)은 저장해 둔 index 로 — 주소에 #경로가 있어도 같은 파일
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./', { ignoreSearch: true })),
    );
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
