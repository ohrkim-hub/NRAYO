// 친구야 백엔드 - P0 스캐폴드
// 딸기지기(ttalgi-jigi)와 같은 스택: Node.js + Express + Firestore + Cloud Run
//
// 실행 전 준비:
// 1) Firebase 프로젝트 생성 + Firestore 활성화 (콘솔에서)
// 2) 로컬 개발 시: GOOGLE_APPLICATION_CREDENTIALS 환경변수에 서비스계정 키 json 경로 지정
//    (Cloud Run 배포 후에는 별도 키파일 없이 자동으로 서비스계정 인증됨)
// 3) npm install 후 npm start

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' })); // 딸기지기와 동일하게 요청크기 상한

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'CHANGE_ME_BEFORE_LAUNCH';

// ------------------------------------------------------------------
// 인증 미들웨어
// ------------------------------------------------------------------
// 구글 로그인은 Firebase Auth 토큰을 그대로 검증하면 됩니다 (딸기지기와 동일 방식).
// 카카오/네이버는 딸기지기의 socialAuthService.js에 이미 구현해두신
// "자체 Authorization Code 플로우 → 내부 커스텀 토큰 발급" 패턴을 그대로 옮겨오면
// 아래 verifyIdToken 이후 흐름과 동일하게 맞출 수 있습니다.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid; // 절대 nickname이 아니라 불변 uid를 식별자로 사용
    next();
  } catch (e) {
    return res.status(401).json({ error: '유효하지 않은 로그인 정보입니다.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (서버 타임존 기준, 추후 KST 고정 권장)
}

function clubIdFromYear(year) {
  return `club_${year}`;
}

// ------------------------------------------------------------------
// 프로필
// ------------------------------------------------------------------
app.get('/api/profile/me', requireAuth, async (req, res) => {
  const doc = await db.collection('profiles').doc(req.uid).get();
  if (!doc.exists) return res.json({ exists: false });
  res.json({ exists: true, profile: doc.data() });
});

app.post('/api/profile', requireAuth, async (req, res) => {
  const { nickname, birthYear, region1, region2, hobbies, bio, smoking, drinking } = req.body;
  if (!nickname || !birthYear || !region1) {
    return res.status(400).json({ error: '닉네임/출생연도/지역은 필수입니다.' });
  }
  const clubId = clubIdFromYear(birthYear);
  await db.collection('profiles').doc(req.uid).set({
    uid: req.uid,
    nickname,
    birthYear,
    clubId,
    region1,
    region2: region2 || '',
    hobbies: hobbies || [],
    bio: bio || '',
    smoking: smoking || 'none',
    drinking: drinking || 'none',
    photos: [],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // CLUB 문서도 없으면 생성 (멤버수 집계는 추후 배치로)
  await db.collection('clubs').doc(clubId).set({ clubId, birthYear }, { merge: true });

  res.json({ ok: true, clubId });
});

// 사진은 실제로는 Cloud Storage에 업로드 후 signed URL을 받아 photos 배열에 추가하는 방식 권장.
// 여기서는 업로드 완료 후 URL만 등록하는 엔드포인트만 스캐폴드로 둡니다.
app.post('/api/profile/photos', requireAuth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url이 필요합니다.' });
  await db.collection('profiles').doc(req.uid).update({
    photos: admin.firestore.FieldValue.arrayUnion({ url, status: 'pending', uploadedAt: Date.now() }),
  });
  res.json({ ok: true, status: 'pending', note: '관리자 검수 후 노출됩니다.' });
});

// ------------------------------------------------------------------
// 오늘의 상태
// ------------------------------------------------------------------
app.post('/api/today-status', requireAuth, async (req, res) => {
  const { moodTag } = req.body;
  if (!moodTag) return res.status(400).json({ error: 'moodTag가 필요합니다.' });
  const date = todayStr();
  await db.collection('todayStatus').doc(`${req.uid}_${date}`).set({
    uid: req.uid, date, moodTag,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  res.json({ ok: true });
});

// ------------------------------------------------------------------
// 추천 (규칙 기반 - AI/복잡한 알고리즘 배제, 기획서 10번 그대로)
// ------------------------------------------------------------------
app.get('/api/recommend', requireAuth, async (req, res) => {
  const meDoc = await db.collection('profiles').doc(req.uid).get();
  if (!meDoc.exists) return res.status(400).json({ error: '프로필을 먼저 등록해주세요.' });
  const me = meDoc.data();
  const date = todayStr();

  // 오늘 상태를 등록한 사람 전체를 가져와 서버에서 점수 계산 (초기 유저 규모에서는 이 방식으로 충분)
  const statusSnap = await db.collection('todayStatus').where('date', '==', date).get();
  const candidateUids = statusSnap.docs.map(d => d.data().uid).filter(uid => uid !== req.uid);
  if (candidateUids.length === 0) return res.json({ candidates: [] });

  const blocksSnap = await db.collection('blocks').where('blockerUid', '==', req.uid).get();
  const blockedSet = new Set(blocksSnap.docs.map(d => d.data().blockedUid));

  const results = [];
  for (const doc of statusSnap.docs) {
    const status = doc.data();
    if (status.uid === req.uid || blockedSet.has(status.uid)) continue;
    const pDoc = await db.collection('profiles').doc(status.uid).get();
    if (!pDoc.exists) continue;
    const p = pDoc.data();

    const yearDiff = Math.abs(p.birthYear - me.birthYear);
    if (yearDiff > 2) continue; // 기본은 동갑, 후보가 적을 때만 관리자가 완화폭을 늘릴 수 있게 상수화 권장

    let score = 0;
    if (yearDiff === 0) score += 5;
    else score += 5 - yearDiff; // 1~2살 차이는 감점만
    if (p.region2 && p.region2 === me.region2) score += 3;
    else if (p.region1 === me.region1) score += 1;
    if (status.moodTag === req.query.moodTag) score += 2;
    const overlapHobbies = (p.hobbies || []).filter(h => (me.hobbies || []).includes(h));
    score += overlapHobbies.length * 0.5;

    results.push({
      uid: p.uid, nickname: p.nickname, clubId: p.clubId,
      region1: p.region1, region2: p.region2, moodTag: status.moodTag, score,
    });
  }

  results.sort((a, b) => b.score - a.score);
  res.json({ candidates: results.slice(0, 30) });
});

// ------------------------------------------------------------------
// 친구 요청
// ------------------------------------------------------------------
app.post('/api/friend-requests', requireAuth, async (req, res) => {
  const { toUid } = req.body;
  if (!toUid) return res.status(400).json({ error: 'toUid가 필요합니다.' });
  const ref = await db.collection('friendRequests').add({
    fromUid: req.uid, toUid, status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  res.json({ ok: true, id: ref.id });
});

app.post('/api/friend-requests/:id/accept', requireAuth, async (req, res) => {
  const ref = db.collection('friendRequests').doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists || doc.data().toUid !== req.uid) {
    return res.status(403).json({ error: '처리 권한이 없습니다.' });
  }
  await ref.update({ status: 'accepted' });
  const { fromUid, toUid } = doc.data();
  const chatRef = await db.collection('chats').add({
    type: 'dm', memberUids: [fromUid, toUid],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('friendships').add({ uidA: fromUid, uidB: toUid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  res.json({ ok: true, chatId: chatRef.id });
});

// ------------------------------------------------------------------
// ROOM
// ------------------------------------------------------------------
app.post('/api/rooms', requireAuth, async (req, res) => {
  const { activityTag, region1, region2, startAt, capacity, vibeTag } = req.body;
  if (!activityTag || !region1 || !startAt) {
    return res.status(400).json({ error: '활동/지역/시간은 필수입니다.' });
  }
  const cap = Math.min(Math.max(capacity || 4, 2), 8); // 2~4 기본, 최대 8 (기획서 5번)
  const ref = await db.collection('rooms').add({
    hostUid: req.uid, activityTag, region1, region2: region2 || '', startAt,
    capacity: cap, vibeTag: vibeTag || 'Chill', status: 'open',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('roomParticipants').add({ roomId: ref.id, uid: req.uid, joinedAt: admin.firestore.FieldValue.serverTimestamp(), status: 'joined' });
  res.json({ ok: true, id: ref.id });
});

app.get('/api/rooms', requireAuth, async (req, res) => {
  const { region1 } = req.query;
  let q = db.collection('rooms').where('status', '==', 'open');
  if (region1) q = q.where('region1', '==', region1);
  const snap = await q.orderBy('startAt', 'asc').limit(30).get();
  res.json({ rooms: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});

app.post('/api/rooms/:id/join', requireAuth, async (req, res) => {
  const roomRef = db.collection('rooms').doc(req.params.id);
  await db.runTransaction(async (tx) => {
    const roomDoc = await tx.get(roomRef);
    if (!roomDoc.exists || roomDoc.data().status !== 'open') throw new Error('참가할 수 없는 방입니다.');
    const partSnap = await tx.get(db.collection('roomParticipants').where('roomId', '==', req.params.id).where('status', '==', 'joined'));
    if (partSnap.size >= roomDoc.data().capacity) {
      tx.update(roomRef, { status: 'full' });
      throw new Error('정원이 찼습니다.');
    }
    tx.set(db.collection('roomParticipants').doc(), { roomId: req.params.id, uid: req.uid, joinedAt: admin.firestore.FieldValue.serverTimestamp(), status: 'joined' });
    if (partSnap.size + 1 >= roomDoc.data().capacity) tx.update(roomRef, { status: 'full' });
  });
  res.json({ ok: true });
});

// ------------------------------------------------------------------
// 채팅 (실시간 리스닝은 프론트에서 Firestore SDK onSnapshot으로 직접 구독,
//        메시지 전송만 서버를 거쳐 신고/필터 로직을 태우는 구조)
// ------------------------------------------------------------------
app.get('/api/chats', requireAuth, async (req, res) => {
  const snap = await db.collection('chats').where('memberUids', 'array-contains', req.uid).get();
  res.json({ chats: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});

app.post('/api/chats/:id/messages', requireAuth, async (req, res) => {
  const { text, imageUrl } = req.body;
  const chatDoc = await db.collection('chats').doc(req.params.id).get();
  if (!chatDoc.exists || !chatDoc.data().memberUids.includes(req.uid)) {
    return res.status(403).json({ error: '채팅방 참여자가 아닙니다.' });
  }
  // TODO: 욕설/성희롱/금전요구 키워드 1차 필터, imageUrl은 SafeSearch 결과 확인 후 저장
  const ref = await db.collection('chats').doc(req.params.id).collection('messages').add({
    senderUid: req.uid, text: text || '', imageUrl: imageUrl || null,
    flagged: false, createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('chats').doc(req.params.id).update({ lastMessageAt: admin.firestore.FieldValue.serverTimestamp() });
  res.json({ ok: true, id: ref.id });
});

// ------------------------------------------------------------------
// 신고 / 차단
// ------------------------------------------------------------------
app.post('/api/reports', requireAuth, async (req, res) => {
  const { targetUid, targetType, reason, evidenceUrl } = req.body;
  if (!targetUid || !reason) return res.status(400).json({ error: 'targetUid/reason은 필수입니다.' });
  await db.collection('reports').add({
    reporterUid: req.uid, targetUid, targetType: targetType || 'profile', reason, evidenceUrl: evidenceUrl || null,
    status: 'open', createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  // 신고 접수 즉시 1차 상호 숨김 (기획 5번: 안전/신뢰 시스템 원칙)
  await db.collection('blocks').add({ blockerUid: req.uid, blockedUid: targetUid, createdAt: admin.firestore.FieldValue.serverTimestamp(), reason: 'auto_on_report' });
  res.json({ ok: true });
});

app.post('/api/blocks', requireAuth, async (req, res) => {
  const { blockedUid } = req.body;
  if (!blockedUid) return res.status(400).json({ error: 'blockedUid가 필요합니다.' });
  await db.collection('blocks').add({ blockerUid: req.uid, blockedUid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  res.json({ ok: true });
});

// ------------------------------------------------------------------
// 관리자 (딸기지기와 동일한 x-admin-secret 헤더 게이트 방식)
// ------------------------------------------------------------------
app.get('/api/admin/reports', requireAdmin, async (req, res) => {
  const snap = await db.collection('reports').where('status', '==', 'open').orderBy('createdAt', 'desc').limit(50).get();
  res.json({ reports: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
});

app.post('/api/admin/reports/:id/action', requireAdmin, async (req, res) => {
  const { action } = req.body; // 'actioned' | 'dismissed'
  await db.collection('reports').doc(req.params.id).update({ status: action });
  res.json({ ok: true });
});

app.get('/api/admin/photo-queue', requireAdmin, async (req, res) => {
  const snap = await db.collection('profiles').get();
  const pending = [];
  snap.forEach(d => {
    const p = d.data();
    (p.photos || []).forEach((photo, i) => {
      if (photo.status === 'pending') pending.push({ uid: p.uid, nickname: p.nickname, index: i, ...photo });
    });
  });
  res.json({ pending });
});

app.get('/healthz', (req, res) => res.json({ ok: true, service: 'chinguya-backend' }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`chinguya-backend listening on ${PORT}`));
