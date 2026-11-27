# 유니혀니 놀이터 · 기기 승인 잠금 (Firebase)

아이들 놀이터(`/` 받아쓰기, `/blocks/`, `/piano/`, `/english/`, `/reading/`)는
**승인된 기기에서만** 열립니다. Firebase Hosting + Firestore + Authentication 으로 동작합니다.

## 주소
- 놀이터: https://yunihyeoni-study.web.app (기존 GitHub Pages `shp0219.github.io/study/`도 같은 게이트로 잠김)
- 관리자: https://yunihyeoni-study.web.app/admin/ — `shp0219@gmail.com` Google 계정만

## 동작
1. 각 페이지 머리의 `gate.js`가 `localStorage`의 기기 ID로 Firestore `devices/{deviceId}`를 확인합니다.
2. 문서가 없으면 🔒 "승인 대기 중" 화면에서 기기 이름을 받아 `status:'pending'`으로 만들고 6자리 확인 코드를 보여 줍니다.
3. 관리자 화면에서 **승인**을 누르면 그 기기에서는 새로고침 없이 잠금이 풀립니다(`onSnapshot`).
4. `blocked`면 🚫 화면만 보입니다.

## 보안 규칙 (`firestore.rules`)
- `get`만 공개(문서 ID를 아는 기기 자신), `list`는 관리자만.
- 새 문서는 `pending`으로만 생성 가능하고 `approved`로는 만들 수 없음.
- 상태 변경·삭제는 `shp0219@gmail.com`(이메일 인증됨)만.
- 나머지 경로는 모두 차단.

## 배포 방법 (node 없이)
`.`(저장소 루트)을 Firebase Hosting으로 올립니다. 작업 공간의 `work/fb/` 참고:
- `config/firebase-sa.json` : 서비스 계정 키(비공개, 저장소에 넣지 말 것)
- `work/fb/deploy_hosting.py` : 사이트 전체 배포
- `work/fb/deploy_rules.py` : `firestore.rules` 배포

## Family Link (아이들 폰)
승인 사이트에 다음 두 도메인을 추가해야 합니다.
- `yunihyeoni-study.web.app` (놀이터)
- `firestore.googleapis.com` (승인 확인)

Firebase SDK는 이 사이트의 `/sdk/`에서 직접 서빙하므로 `www.gstatic.com`은 필요 없습니다.

## 한계
- 게이트는 브라우저에서 도는 JavaScript 잠금입니다. 우연한 공유(주소를 다른 기기에서 여는 것)는 막지만,
  소스를 뜯어 고치는 사람을 완전히 막지는 못합니다. 소스는 `shp0219/study`(공개)에 있습니다.
- 승인 상태는 7일까지 오프라인 캐시로 열립니다(인터넷이 끊겨도 아이가 쓸 수 있게).
