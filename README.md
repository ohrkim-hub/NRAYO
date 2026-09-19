# 너랑요 (NRAYO)

> "오늘, 누구랑?" — "너랑요."
> 아는 사람 말고, 내 사람.

지역 기반으로 새로운 사람을 소수 발견하고, 퀴즈와 TRIO(3인방)를 통해 서로를 알아가고,
실제 오프라인 만남까지 이어지는 친구 관계 형성 플랫폼입니다.

이전 코드네임: 친구야(chinguya) → MYEAR → WEURI → **NRAYO(너랑요)**
MYEAR 아이디어는 폐기되지 않고 앱 내부 "동갑 친구 찾기 모드"로 유지됩니다.

## 폴더 구조

```
NRAYO/
├── backend/          # Node.js + Express API (P0)
│   ├── src/
│   │   ├── index.js       # 서버 엔트리포인트
│   │   ├── routes/        # auth, discovery, quiz, friends, trio, meets, safety
│   │   └── data/store.js  # 로컬 JSON 저장소 (추후 Firestore로 교체)
│   ├── Dockerfile          # Cloud Run 배포용
│   └── package.json
└── frontend/
    └── public/        # 정적 PWA (Firebase Hosting / PWABuilder 대응)
        ├── index.html
        ├── css/style.css   # 선셋피치 테마
        ├── js/app.js
        ├── manifest.json
        └── sw.js
```

## 로컬 실행

Firestore를 실제로 사용하므로 로컬에서 돌리려면 아래 중 하나가 필요합니다.

**A) 실제 GCP 프로젝트에 연결해서 테스트**
```bash
gcloud auth application-default login
set GCLOUD_PROJECT=nrayo-3c940
cd backend
npm install
npm start
```

**B) Firestore 에뮬레이터 사용 (권장, 실제 데이터 안 건드림)**
```bash
firebase emulators:start --only firestore
# 다른 터미널에서
set FIRESTORE_EMULATOR_HOST=localhost:8080
set GCLOUD_PROJECT=nrayo-3c940
cd backend
npm install
npm start
```

프론트엔드는 정적 파일이므로 `frontend/public` 폴더를 그대로 브라우저로 열거나
VSCode Live Server 등으로 서빙하면 됩니다. `frontend/public/js/app.js` 상단의
`API_BASE`를 배포된 백엔드 주소로 교체하세요.

## 데이터 저장 방식

`backend/src/data/repo.js`를 통해 **Firestore**에 저장됩니다 (컬렉션: users, profiles,
quizAttempts, friendRequests, friendships, rooms(+members/messages 서브컬렉션),
meets(+participants 서브컬렉션), posts(+comments 서브컬렉션), suggestions(+comments 서브컬렉션),
reports, blocks). 별도 서비스 계정 키 없이 Cloud Run의
Application Default Credentials로 자동 인증됩니다. 퀴즈 문항은 콘텐츠성 데이터라
`backend/src/data/quizQuestions.js`에 코드로 관리합니다.

## 이번 스캐폴드(v0.1)에 포함된 것 (MVP P0 일부)

- 회원가입/온보딩 (휴대폰/출생연도/지역/닉네임/목적/관심사)
- Today's 2 추천 (Person First / Face Later - 사진 잠금)
- Quiz 기반 프로필 상태 머신 (LOCKED → DISCOVERING → REVEALED → FRIENDABLE → CONNECTED → DM_OPEN)
- 친구신청 / 수락
- TRIO(3인방) 생성, 채팅, 7일 KEEP 투표 API
- MEET(모임) 생성/참석/취소 (D-1 이후 패널티 로직)
- 신고/차단 (신고 즉시 자동 차단) + 관리자 Safety Dashboard API
- 인앱 재화(임시명 "별") 기본 구조
- **Firestore 연동 완료** (로컬 JSON 파일 저장소에서 전환, 서비스 계정 키 불필요)
- **온보딩 리디자인**: 아만다(Amanda) 등 국내 인증 기반 앱 참고, 단계별(당근마켓 스타일) 흐름으로 재구성
  - 약관동의 → 휴대폰 인증(발송/확인) → 성별 → 출생연도 → 지역 → 닉네임 → 프로필 사진 → 자기소개 → 목적 → 관심사
