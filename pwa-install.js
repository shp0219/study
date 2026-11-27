/* 유니혀니 놀이터 · 인앱 설치 버튼
   - 평소에는 숨겨 두고, 브라우저가 beforeinstallprompt 를 보내면 아래쪽 배너로 보여 줍니다.
   - 누르면 브라우저 설치 창(prompt)을 띄우고, 설치가 끝나거나 창을 닫으면 배너를 숨깁니다.
   - 이미 앱으로 열려 있거나(standalone) 이번 방문에서 닫은 경우에는 보이지 않습니다. */
(function () {
  'use strict';

  var deferred = null;
  var bar = null;
  var HIDE_KEY = 'ynh.installBarHidden';

  function standalone() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.navigator.standalone === true) return true;
    } catch (e) {}
    return false;
  }
  function hiddenThisSession() {
    try { return sessionStorage.getItem(HIDE_KEY) === '1'; } catch (e) { return false; }
  }
  function rememberHidden() {
    try { sessionStorage.setItem(HIDE_KEY, '1'); } catch (e) {}
  }

  function css() {
    var st = document.createElement('style');
    st.textContent =
      '#pwa-install-bar{position:fixed;left:10px;right:10px;' +
      'bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:2147482000;' +
      'display:flex;align-items:center;gap:6px;box-sizing:border-box;' +
      'padding:7px 8px 7px 8px;border-radius:18px;' +
      'background:linear-gradient(135deg,#ffffff,#fff4fa 60%,#eef7ff);' +
      'box-shadow:0 8px 24px rgba(70,58,110,.22),0 2px 6px rgba(70,58,110,.12);' +
      'border:1px solid rgba(160,140,210,.28);' +
      'font-family:"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,-apple-system,sans-serif}' +
      '#pwa-install-bar[hidden]{display:none!important}' +
      '#pwa-install-go{flex:1 1 auto;min-width:0;box-sizing:border-box;font:inherit;font-size:14px;font-weight:800;' +
      'letter-spacing:-.3px;color:#4a3a7a;background:linear-gradient(135deg,#efe6ff,#ffe9f4);' +
      'border:0;border-radius:13px;padding:11px 12px;cursor:pointer;white-space:nowrap;' +
      'overflow:hidden;text-overflow:ellipsis;touch-action:manipulation}' +
      '#pwa-install-go:active{filter:brightness(.97)}' +
      '#pwa-install-x{flex:0 0 auto;width:34px;height:34px;box-sizing:border-box;font:inherit;font-size:14px;' +
      'color:#9a93b0;background:#ffffffcc;border:0;border-radius:50%;cursor:pointer;' +
      'touch-action:manipulation;line-height:1}';
    document.head.appendChild(st);
  }

  function build() {
    if (bar) return bar;
    if (!document.body) return null;
    css();
    bar = document.createElement('div');
    bar.id = 'pwa-install-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', '홈 화면에 앱 설치');
    bar.hidden = true;
    bar.innerHTML =
      '<button type="button" id="pwa-install-go">📲 홈 화면에 앱 설치</button>' +
      '<button type="button" id="pwa-install-x" aria-label="설치 안내 닫기">✕</button>';
    document.body.appendChild(bar);

    bar.querySelector('#pwa-install-go').addEventListener('click', function () {
      var p = deferred;
      deferred = null;
      hide();
      if (!p) return;
      try { p.prompt(); } catch (e) { return; }
      try {
        p.userChoice.then(function () {}).catch(function () {});
      } catch (e) {}
    });
    bar.querySelector('#pwa-install-x').addEventListener('click', function () {
      rememberHidden();
      hide();
    });
    return bar;
  }

  function gateLocked() {
    try { return document.documentElement.classList.contains('pg-locked'); } catch (e) { return false; }
  }

  function show() {
    if (!deferred || standalone() || hiddenThisSession()) return;
    if (gateLocked()) return;          // 기기 승인 화면이 떠 있는 동안은 숨김
    var b = build();
    if (b) b.hidden = false;
  }
  function hide() {
    if (bar) bar.hidden = true;
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', show, { once: true });
    } else {
      show();
    }
    // 기기 승인 확인이 끝나 잠금이 풀리면 그때 배너를 보여 줍니다.
    try {
      new MutationObserver(function () { show(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    } catch (err) {}
  });

  window.addEventListener('appinstalled', function () {
    deferred = null;
    rememberHidden();
    hide();
  });
})();
