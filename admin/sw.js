/* 놀이터 기기 관리 — 홈 화면 앱(PWA)용 최소 서비스 워커.
   관리 화면은 늘 최신 기기 목록을 보여 줘야 하므로 캐시하지 않고
   모든 요청을 그대로 네트워크로 보냅니다(네트워크 우선). */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () { /* network only */ });