- **휴대폰 본인인증 (Firebase Phone Auth)**: 자체 제작 인증 시스템을 걷어내고 Firebase의 검증된 Phone Auth로 교체함. 실제 SMS가 발송되고, 서버는 Firebase가 발급한 ID 토큰을 `admin.auth().verifyIdToken()`으로 검증 (신뢰할 수 없는 자체 로직 없음)
- **프로필 사진 업로드**: `/auth/photo` — Firebase Storage에 저장. Cloud Run 서비스 계정에 Storage 쓰기 권한이 없으면 실패할 수 있음 (아래 권한 설정 참고)
- **관리자 페이지**: `frontend/public/admin/` — 회원 목록/정지, 신고 목록/처리. 기본 관리자 키는 `nrayo-admin-2026` (배포 시 Cloud Run 환경변수 `ADMIN_KEY`로 꼭 변경할 것). 관리자 키는 `localStorage`에 저장되어 브라우저를 껐다 켜도 다시 로그인 화면이 안 뜨고 자동으로 대시보드로 들어감(2026-09-19, 기존엔 `sessionStorage`라 매번 새로 로그인해야 했음). 같은 브라우저를 다른 사람과 같이 쓴다면 "로그아웃"을 눌러야 키가 지워짐
- **지인 피하기**: 가입 후 Today's 2 화면에서 연락처(전화번호)를 입력하면 SHA-256 해시로만 저장하고, 추천 목록에서 해당 번호는 제외 (`/contacts/upload`)
- **매너 평점**: ME 화면 친구 목록에서 1~5점 평가 가능, 평균 점수가 Today's 2 카드에 배지로 노출 (`/ratings/:userId`)
- **힌지 스타일 프롬프트 자기소개**: 자유 텍스트 대신 질문 2개를 골라 답하는 방식으로 프로필 구성, Today's 2 카드에 그대로 노출
- **목적 아이콘화**: 친구 목적(동갑친구/카페 등)을 이모지 뱃지로 표시
- **결제(모의) / 재화 소비처**: `/payments/packages`, `/payments/charge` — 실제 PG 연동 전까지 항상 성공 처리하는 모의 결제. 별로 Today's 2 추가 추천(⭐3) 받기 가능
- **관계 게임 실제 동작**: TRIO 방에서 **SAME 5**(공통 답변 찾기), **WHO'S THIS**(문제 출제·정답 맞히기),
  **🎨 그림 맞추기**(캐치마인드 스타일, 2026-09-19 신규) 게임이 실제로 동작. 그림 맞추기는 멤버 중 한 명이
  랜덤 단어(강아지/커피/무지개 등)를 받아 캔버스에 그리면, 다른 멤버는 2초마다 갱신되는 스냅샷을 보며
  정답을 추측 — 그리는 사람 화면에만 단어가 보이고(정답이 나오면 전원 공개), 스트로크가 끝날 때마다(pointerup)
  이미지를 서버에 올려서 "실시간에 가까운" 느낌을 구현. `POST /trio/:roomId/game/draw/start`,
  `POST /trio/:roomId/game/draw/update`, `GET /trio/:roomId/game/draw`, `POST /trio/:roomId/game/draw/guess`.
  단어 목록은 `backend/src/data/gamePrompts.js`의 `DRAW_WORDS`에서 자유롭게 수정 가능
