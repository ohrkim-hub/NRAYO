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

```bash
cd backend
npm install
npm start
# http://localhost:8080 에서 API 기동
```

프론트엔드는 정적 파일이므로 `frontend/public` 폴더를 그대로 브라우저로 열거나
VSCode Live Server 등으로 서빙하면 됩니다. `frontend/public/js/app.js` 상단의
`API_BASE`를 배포된 백엔드 주소로 교체하세요.

## 이번 스캐폴드(v0.1)에 포함된 것 (MVP P0 일부)

- 회원가입/온보딩 (휴대폰/출생연도/지역/닉네임/목적/관심사)
- Today's 2 추천 (Person First / Face Later - 사진 잠금)
- Quiz 기반 프로필 상태 머신 (LOCKED → DISCOVERING → REVEALED → FRIENDABLE → CONNECTED → DM_OPEN)
- 친구신청 / 수락
- TRIO(3인방) 생성, 채팅, 7일 KEEP 투표 API
- MEET(모임) 생성/참석/취소 (D-1 이후 패널티 로직)
- 신고/차단 (신고 즉시 자동 차단) + 관리자 Safety Dashboard API
- 인앱 재화(임시명 "별") 기본 구조

## 다음 단계 (P1 이후)

- D-3 Pre-Meet Quiz, WHO'S THIS/MBTI Guess/SAME 5 관계 게임 실제 콘텐츠화
- 5CHAT, 말놓기 Unlock, 참석 보증금 정산 로직
- 실제 휴대폰 본인인증 벤더 연동
- Firestore 마이그레이션 (backend/src/data/store.js 인터페이스 유지)
- GitHub 저장소·Firebase 프로젝트·Cloud Run 서비스 실제 생성
- 상표 출원 전 최종 검색 필요: 너랑요 / NRAYO / NRY 등 (기획서 58번 참고)
