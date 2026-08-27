const express = require('express');
const { loadDB } = require('../data/store');

const router = express.Router();

// GET /discovery/today/:userId
// 기획서 7. TODAY'S 2 - 무료 사용자 하루 2명 추천 (Person First / Face Later)
router.get('/today/:userId', (req, res) => {
  const db = loadDB();
  const me = db.users[req.params.userId];
  if (!me) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

  const candidates = Object.values(db.users)
    .filter(u => u.id !== me.id && u.region === me.region)
    .slice(0, 2)
    .map(u => {
      const profile = db.profiles[u.id] || {};
      return {
        userId: u.id,
        nickname: u.nickname,
        birthYear: u.birthYear,
        region: u.region,
        interests: profile.interests || [],
        // Person First / Face Later: 사진은 REVEALED 이전엔 절대 내려주지 않음
        photoUrl: profile.state && profile.state !== 'LOCKED' && profile.state !== 'DISCOVERING'
          ? profile.photoUrl
          : null,
        profileState: profile.state || 'LOCKED'
      };
    });

  res.json({ date: new Date().toISOString().slice(0, 10), candidates });
});

module.exports = router;