- **말놓기 Unlock**: TRIO 멤버 전원이 동의하면 방 톤이 반말로 전환 (`/trio/:roomId/casual-vote`)
- **5CHAT 전환**: TRIO KEEP 투표에서 전원 YES가 나오면 7일 만료가 사라지고 영구 "5CHAT" 방으로 전환
- **실시간에 가까운 채팅**: TRIO 방 진입 시 3초마다 자동으로 새 메시지를 폴링 (새로고침 불필요)
- **재방문 자동 로그인**: 휴대폰/구글 로그인 모두 재방문 시 자동 로그인 (ME 화면에 로그아웃 버튼 추가)
- **동네생활 게시판 (2026-09-19)**: 매칭과 별개로 부담 없이 일상 글(텍스트+사진)을 올리는 지역 커뮤니티 탭.
  콜드스타트(초기 유저 부족) 시기에도 "썰렁하지 않은" 느낌을 주기 위한 기능. `/feed/posts`(작성/목록/삭제),
  `/feed/posts/:id/like`(좋아요 토글), `/feed/posts/:id/comments`(댓글). 초기엔 유저가 적어 지역별로 나누면
  더 썰렁해 보이므로 피드는 지역 필터 없이 전체 통합 노출(지역은 배지로만 표시), 유저가 늘면 지역 필터 추가 검토.
  신고 시 기존 `/safety/report`를 그대로 재사용(postId만 추가로 기록). 관리자 페이지 "동네생활" 탭에서
  게시글 목록 확인 및 삭제(모더레이션) 가능
- **같이가요(모집글) (신규, 2026-09-19)**: 동네생활 글 작성 시 "같이 갈래요?" 체크박스를 켜면 장소명을 적어
  '모집글'로 등록 가능. 모집글에는 "참여하기" 버튼이 붙어 눌러서 명단(참여자 닉네임)에 이름을 올리고,
  다시 누르면 취소. 작성자는 자동으로 첫 참여자가 됨. 자유 댓글이 아니라 구조화된 명단으로 관리해서
  "누가 오는지" 한눈에 파악 가능. `/feed/posts`(작성 시 `placeName` 옵션 전달), `/feed/posts/:id/join`(참여/취소 토글)
- **건의사항 탭 (신규, 2026-09-19)**: "유저가 함께 만들어가는 앱"을 표방하기 위해 기능 제안/버그 신고/디자인·UX/기타
  카테고리로 건의글을 남기는 탭. 다른 유저가 "저도 원해요"(공감)로 힘을 실어주거나 댓글로 의견을 더할 수 있음.
  관리자 페이지 "건의사항" 탭에서 상태를 신규 → 검토중 → 반영 예정 → 반영 완료 / 보류 로 직접 바꿔가며
  유저에게 "앱이 실제로 내 의견을 듣고 업데이트되고 있다"는 느낌을 줌. `/suggestions/*`(작성/목록/공감/댓글/삭제),
  `/admin/suggestions/:id/status`(관리자 상태 변경)
- **동네생활 시드 콘텐츠 등록 (2026-09-19)**: 관리자 페이지 "동네생활" 탭의 "🌱 시드 콘텐츠 등록" 버튼을 누르면
  `POST /admin/seed-posts`가 호출되어, "너랑요지기"라는 공식 큐레이터 계정(실제 유저 사칭 아님, 닉네임으로 운영자 계정임을 명시)
  이름으로 일상 글 17개 + 같이가요(모집글) 2개, 총 19개가 최근 12일에 걸쳐 작성된 것처럼 시간차를 두고 한 번에 등록됨.
  이미 등록한 적이 있으면 다시 눌러도 중복 등록되지 않음(재등록하려면 서버 쪽에서 `force:true` 옵션 필요).
  시드 문구는 `backend/src/data/seedPosts.js`에서 자유롭게 수정 가능
- **카카오톡 ID 교환 (유료, 신규 2026-09-19)**: 별 5개를 써서 친구에게 "카톡 교환 요청"을 보내고, 상대가
  수락해야만 서로의 카카오톡 ID가 보이는 구조(일방적으로 연락처가 공개되지 않도록 상호 동의 필수). 친구요청/수락과
  같은 패턴을 재사용함. ME 탭에서 본인 카톡 ID를 먼저 등록해두고(`POST /kakao/set-id`), 친구 목록에서 교환
  요청(`POST /kakao/request`, 별 5개 소모) → 상대가 ME 탭에서 수락/거절(`POST /kakao/:id/respond`). 수락된 건은
  상대가 나중에 카톡 ID를 바꾸거나 새로 등록해도 항상 최신 값으로 보여줌(`GET /kakao/exchanges/:userId`가 매번
  다시 조회). "프리미엄" 느낌을 주기 위해 골드 톤 배지/버튼(`--premium-gold` 등 신규 CSS 변수)을 새로 추가함
