/* 유니 놀이터 — 설치형 앱(PWA)용 최소 서비스 워커. (v3)
   캐시하지 않고 모든 요청을 그대로 네트워크로 보냅니다. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () { /* network only */ });
