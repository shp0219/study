/* 놀이터 기기 관리자 · shp0219@gmail.com Google 로그인 전용 */
(function () {
  'use strict';

  var S = document.currentScript;
  var ROOT = new URL('..', (S && S.src) || location.href).href;
  var view = document.getElementById('view');

  var ADMIN = 'shp0219@gmail.com';
  var auth = null, db = null, unsub = null;

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

  function loading(msg) {
    view.innerHTML = '<div class="card"><div class="spin"></div><h2>불러오는 중</h2><p>' +
      esc(msg || '잠시만 기다려 주세요.') + '</p></div>';
  }

  function signinCard(msg) {
    view.innerHTML = '<div class="card"><div style="font-size:44px;line-height:1">🔐</div>' +
      '<h2>보호자 확인</h2>' +
      '<p>기기를 승인·차단하려면 보호자 Google 계정으로 들어와 주세요.</p>' +
      (msg ? '<div class="err">' + esc(msg) + '</div>' : '') +
      '<button class="btn" id="go">Google로 로그인</button>' +
      '<p style="margin-top:14px;font-size:12.5px;color:#9a93b0">' + esc(ADMIN) + '</p></div>';
    document.getElementById('go').addEventListener('click', function () {
      var b = this;
      b.disabled = true;
      b.textContent = '로그인 창을 여는 중...';
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      // 휴대폰 브라우저에서는 팝업이 막히는 경우가 많아 리디렉션 방식으로 로그인합니다 (잠깐 화면이 바뀌었다 돌아옵니다)
      auth.signInWithRedirect(provider).catch(function (e) {
        signinCard((e && e.code) || String(e));
      });
    });
  }

  function wrongAccount(email) {
    view.innerHTML = '<div class="card"><div style="font-size:44px;line-height:1">🙅</div>' +
      '<h2>이 계정은 관리자가 아니에요</h2>' +
      '<p><b>' + esc(email) + '</b> 계정으로 로그인되어 있어요.<br>' +
      '기기 관리는 <b>' + esc(ADMIN) + '</b> 계정만 할 수 있어요.</p>' +
      '<button class="btn ghost" id="out">다른 계정으로 로그인</button></div>';
    document.getElementById('out').addEventListener('click', function () {
      loading('로그아웃하는 중');
      auth.signOut().then(function () { signinCard(''); });
    });
  }

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
    if (out) out.addEventListener('click', function () { loading('로그아웃하는 중'); auth.signOut().then(function () { signinCard(''); }); });

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

  function watch() {    if (unsub) { try { unsub(); } catch (e) {} }
    unsub = db.collection('devices').orderBy('createdAt', 'desc').onSnapshot(function (snap) {
      var docs = [];
      snap.forEach(function (d) { var o = d.data(); o.id = d.id; docs.push(o); });
      render(auth.currentUser, docs);
    }, function (err) {
      view.innerHTML = '<div class="card"><h2>목록을 불러오지 못했어요</h2><p>' +
        esc((err && err.code) || String(err)) + '</p><button class="btn" id="re">다시 시도</button></div>';
      document.getElementById('re').addEventListener('click', function () { loading('다시 불러오는 중'); watch(); });
    });
  }

  // 검수용: 로그인 없이 목록 화면 모양을 확인할 때만 씀 (권한 없는 상태에서는 실제 데이터 접근은 규칙이 막음)
  window.__ynhAdminRender = render;

  function onUser(user) {
    if (!user) { signinCard(''); return; }
    if (String(user.email || '').toLowerCase() !== ADMIN) { wrongAccount(user.email || '알 수 없는 계정'); return; }
    loading('기기 목록을 불러오는 중');
    if (!db) db = firebase.firestore();
    watch();
  }

  loading('관리자 화면을 준비하는 중');
  Promise.all([
    loadScript(ROOT + 'fb-config.js'),
    loadScript(ROOT + 'sdk/firebase-app-compat.js')
  ]).then(function () {
    return loadScript(ROOT + 'sdk/firebase-auth-compat.js');
  }).then(function () {
    return loadScript(ROOT + 'sdk/firebase-firestore-compat.js');
  }).then(function () {
    if (!firebase.apps.length) firebase.initializeApp(window.YNH_FIREBASE_CONFIG);
    auth = firebase.auth();
    auth.getRedirectResult().catch(function (e) {
      var c = (e && e.code) || String(e);
      setTimeout(function () {
        var v = document.getElementById('view');
        if (v && v.querySelector('#go')) signinCard('로그인을 마무리하지 못했어요 (' + c + ')');
      }, 300);
    });
    auth.onAuthStateChanged(function (user) { onUser(user); });
  }).catch(function (e) {
    view.innerHTML = '<div class="card"><h2>화면을 열지 못했어요</h2><p>' + esc((e && e.message) || e) + '</p></div>';
  });
})();
