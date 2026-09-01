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
meets(+participants 서브컬렉션), reports, blocks). 별도 서비스 계정 키 없이 Cloud Run의
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
- **휴대폰 본인인증 (임시)**: `/verify/send`, `/verify/confirm` — 실제 SMS 벤더 연동 전까지 인증번호를 응답에 `devCode`로 함께 내려줌 (화면에 토스트로 표시). **실서비스 배포 전 반드시 실제 SMS 벤더로 교체 필요**
- **프로필 사진 업로드**: `/auth/photo` — Firebase Storage에 저장. Cloud Run 서비스 계정에 Storage 쓰기 권한이 없으면 실패할 수 있음 (아래 권한 설정 참고)
- **관리자 페이지**: `frontend/public/admin/` — 회원 목록/정지, 신고 목록/처리. 기본 관리자 키는 `nrayo-admin-2026` (배포 시 Cloud Run 환경변수 `ADMIN_KEY`로 꼭 변경할 것)
- **지인 피하기**: 가입 후 Today's 2 화면에서 연락처(전화번호)를 입력하면 SHA-256 해시로만 저장하고, 추천 목록에서 해당 번호는 제외 (`/contacts/upload`)
- **매너 평점**: ME 화면 친구 목록에서 1~5점 평가 가능, 평균 점수가 Today's 2 카드에 배지로 노출 (`/ratings/:userId`)
- **힌지 스타일 프롬프트 자기소개**: 자유 텍스트 대신 질문 2개를 골라 답하는 방식으로 프로필 구성, Today's 2 카드에 그대로 노출
- **목적 아이콘화**: 친구 목적(동갑친구/카페 등)을 이모지 뱃지로 표시
- **결제(모의) / 재화 소비처**: `/payments/packages`, `/payments/charge` — 실제 PG 연동 전까지 항상 성공 처리하는 모의 결제. 별로 Today's 2 추가 추천(⭐3) 받기 가능
- **관계 게임 실제 동작**: TRIO 방에서 **SAME 5**(공통 답변 찾기), **WHO'S THIS**(문제 출제·정답 맞히기) 게임이 실제로 동작
- **말놓기 Unlock**: TRIO 멤버 전원이 동의하면 방 톤이 반말로 전환 (`/trio/:roomId/casual-vote`)
- **5CHAT 전환**: TRIO KEEP 투표에서 전원 YES가 나오면 7일 만료가 사라지고 영구 "5CHAT" 방으로 전환
- **실시간에 가까운 채팅**: TRIO 방 진입 시 3초마다 자동으로 새 메시지를 폴링 (새로고침 불필요)

## 결제 시스템 관련 중요 안내

`/payments/charge`는 **실제 결제가 아닙니다.** 카드 정보 입력 없이 항상 성공 처리되는 모의(mock) 구현이에요.
실서비스 배포 전 반드시 토스페이먼츠, 카카오페이 등 실제 PG사 연동으로 교체해야 하며, 그 전까지는 앱스토어/플레이스토어에 결제 기능이 있는 상태로 절대 제출하면 안 됩니다 (심사 반려 및 정책 위반 소지).

- **관리자 무한 별**: 관리자 페이지에서 특정 계정을 "관리자 지정"하면 그 계정은 별이 소모되지 않음 (추가 추천, Meet 취소 패널티 등 모든 별 차감 로직에서 예외 처리). 화면에도 숫자 대신 "무한"으로 표시
- **구글 로그인 (신규)**: 인트로 화면에 "구글로 계속하기" 버튼 추가. Firebase Auth로 로그인 후 기존 가입 계정이면 온보딩 건너뛰고 바로 로그인, 신규면 구글 이메일/UID를 저장한 채로 온보딩 계속 진행

## 구글 로그인 설정 (배포 전 필수, 2가지)

1. **Firebase 콘솔 > Authentication > Sign-in method > 구글 → 사용 설정**

2. **웹 앱 SDK 설정값 가져오기**: Firebase 콘솔 > 프로젝트 설정(톱니바퀴) > 일반 탭 > "내 앱" 섹션에 웹 앱이 없으면 `</>` 아이콘으로 하나 추가 → 나오는 `firebaseConfig` 객체를 복사해서 `frontend/public/index.html` 상단의 자리표시자(`여기에_API_KEY_붙여넣기` 등)를 실제 값으로 교체

이 두 가지를 안 하면 "구글로 계속하기" 버튼을 눌렀을 때 에러가 납니다.

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

## 다음 단계 (P1 이후)

- D-3 Pre-Meet Quiz, WHO'S THIS/MBTI Guess/SAME 5 관계 게임 실제 콘텐츠화
- 5CHAT, 말놓기 Unlock, 참석 보증금 정산 로직
- **실제 SMS 벤더 연동** (지금은 devCode 임시 방식, 절대 실서비스에 그대로 배포하면 안 됨)
- Firestore 보안 규칙 작성 (현재 테스트 모드 → 프로덕션 모드 전환 필요)
- 관리자 로그인을 키 하나로 공유하는 방식 → 개별 관리자 계정/권한 체계로 고도화
- 상표 출원 전 최종 검색 필요: 너랑요 / NRAYO / NRY 등 (기획서 58번 참고)