- **Today 탭 프리미엄 리브랜딩 (2026-09-19)**: 기존 "더 보기(⭐3 소모)" 버튼을 "⚡ 실시간 새 추천 받기"로 이름을
  바꾸고 골드 톤 프리미엄 버튼 스타일 적용(백엔드 로직은 동일, `/discovery/extra/:userId`). Today 화면 상단에
  "별을 쓰면 실시간 추천/카톡 교환이 가능하다"는 공지사항 배너 추가 — 재화(별) 소비처를 유저에게 자연스럽게 노출
- **알림 기능 (FCM 푸시, 신규 2026-09-19)**: 앱을 안 보고 있어도 브라우저 푸시 알림이 뜨도록 Firebase Cloud
  Messaging 연동. 카톡 교환 요청/수락, 같이가요 참여/정원 마감, 건의사항 상태 변경 4가지 이벤트에서 발송됨.
  로그인 시 알림 권한을 요청하고 등록 토큰을 `POST /auth/fcm-token`으로 저장(`backend/src/lib/push.js`가
  발송을 전담하며, 토큰이 없거나 발송 실패해도 절대 앱 흐름을 막지 않고 조용히 넘어감). **VAPID 키를 직접
  발급받아 설정해야 실제로 동작함 — 아래 "알림(FCM) 설정" 항목 참고. 설정 전까지는 알림 기능만 자동으로 꺼진
  상태로 나머지 기능은 정상 작동**
- **같이가요 정원 제한 + 모임방 채팅 (신규 2026-09-19)**: 모집글 작성 시 "최대 인원(2~30명)"을 선택적으로 지정
  가능. 정원이 차면 "참여하기" 버튼이 "인원 마감"으로 바뀌며 비활성화되고, 정원이 딱 찬 순간 참여자 전원에게
  푸시 알림이 감. 모집글마다 참여자끼리만 볼 수 있는 "💬 모임방 채팅"이 자동 생성되어(글 작성 시 작성자가
  첫 멤버), 참여/취소에 따라 멤버가 자동으로 추가·제거됨(`GET/POST /feed/posts/:id/room/messages`)
- **친구 초대(추천인 코드) 시스템 (신규 2026-09-20)**: 기존 데이팅앱들의 "하루 추천 2명 무료, 더 보려면 결제"
  구조는 이미 Today 탭에 구현돼 있었음(`/discovery/today`가 2명, `/discovery/extra`가 별 소모로 추가 2명).
  이번엔 여기에 "친구 초대하면 별을 더 받는" 바이럴 유도 장치를 추가함. 가입 시 6자리 초대 코드가 자동
  발급되고(ME 탭 "🎁 친구 초대" 카드에서 확인/복사), 이 코드로 친구가 가입하면 **초대한 사람은 별 5개**,
  **새로 가입한 친구는 가입 축하 별 3개를 추가로** 받음. 초대 링크(`?ref=코드`)로 들어오면 온보딩 마지막
  단계 입력란에 코드가 자동으로 채워짐. 어뷰징 방지는 별도로 만들지 않았는데, 가입 자체가 휴대폰 본인인증을
  통과해야만 가능해서(Firebase Phone Auth) 매번 새 번호가 필요하다는 진입장벽이 이미 있음. `POST /auth/signup`
  body에 `referralCode` 옵션 추가, `GET /auth/referral/:userId`(내 코드+초대한 친구 수 조회, 코드가 없으면
  이 시점에 지연 발급)

## 결제 시스템 관련 중요 안내

