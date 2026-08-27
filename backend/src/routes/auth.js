const express = require('express');
const { nanoid } = require('nanoid');
const { loadDB, saveDB } = require('../data/store');

const router = express.Router();

// 회원가입 (휴대폰 본인인증은 실제로는 외부 벤더 연동 필요 - 여기선 인증완료를 가정한 스텁)
// POST /auth/signup
// body: { phone, birthYear, region, nickname, interests: [], purpose: [] }
router.post('/signup', (req, res) => {
  const { phone, birthYear, region, nickname, interests = [], purpose = [] } = req.body;

  if (!phone || !birthYear || !region || !nickname) {
    return res.status(400).json({ error: 'phone, birthYear, region, nickname은 필수입니다.' });
  }
  if (nickname.length > 5) {
    return res.status(400).json({ error: '닉네임은 최대 5글자입니다.' });
  }

  const age = new Date().getFullYear() - Number(birthYear);
  if (age < 14) {
    return res.status(400).json({ error: '연령 요건을 충족하지 않습니다.' });
  }

  const db = loadDB();

  const existing = Object.values(db.users).find(u => u.phone === phone);
  if (existing) {
    return res.status(409).json({ error: '이미 가입된 휴대폰 번호입니다.', userId: existing.id });
  }

  const userId = nanoid();
  const now = new Date().toISOString();

  db.users[userId] = {
    id: userId,
    phone,
    birthYear: Number(birthYear),
    region,
    nickname,
    verified: true, // 본인인증 완료 가정
    createdAt: now,
    meetJoined: 0,
    meetCompleted: 0,
    lateCancelCount: 0,
    noShowCount: 0,
    attendanceRate: 100,
    penaltyLevel: 0,
    stars: 5 // 인앱 재화(임시명 "별") 초기 지급
  };

  db.profiles[userId] = {
    userId,
    interests,
    purpose,
    bio: '',
    photoUrl: null,
    state: 'LOCKED' // LOCKED -> DISCOVERING -> REVEALED -> FRIENDABLE -> CONNECTED -> DM_OPEN
  };

  saveDB(db);
  res.status(201).json({ userId, message: '회원가입 완료' });
});

// GET /auth/me/:userId
router.get('/me/:userId', (req, res) => {
  const db = loadDB();
  const user = db.users[req.params.userId];
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  const profile = db.profiles[req.params.userId];
  res.json({ user, profile });
});

module.exports = router;
