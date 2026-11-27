/* 놀이터 기기 관리자 · shp0219@gmail.com Google 로그인 전용
   최신 모바일 크롬(서드파티 쿠키·저장소 차단)에서 로그인이 끝까지 되도록:
   - 로그인 창(팝업) 방식을 먼저 쓰고, 막히면 리디렉션으로 자동 전환
   - 팝업으로 끝까지 안 될 때를 위해 '다른 방식으로 로그인' 버튼도 제공
   - 실패하면 화면에 원인을 한국어 + 에러 코드로 표시
*/
(function () {
  'use strict';

  var S = document.currentScript;
  var ROOT = new URL('..', (S && S.src) || location.href).href;
  var view = document.getElementById('view');

  var ADMIN = 'shp0219@gmail.com';
  var PENDING_KEY = 'ynh.admin.signinAt';
  var auth = null, db = null, unsub = null;
  var lastErr = null;
  var busy = false;

  /* ---------------- 도우미 ---------------- */
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = res;
      s.onerror = function () { rej(new Error('script ' + src)); };
      document.head.appendChild(s);
    });
  }
  function when(ts) {
    try {
      if (!ts) return '';
      var d = ts.toDate ? ts.toDate() : new Date(ts);
      var p = function (n) { return String(n).padStart(2, '0'); };
      return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + p(d.getHours()) + ':' + p(d.getMinutes());
    } catch (e) { return ''; }
  }
  function ua(u) {
    u = u || '';
    if (/Android/i.test(u)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(u)) return 'iPhone';
    if (/Windows/i.test(u)) return 'Windows';
    if (/Macintosh/i.test(u)) return 'Mac';
    return u ? u.slice(0, 24) : '기기 정보 없음';
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  /* 카카오톡·인스타그램 같은 앱 안의 브라우저(웹뷰)인지 확인.
     Google은 이런 웹뷰에서 로그인을 막기 때문에(403 disallowed_useragent)
     크롬으로 열도록 안내해야 합니다. */
  function inAppBrowser() {
    var u = navigator.userAgent || '';
    if (/KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp|WhatsApp|Snapchat|Twitter/i.test(u)) return true;
    if (/Android/i.test(u) && /;\s*wv\)/.test(u)) return true;
    return false;
  }
  function inAppBrowserName() {
    var u = navigator.userAgent || '';
    if (/KAKAOTALK/i.test(u)) return '카카오톡';
    if (/NAVER\(inapp/i.test(u)) return '네이버 앱';
    if (/Instagram/i.test(u)) return '인스타그램';
    if (/FBAN|FBAV/i.test(u)) return '페이스북';
    if (/Line\//i.test(u)) return '라인';
    if (/DaumApps/i.test(u)) return '다음 앱';
    return '앱';
  }

  /* 로그인 오류를 한국어로 */
  var KO = {
    'auth/popup-blocked': '브라우저가 로그인 창을 막았어요. 다시 한 번 눌러 주세요.',
    'auth/popup-closed-by-user': '로그인 창이 끝까지 열리지 않았어요. 다시 시도해 주세요.',
    'auth/cancelled-popup-request': '로그인 창이 여러 번 열려 취소됐어요. 잠시 뒤 다시 시도해 주세요.',
    'auth/operation-not-supported-in-this-environment': '이 브라우저에서는 Google 로그인 창을 열 수 없어요. 크롬에서 열어 주세요.',
    'auth/web-storage-unsupported': '브라우저가 쿠키·저장소를 막고 있어 로그인을 마칠 수 없어요. 크롬에서 열어 주세요.',
    'auth/unauthorized-domain': '이 사이트 주소가 Firebase 로그인 허용 목록에 없어요.',
    'auth/invalid-api-key': 'Firebase 설정(API 키)이 올바르지 않아요.',
    'auth/network-request-failed': '인터넷 연결이 불안정해 로그인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
    'auth/too-many-requests': '시도가 너무 많아 잠시 막혔어요. 조금 뒤에 다시 시도해 주세요.',
    'auth/account-exists-with-different-credential': '같은 메일 주소가 다른 로그인 방법으로 가입되어 있어요.',
    'auth/user-disabled': '이 계정은 사용할 수 없게 되어 있어요.',
    'auth/redirect-operation-pending': '로그인이 이미 진행 중이에요. 잠시만 기다려 주세요.',
    'auth/redirect-cancelled-by-user': '로그인이 취소됐어요. 다시 시도해 주세요.',
    'auth/cancelled-by-user': '로그인이 취소됐어요. 다시 시도해 주세요.',
    'auth/internal-error': '로그인 처리 중 문제가 생겼어요. 다시 시도해 주세요.',
    'auth/argument-error': '로그인 설정에 문제가 있어요(Firebase 설정 확인 필요).',
    'app/redirect-no-user': 'Google 로그인은 끝났지만 관리자 화면으로 로그인 정보가 넘어오지 않았어요. 다시 시도해 주세요.',
    'app/script-failed': 'Firebase 파일을 불러오지 못했어요. 인터넷 연결을 확인한 뒤 새로 고침해 주세요.'
  };
  function koOf(code) {
    return KO[code] || '로그인을 마치지 못했어요. 다시 시도해 주세요.';
  }
  function errBox(err) {
    var code = (err && err.code) || (typeof err === 'string' ? err : '') || 'auth/unknown';
    var msg = KO[code];
    if (!msg) {
      var raw = (err && err.message) ? String(err.message) : '';
      msg = '로그인을 마치지 못했어요.' + (raw ? ' (' + raw + ')' : ' 다시 시도해 주세요.');
    }
    return { code: code, text: msg };
  }
  function errHTML(err) {
    if (!err) return '';
    return '<div class="err">' + esc(err.text) +
      '<br><span style="font-size:11.5px;opacity:.75">코드: ' + esc(err.code) + '</span></div>';
  }

  /* ---------------- 화면 ---------------- */
  function loading(msg) {
    view.innerHTML = '<div class="card"><div class="spin"></div><h2>불러오는 중</h2><p>' +
      esc(msg || '잠시만 기다려 주세요.') + '</p></div>';
  }

  function chromeOpen() {
    var here = location.origin + '/admin/';
    if (/Android/i.test(navigator.userAgent)) {
      location.href = 'intent://' + location.host + '/admin/#Intent;scheme=https;package=com.android.chrome;' +
        'S.browser_fallback_url=' + encodeURIComponent(here) + ';end';
    } else {
      location.href = here;
    }
  }
  function copyAddress(b) {
    var url = location.origin + '/admin/';
    function done() { b.textContent = '주소를 복사했어요!'; setTimeout(function () { b.textContent = '주소 복사'; }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { window.prompt('아래 주소를 복사해 주세요', url); });
    } else {
      window.prompt('아래 주소를 복사해 주세요', url);
    }
  }

  function signinCard(err) {
    var app = inAppBrowser();
    var html = '<div class="card"><div style="font-size:44px;line-height:1">🔐</div>' +
      '<h2>보호자 확인</h2>';
    if (app) {
      html += '<div class="err" style="background:#fff8e6;color:#8a6f19;text-align:left">' +
        '지금 ' + esc(inAppBrowserName()) + ' 안의 브라우저로 열려 있어요.<br>' +
        'Google은 앱 안의 브라우저에서는 로그인을 막아요. <b>크롬으로 열면</b> 바로 됩니다.</div>' +
        '<button class="btn" id="chrome">크롬으로 열기</button>' +
        '<button class="btn ghost" id="copy" style="margin-top:8px">주소 복사</button>' +
        errHTML(err) +
        '<p style="margin:16px 0 0;font-size:13px;color:#8a8398;word-break:keep-all">' +
        '크롬에서 연 뒤 <b>Google로 로그인</b>을 눌러 주세요.<br>' +
        '크롬이 없다면 플레이스토어에서 설치해 주세요.</p>';
    } else {
      html += '<p>기기를 승인·차단하려면 보호자 Google 계정으로 들어와 주세요.</p>';
      html += errHTML(err);
      html += '<button class="btn" id="go">Google로 로그인</button>';
      if (err) {
        html += '<button class="btn ghost" id="alt" style="margin-top:8px">로그인 창이 안 되면 다른 방식으로</button>';
      }
    }
    html += '<p style="margin-top:14px;font-size:12.5px;color:#9a93b0">' + esc(ADMIN) + '</p></div>';
    view.innerHTML = html;

    if (app) {
      document.getElementById('chrome').addEventListener('click', chromeOpen);
      document.getElementById('copy').addEventListener('click', function () { copyAddress(this); });
    } else {
      document.getElementById('go').addEventListener('click', function () { startSignIn(this); });
      var alt = document.getElementById('alt');
      if (alt) alt.addEventListener('click', function () { startRedirect(this); });
    }
  }

  function wrongAccount(email) {
    lastErr = null;
    view.innerHTML = '<div class="card"><div style="font-size:44px;line-height:1">🙅</div>' +
      '<h2>이 계정은 관리자가 아니에요</h2>' +
      '<p><b>' + esc(email) + '</b> 계정으로 로그인되어 있어요.<br>' +
      '기기 관리는 <b>' + esc(ADMIN) + '</b> 계정만 할 수 있어요.</p>' +
      '<button class="btn" id="switch">' + esc(ADMIN) + ' 계정으로 다시 로그인</button></div>';
    document.getElementById('switch').addEventListener('click', function () {
      var b = this;
      b.disabled = true;
      b.textContent = '계정을 바꾸는 중...';
      auth.signOut().then(function () { startSignIn({ disabled: true, textContent: '' }); })
        .catch(function () { startSignIn({ disabled: true, textContent: '' }); });
    });
  }

  /* ---------------- 로그인 ---------------- */
  var POPUP_FALLBACK = [
    'auth/popup-blocked',
    'auth/operation-not-supported-in-this-environment',
    'auth/web-storage-unsupported',
    'auth/cancelled-popup-request',
    'auth/internal-error'
  ];

  function startRedirect(btn) {
    if (!auth) return;
    lastErr = null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Google 로그인 화면으로 이동하는 중...';
    }
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    lsSet(PENDING_KEY, String(Date.now()));
    auth.signInWithRedirect(provider).catch(function (e) {
      busy = false;
      lsDel(PENDING_KEY);
      lastErr = errBox(e);
      signinCard(lastErr);
    });
  }

  function startSignIn(btn) {
    if (busy) return;
    busy = true;
    lastErr = null;
    if (btn) {
      btn.disabled = true;
      btn.textContent = '로그인 창을 여는 중...';
    }
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    lsSet(PENDING_KEY, String(Date.now()));

    function toRedirect() {
      startRedirect(btn);
    }

    auth.signInWithPopup(provider).then(function (res) {
      busy = false;
      lsDel(PENDING_KEY);
      if (res && res.user) onUser(res.user);
      // 로그인되면 onAuthStateChanged가 화면을 바꿉니다
    }).catch(function (e) {
      var code = (e && e.code) || '';
      // 앱 안의 웹뷰(카카오톡 등)에서는 리디렉션도 Google이 막으므로 안내 화면으로
      if (POPUP_FALLBACK.indexOf(code) >= 0 && !inAppBrowser()) { toRedirect(); return; }
      busy = false;
      lsDel(PENDING_KEY);
      lastErr = errBox(e);
      signinCard(lastErr);
    });
  }

  /* ---------------- 목록 ---------------- */
  function render(user, docs) {
    var pend = [], appr = [], blk = [];
    docs.forEach(function (d) {
      (d.status === 'approved' ? appr : d.status === 'blocked' ? blk : pend).push(d);
    });
    var html = '<div class="who"><span>👤 ' + esc(user.email) + '</span>' +
      '<button id="out">로그아웃</button></div>' +
      '<div class="counts"><span>⏳ 대기 <b>' + pend.length + '</b></span>' +
      '<span>✅ 승인 <b>' + appr.length + '</b></span>' +
      '<span>🚫 차단 <b>' + blk.length + '</b></span></div>';

    if (!docs.length) {
      html += '<div class="empty">아직 등록된 기기가 없어요.<br>아이 폰에서 놀이터를 열고 기기 이름을 적어<br>승인을 요청하면 여기에 나타나요.</div>';
    }

    pend.concat(appr, blk).forEach(function (d) {
      var chip = d.status === 'approved' ? '<span class="chip approved">승인됨</span>'
        : d.status === 'blocked' ? '<span class="chip blocked">차단됨</span>'
          : '<span class="chip pending">대기 중</span>';
      html += '<div class="dev" data-id="' + esc(d.id) + '">' +
        '<div class="top"><span class="nm">' + esc(d.name || '이름 없는 기기') + '</span>' + chip + '</div>' +
        '<div class="meta">' +
        (d.code ? '확인 코드 <code>' + esc(d.code) + '</code><br>' : '') +
        ua(d.userAgent) + ' · 요청 ' + esc(when(d.createdAt)) +
        (d.approvedAt ? ' · 승인 ' + esc(when(d.approvedAt)) : '') +
        '</div><div class="acts">' +
        (d.status !== 'approved' ? '<button class="ok" data-act="approve">승인</button>' : '') +
        (d.status !== 'blocked' ? '<button class="no" data-act="block">차단</button>' : '') +
        '<button class="del" data-act="delete">삭제</button>' +
        '</div></div>';
    });

    html += '<p class="help">가윤이·강현이 폰에서 놀이터 주소를 열고 <b>기기 이름</b>을 적어 승인을 요청하면, ' +
      '여기 <b>대기 중</b> 목록에 확인 코드와 함께 나타나요. <b>승인</b>을 누르면 그 폰에서 바로 열려요.<br>' +
      '폰을 바꾸거나 다른 기기에서 열면 새 기기로 다시 승인해 주면 됩니다.</p>';

    view.innerHTML = html;
    var out = document.getElementById('out');
    if (out) out.addEventListener('click', function () {
      loading('로그아웃하는 중');
      if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
      auth.signOut().then(function () { signinCard(''); });
    });

    Array.prototype.forEach.call(view.querySelectorAll('.dev'), function (row) {
      var id = row.getAttribute('data-id');
      Array.prototype.forEach.call(row.querySelectorAll('button[data-act]'), function (b) {
        b.addEventListener('click', function () {
          var act = b.getAttribute('data-act');
          var ref = db.collection('devices').doc(id);
          if (act === 'delete') {
            if (!window.confirm('이 기기를 목록에서 지울까요?\n지우면 그 기기에서는 다시 승인을 요청해야 합니다.')) return;
            b.disabled = true;
            ref.delete().catch(function (e) { alert('지우지 못했어요: ' + ((e && e.code) || e)); b.disabled = false; });
            return;
          }
          var status = act === 'approve' ? 'approved' : 'blocked';
          b.disabled = true;
          b.textContent = '저장 중...';
          ref.update({
            status: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedAt: status === 'approved' ? firebase.firestore.FieldValue.serverTimestamp() : null
          }).catch(function (e) {
            alert('바꾸지 못했어요: ' + ((e && e.code) || e));
            b.disabled = false;
            b.textContent = act === 'approve' ? '승인' : '차단';
          });
        });
      });
    });
  }

  function watch() {
    if (unsub) { try { unsub(); } catch (e) {} }
    unsub = db.collection('devices').orderBy('createdAt', 'desc').onSnapshot(function (snap) {
      var docs = [];
      snap.forEach(function (d) { var o = d.data(); o.id = d.id; docs.push(o); });
      render(auth.currentUser, docs);
    }, function (err) {
      if (!auth.currentUser) return;  // 로그아웃 중에는 로그인 화면이 그려지도록 둡니다
      var code = (err && err.code) || String(err);
      var msg = code === 'permission-denied'
        ? '이 계정에는 기기 목록을 볼 권한이 없어요. 로그아웃한 뒤 ' + ADMIN + ' 계정으로 다시 로그인해 주세요.'
        : code === 'unavailable'
          ? '서버에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'
          : '기기 목록을 불러오지 못했어요.';
      view.innerHTML = '<div class="card"><h2>목록을 불러오지 못했어요</h2><p>' + esc(msg) + '</p>' +
        '<div class="err" style="text-align:left">코드: ' + esc(code) + '</div>' +
        '<button class="btn" id="re">다시 시도</button></div>';
      document.getElementById('re').addEventListener('click', function () { loading('다시 불러오는 중'); watch(); });
    });
  }

  // 검수용: 로그인 없이 목록 화면 모양을 확인할 때만 씀 (권한 없는 상태에서는 실제 데이터 접근은 규칙이 막음)
  window.__ynhAdminRender = render;

  function onUser(user) {
    if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    if (!user) { busy = false; signinCard(lastErr); return; }
    busy = false;
    lastErr = null;
    if (String(user.email || '').toLowerCase() !== ADMIN) { wrongAccount(user.email || '알 수 없는 계정'); return; }
    loading('기기 목록을 불러오는 중');
    if (!db) db = firebase.firestore();
    watch();
  }

  /* ---------------- 시작 ---------------- */
  var watchdog = null;
  loading('관리자 화면을 준비하는 중');
  Promise.all([
    loadScript(ROOT + 'fb-config.js?v=3'),
    loadScript(ROOT + 'sdk/firebase-app-compat.js')
  ]).then(function () {
    return loadScript(ROOT + 'sdk/firebase-auth-compat.js');
  }).then(function () {
    return loadScript(ROOT + 'sdk/firebase-firestore-compat.js');
  }).then(function () {
    if (!firebase.apps.length) firebase.initializeApp(window.YNH_FIREBASE_CONFIG);
    auth = firebase.auth();

    var pending = !!lsGet(PENDING_KEY);

    // 로그인 상태가 늦게 잡혀도 화면이 멈춰 보이지 않도록 8초 뒤에는 로그인 화면을 보여 줍니다
    watchdog = setTimeout(function () {
      if (view.querySelector('.spin')) signinCard(lastErr);
    }, 8000);

    // 상태 감지를 먼저 걸어 두고, 리디렉션 결과는 따로 확인합니다
    auth.onAuthStateChanged(function (user) { onUser(user); });

    auth.getRedirectResult().then(function (res) {
      lsDel(PENDING_KEY);
      if (res && res.user) {
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
        onUser(res.user);
      } else if (pending && !auth.currentUser) {
        lastErr = errBox('app/redirect-no-user');
        if (view.querySelector('#go')) signinCard(lastErr);
      }
    }).catch(function (e) {
      lsDel(PENDING_KEY);
      if (!auth.currentUser) {
        lastErr = errBox(e);
        if (view.querySelector('#go')) signinCard(lastErr);
      }
    });
  }).catch(function (e) {
    view.innerHTML = '<div class="card"><h2>화면을 열지 못했어요</h2><p>' +
      esc(koOf('app/script-failed')) + '</p><div class="err">' + esc((e && e.message) || e) + '</div></div>';
  });
})();