`/payments/charge`는 **실제 결제가 아닙니다.** 카드 정보 입력 없이 항상 성공 처리되는 모의(mock) 구현이에요.
실서비스 배포 전 반드시 토스페이먼츠, 카카오페이 등 실제 PG사 연동으로 교체해야 하며, 그 전까지는 앱스토어/플레이스토어에 결제 기능이 있는 상태로 절대 제출하면 안 됩니다 (심사 반려 및 정책 위반 소지).

- **관리자 무한 별**: 관리자 페이지에서 특정 계정을 "관리자 지정"하면 그 계정은 별이 소모되지 않음 (추가 추천, Meet 취소 패널티 등 모든 별 차감 로직에서 예외 처리). 화면에도 숫자 대신 "무한"으로 표시
- **구글 로그인 (신규)**: 인트로 화면에 "구글로 계속하기" 버튼 추가. Firebase Auth로 로그인 후 기존 가입 계정이면 온보딩 건너뛰고 바로 로그인, 신규면 구글 이메일/UID를 저장한 채로 온보딩 계속 진행

## 구글 로그인 설정 (배포 전 필수, 2가지)

1. **Firebase 콘솔 > Authentication > Sign-in method > 구글 → 사용 설정**

2. **웹 앱 SDK 설정값 가져오기**: Firebase 콘솔 > 프로젝트 설정(톱니바퀴) > 일반 탭 > "내 앱" 섹션에 웹 앱이 없으면 `</>` 아이콘으로 하나 추가 → 나오는 `firebaseConfig` 객체를 복사해서 `frontend/public/index.html` 상단의 자리표시자(`여기에_API_KEY_붙여넣기` 등)를 실제 값으로 교체

이 두 가지를 안 하면 "구글로 계속하기" 버튼을 눌렀을 때 에러가 납니다.

## 휴대폰 인증(Phone Auth) 설정 (배포 전 필수)

1. **Firebase 콘솔 > Authentication > Sign-in method > 전화 → 사용 설정**
2. (선택, 테스트 비용 절감용) 같은 화면 하단 **"테스트용 전화번호"**에 가짜 번호(예: `+821011112222`)와 고정 인증번호(예: `123456`)를 등록해두면, 실제 SMS 발송 없이 그 번호+코드로 항상 테스트 가능
3. 실제 번호로 테스트하면 진짜 문자가 발송되고 비용이 발생할 수 있음 (Firebase 무료 할당량 있음)

## Storage 권한 설정 (프로필 사진 업로드용)

Cloud Run 배포 시 사용되는 기본 서비스 계정에 Storage 쓰기 권한을 부여해야 합니다.
```bash
gcloud projects add-iam-policy-binding nrayo-3c940 \
  --member="serviceAccount:761047791567-compute@developer.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```
(서비스 계정 이메일은 `gcloud iam service-accounts list`로 확인 가능)

## 관리자 키 변경

```bash
gcloud run services update nrayo-backend --region asia-northeast3 \
  --set-env-vars ADMIN_KEY=원하는키로변경
```

## 위치 자동 감지 설정 (카카오 API 키 필요)

1. https://developers.kakao.com 접속 → 로그인 → **내 애플리케이션** → **애플리케이션 추가하기**
2. 만든 앱 클릭 → **앱 키** 탭 → **REST API 키** 복사
3. **플랫폼** 탭에서 Web 플랫폼 등록 시 사이트 도메인에 `https://nrayo-3c940.web.app` 추가
4. Cloud Run에 키 등록:
```bash
gcloud run services update nrayo-backend --region asia-northeast3 \
  --update-env-vars KAKAO_REST_API_KEY=발급받은키
```
설정 전까지는 "현재 위치로 찾기" 버튼을 눌러도 에러 메시지만 뜨고, 나머지 기능은 정상 작동합니다.

## 알림(FCM) 설정 (배포 전 필수, 안 하면 알림 기능만 조용히 비활성)

