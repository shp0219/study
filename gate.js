/* 유니혀니 놀이터 · 기기 승인 게이트
   승인된 기기(devices/{deviceId}.status === 'approved')에서만 놀이터 내용을 보여 줍니다.
   화면 내용은 처음부터 숨겨 두고(막힘 우선), 승인을 확인한 뒤에만 엽니다. */
(function () {
  'use strict';

  var S = document.currentScript;
  var ROOT = new URL('.', (S && S.src) || location.href).href;

  var de = document.documentElement;
  de.classList.add('pg-locked');
  var st = document.createElement('style');
  st.textContent = 'html.pg-locked,html.pg-locked body{overflow:hidden!important}' +
    'html.pg-locked body{visibility:hidden!important}' +
    'html.pg-locked body>*:not(#pg-gate){display:none!important}' +
    'html.pg-locked #pg-gate,html.pg-locked #pg-gate *{visibility:visible!important}';
  (document.head || de).appendChild(st);

  var ID_KEY = 'ynh.deviceId', NAME_KEY = 'ynh.deviceName', OK_KEY = 'ynh.approvedAt';
  var OFFLINE_OK_MS = 7 * 24 * 3600 * 1000;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function deviceId() {
    var v = get(ID_KEY);
    if (v) return v;
    v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    set(ID_KEY, v);
    return v;
  }
  var DEVICE = deviceId();

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error('script ' + src)); };
      document.head.appendChild(s);
    });
  }
  function withTimeout(p, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error('timeout')); }, ms);
      p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }

  /* ---------------- 화면 ---------------- */
  var CSS = [
    '#pg-gate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;',
    'padding:22px;overflow:auto;background:linear-gradient(160deg,#fff3f8 0%,#f2f0ff 48%,#eafaf2 100%);',
    'font-family:"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;',
    'color:#3b3550;-webkit-text-size-adjust:100%}',
    '#pg-gate.pg-out{opacity:0;transition:opacity .3s ease}',
    '#pg-gate .pg-card{width:100%;max-width:390px;background:#fff;border-radius:26px;padding:26px 22px 22px;',
    'box-shadow:0 18px 46px rgba(96,79,150,.16);text-align:center}',
    '#pg-gate .pg-lock{font-size:52px;line-height:1;margin:2px 0 10px}',
    '#pg-gate h1{font-size:21px;margin:0 0 8px;letter-spacing:-.3px}',
    '#pg-gate p{font-size:14.5px;line-height:1.65;color:#6b6484;margin:0 0 16px;word-break:keep-all}',
    '#pg-gate .pg-name{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:13px 14px;',
    'border:1.5px solid #e3def5;border-radius:14px;background:#fbfaff;color:#3b3550;text-align:center;outline:none}',
    '#pg-gate .pg-name:focus{border-color:#a98bf0;background:#fff}',
    '#pg-gate .pg-btn{width:100%;box-sizing:border-box;margin-top:10px;font:inherit;font-size:16px;font-weight:700;',
    'padding:14px;border:0;border-radius:14px;background:linear-gradient(135deg,#8c6cf0,#e06fa8);color:#fff;',
    'box-shadow:0 8px 18px rgba(140,108,240,.28);cursor:pointer}',
    '#pg-gate .pg-btn[disabled]{opacity:.6}',
    '#pg-gate .pg-code{margin:14px auto 4px;display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;',
    'font-size:30px;font-weight:800;letter-spacing:7px;color:#5b3fb0;background:#f4efff;',
    'border-radius:14px;padding:8px 14px 8px 20px}',
    '#pg-gate .pg-chip{display:inline-block;font-size:12px;font-weight:700;color:#8a6f19;background:#fff6d8;',
    'border-radius:999px;padding:5px 11px;margin-bottom:12px}',
    '#pg-gate .pg-chip.bad{color:#a8324b;background:#ffe9ef}',
    '#pg-gate .pg-ok{width:100%;box-sizing:border-box;margin-top:12px;font:inherit;font-size:15px;font-weight:700;',
    'padding:12px;border:1.5px solid #e3def5;border-radius:14px;background:#fff;color:#5b3fb0;cursor:pointer}',
    '#pg-gate .pg-link{display:inline-block;margin-top:14px;font-size:12.5px;color:#a49dbd;text-decoration:underline;background:none;border:0;font-family:inherit;cursor:pointer}',
    '#pg-gate .pg-small{font-size:12.5px;color:#9a93b0;margin:14px 0 0}',
    '#pg-gate .pg-spin{width:34px;height:34px;margin:6px auto 14px;border-radius:50%;border:3px solid #ece5ff;border-top-color:#8c6cf0;animation:pgspin .9s linear infinite}',
    '@keyframes pgspin{to{transform:rotate(360deg)}}',
    '#pg-gate .pg-dot{display:inline-block;animation:pgb 1.2s infinite}',
    '@keyframes pgb{0%,100%{opacity:.25}50%{opacity:1}}'
  ].join('');

  var box;
  function overlay() {
    if (box) return box;
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
    box = document.createElement('div');
    box.id = 'pg-gate';
    document.body.appendChild(box);
    return box;
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render(html) { overlay().innerHTML = '<div class="pg-card">' + html + '</div>'; }

  function checking() {
    render('<div class="pg-spin"></div><h1>기기 확인 중</h1>' +
      '<p>이 기기가 놀이터를 열 수 있는지 확인하고 있어요.' +
      '<span class="pg-dot">●</span></p>');
  }

  function requestForm(msg) {
    var saved = get(NAME_KEY) || '';
    render('<div class="pg-lock">🔒</div><h1>승인 대기 중</h1>' +
      '<p>' + (msg ? esc(msg) + '<br>' : '') +
      '이 기기는 아직 승인되지 않았어요.<br>아래에 기기 이름을 적고 승인을 요청하면<br>보호자가 열어 줄 수 있어요.</p>' +
      '<input class="pg-name" id="pg-name" maxlength="20" placeholder="예: 가윤이 폰" value="' + esc(saved) + '">' +
      '<button class="pg-btn" id="pg-send">승인 요청하기</button>' +
      '<p class="pg-small">보호자는 관리자 화면에서 이 기기를 승인할 수 있어요.</p>');
    var input = document.getElementById('pg-name');
    var btn = document.getElementById('pg-send');
    function go() {
      if (btn.disabled) return;
      var name = (input.value || '').trim();
      if (!name) {
        input.focus();
        input.placeholder = '기기 이름을 적어 주세요';
        input.style.borderColor = '#f0a6bd';
        return;
      }
      btn.disabled = true;
      btn.textContent = '보내는 중...';
      send(name);
    }
    btn.addEventListener('click', go);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }

  function waiting(d) {
    var name = (d && d.name) || get(NAME_KEY) || '이 기기';
    var code = (d && d.code) || '';
    render('<div class="pg-chip">승인 대기 중</div>' +
      '<div class="pg-lock">⏳</div>' +
      '<h1>승인을 기다리고 있어요</h1>' +
      '<p><b>' + esc(name) + '</b>(으)로 승인을 요청했어요.<br>보호자가 승인하면 잠시 뒤 저절로 열려요.</p>' +
      (code ? '<div class="pg-code">' + esc(code) + '</div>' +
        '<p class="pg-small">이 확인 코드를 보호자에게 알려 주면<br>보호자가 어떤 기기인지 바로 찾을 수 있어요.</p>' : '') +
      '<button class="pg-ok" id="pg-again">다시 확인</button>' +
      '<button class="pg-link" id="pg-rename">기기 이름 바꾸기</button>');
    document.getElementById('pg-again').addEventListener('click', function () {
      checking(); start();
    });
    document.getElementById('pg-rename').addEventListener('click', function () {
      requestForm('기기 이름을 다시 적어 주세요.');
    });
  }

  function blocked(d) {
    render('<div class="pg-chip bad">사용 중지</div>' +
      '<div class="pg-lock">🚫</div>' +
      '<h1>이 기기에서는 열 수 없어요</h1>' +
      '<p>' + esc((d && d.name) || '이 기기') + '의 사용이 중지되어 있어요.<br>보호자에게 다시 승인해 달라고 해 주세요.</p>' +
      (d && d.code ? '<div class="pg-code">' + esc(d.code) + '</div>' : '') +
      '<button class="pg-ok" id="pg-again">다시 확인</button>');
    document.getElementById('pg-again').addEventListener('click', function () { checking(); start(); });
  }

  function errorView(msg) {
    render('<div class="pg-lock">📡</div><h1>연결을 확인해 주세요</h1>' +
      '<p>기기 승인을 확인하지 못했어요.<br>인터넷이 연결되어 있는지 보고 다시 해 주세요.</p>' +
      '<button class="pg-btn" id="pg-retry">다시 시도</button>' +
      '<p class="pg-small">' + esc(msg || '') + '</p>');
    document.getElementById('pg-retry').addEventListener('click', function () { checking(); start(); });
  }

  /* ---------------- Firestore ---------------- */
  var db = null, ref = null, unsub = null;

  function unlock(data) {
    set(OK_KEY, String(Date.now()));
    if (data && data.name) set(NAME_KEY, data.name);
    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    de.classList.remove('pg-locked');
    var g = document.getElementById('pg-gate');
    if (g) {
      g.classList.add('pg-out');
      setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, 320);
    }
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  }

  function send(name) {
    set(NAME_KEY, name);
    var code = String(Math.floor(100000 + Math.random() * 900000));
    var doc = db.collection('devices').doc(DEVICE);
    doc.set({
      deviceId: DEVICE,
      name: name,
      status: 'pending',
      code: code,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: (navigator.userAgent || '').slice(0, 180)
    }).then(function () {
      listen();
    }).catch(function (e) {
      var msg = (e && e.code) || String(e);
      if (msg === 'permission-denied') {
        // 이미 문서가 있는 기기: 이름만 바꿔 다시 요청
        doc.update({ name: name, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
          .then(listen)
          .catch(function (e2) { errorView((e2 && e2.code) || String(e2)); });
        return;
      }
      errorView(msg);
    });
  }

  function listen() {
    if (!db) return;
    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    ref = db.collection('devices').doc(DEVICE);
    try {
      unsub = ref.onSnapshot(function (snap) {
        var d = snap.exists ? snap.data() : null;
        if (d && d.status === 'approved') return unlock(d);
        if (d && d.status === 'blocked') return blocked(d);
        if (d) return waiting(d);
        requestForm();
      }, function (err) {
        var at = +(get(OK_KEY) || 0);
        if (at && Date.now() - at < OFFLINE_OK_MS) return unlock({ name: get(NAME_KEY) });
        var code = (err && err.code) || '';
        if (code === 'permission-denied') return errorView('permission-denied');
        errorView(code || String(err));
      });
    } catch (e) {
      errorView(String(e));
    }
  }

  function start() {
    if (!db) return init();
    listen();
  }

  function init() {
    checking();
    withTimeout(
      loadScript(ROOT + 'fb-config.js?v=3')
        .then(function () { return loadScript(ROOT + 'sdk/firebase-app-compat.js'); })
        .then(function () { return loadScript(ROOT + 'sdk/firebase-firestore-compat.js'); })
        .then(function () {
          if (!firebase.apps.length) firebase.initializeApp(window.YNH_FIREBASE_CONFIG);
          db = firebase.firestore();
          listen();
        }), 15000
    ).catch(function (err) {
      var at = +(get(OK_KEY) || 0);
      if (at && Date.now() - at < OFFLINE_OK_MS) return unlock({ name: get(NAME_KEY) });
      errorView((err && err.message) || String(err));
    });
  }

  function boot() {
    overlay();
    checking();
    init();
  }
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
