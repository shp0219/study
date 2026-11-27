/* 유니혀니 놀이터 · Firebase 웹 구성 (공개 정보: 비밀 키 아님) */
window.YNH_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBTHRCtZ_3FTjCPiQrClm2k-TPmBw5lP6w",
  /* authDomain은 Google OAuth 클라이언트에 리디렉션 주소로 등록된 주소여야 합니다.
     현재 등록된 주소는 https://yunihyeoni-study.firebaseapp.com/__/auth/handler 라서
     firebaseapp.com을 그대로 씁니다(web.app으로 바꾸면 redirect_uri_mismatch 오류).
     최신 모바일 크롬의 쿠키·저장소 차단 문제는 관리자 화면이 로그인 창(팝업) 방식을
     먼저 쓰고, 막힐 때만 리디렉션으로 넘어가도록 해서 해결합니다. */
  authDomain: "yunihyeoni-study.firebaseapp.com",
  projectId: "yunihyeoni-study",
  storageBucket: "yunihyeoni-study.firebasestorage.app",
  messagingSenderId: "229177858018",
  appId: "1:229177858018:web:33f619e9ae0c448cafcbbb"
};
window.YNH_ADMIN_EMAIL = "shp0219@gmail.com";