1. **Firebase 콘솔 > 프로젝트 설정(톱니바퀴) > 클라우드 메시징** 탭으로 이동
2. **웹 구성 > 웹 푸시 인증서**에서 "키 쌍 생성" 클릭 → 생성된 키(VAPID 키, `B`로 시작하는 긴 문자열) 복사
3. `frontend/public/index.html`에서 `const FCM_VAPID_KEY = "";` 부분을 찾아 따옴표 안에 붙여넣기
4. 배포 후 브라우저에서 로그인하면 알림 권한 요청 팝업이 뜨고, 허용하면 그때부터 푸시 알림을 받음
   (거부하거나 이 설정을 안 해도 앱의 다른 기능에는 전혀 영향 없음 — 알림만 안 뜰 뿐)

## 다음 단계 (P1 이후)

- D-3 Pre-Meet Quiz, WHO'S THIS/MBTI Guess/SAME 5 관계 게임 실제 콘텐츠화
- 5CHAT, 말놓기 Unlock, 참석 보증금 정산 로직
- **실제 SMS 벤더 연동** (지금은 devCode 임시 방식, 절대 실서비스에 그대로 배포하면 안 됨)
- Firestore 보안 규칙 작성 (현재 테스트 모드 → 프로덕션 모드 전환 필요)
- 관리자 로그인을 키 하나로 공유하는 방식 → 개별 관리자 계정/권한 체계로 고도화
- 상표 출원 전 최종 검색 필요: 너랑요 / NRAYO / NRY 등 (기획서 58번 참고)
- 동네생활: 유저 늘면 지역 필터/카테고리(질문/맛집추천/일상 등) 추가 검토
- 같이가요(모집글): 모집 마감(날짜/시간) 설정 검토 (참여 인원 상한 + 참여 알림 + 모임방 채팅은 2026-09-19에 구현 완료)
- 건의사항: 인기순 정렬(공감 많은 순), 중복/유사 건의 병합 UI 검토 (상태 변경 알림은 2026-09-19에 구현 완료)
- 카카오톡 ID 교환: 교환 완료 후 매너 평가 유도 검토 (요청/수락 알림은 2026-09-19에 구현 완료)
- 밸런스/취향 퀴즈: 그림 맞추기에 이어 TRIO 관계게임 네 번째 후보로 논의됨(구현 전, 다음 라운드 후보)
- 그림 맞추기: 그리는 시간 제한(타이머), 캔버스 색상/굵기 선택, 라운드 자동 순환(현재는 아무나 수동으로 "새로 시작") 검토
- **타이틀/MBTI 검사 (아이디어, 2026-09-19)**: 간단한 심리테스트로 "다정한 곰돌이형" 같은 성격 "타이틀"을 뽑아
  프로필에 배지로 노출하는 기능 제안. 재미 요소 + 프로필 완성도를 동시에 높일 수 있어 다음 라운드 후보로 유력
  (구현 전, 콘텐츠 설계 필요 - 질문 문항/타이틀 종류부터 확정해야 함)
- **지역 매칭 단위 재검토 (2026-09-20)**: 현재 Today 추천은 온보딩 때 적은 `region` 텍스트(예: "불당동")가
  완전히 똑같은 사람끼리만 묶임(`repo.js`의 `listUsersByRegionExcept`). 천안처럼 작은 도시에선 자연스럽게
  작동하지만, 서울 같은 대도시로 확장할 경우 동 단위로 너무 잘게 쪼개져서 매칭 풀이 오히려 희박해지는 역설이
  생김. 서울 진출을 실제로 검토하게 되면 "구" 단위로 묶거나(간단), 이미 있는 `/geocode/reverse` 위경도를
  저장해서 반경 기반 매칭으로 바꾸는(정교하지만 개발 품 더 필요) 작업이 선행돼야 함
- Firestore 좋아요 카운트 핫스팟 대응: 시드 글 등이 갑자기 많이 좋아요를 받을 경우를 대비해 카운트 샤딩 검토(현재 규모에서는 문제없음)
