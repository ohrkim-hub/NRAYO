const express = require('express');
const repo = require('../data/repo');
const { hashPhone } = require('./contacts');

const router = express.Router();

// GET /discovery/today/:userId
router.get('/today/:userId', async (req, res) => {
  try {
    const me = await repo.getUser(req.params.userId);
    if (!me) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const myContactHashes = new Set(await repo.getContactHashes(me.id));

    const rawCandidates = await repo.listUsersByRegionExcept(me.region, me.id, 6);
    const filtered = rawCandidates.filter(u => !myContactHashes.has(hashPhone(u.phone))).slice(0, 2);

    const candidates = [];
    for (const u of filtered) {
      const profile = (await repo.getProfile(u.id)) || {};
      candidates.push({
        userId: u.id,
        nickname: u.nickname,
        birthYear: u.birthYear,
        region: u.region,
        interests: profile.interests || [],
        purpose: profile.purpose || [],
        prompts: profile.prompts || [],
        mannerScore: u.mannerScore || null,
        mannerRatingCount: u.mannerRatingCount || 0,
        photoUrl: profile.state && profile.state !== 'LOCKED' && profile.state !== 'DISCOVERING'
          ? profile.photoUrl
          : null,
        profileState: profile.state || 'LOCKED'
      });
    }

    res.json({ date: new Date().toISOString().slice(0, 10), candidates });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

const EXTRA_CANDIDATE_COST = 3;

// POST /discovery/extra/:userId - 별을 소모해서 오늘 추천 2명 더 받기
router.post('/extra/:userId', async (req, res) => {
  try {
    const me = await repo.getUser(req.params.userId);
    if (!me) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    if (!me.isAdmin && (me.stars || 0) < EXTRA_CANDIDATE_COST) {
      return res.status(400).json({ error: `별이 부족해요. (필요: ${EXTRA_CANDIDATE_COST}개)` });
    }

    const myContactHashes = new Set(await repo.getContactHashes(me.id));
    const rawCandidates = await repo.listUsersByRegionExcept(me.region, me.id, 10);
    const filtered = rawCandidates.filter(u => !myContactHashes.has(hashPhone(u.phone))).slice(0, 2);

    const candidates = [];
    for (const u of filtered) {
      const profile = (await repo.getProfile(u.id)) || {};
      candidates.push({
        userId: u.id, nickname: u.nickname, birthYear: u.birthYear, region: u.region,
        interests: profile.interests || [], purpose: profile.purpose || [], prompts: profile.prompts || [],
        mannerScore: u.mannerScore || null, mannerRatingCount: u.mannerRatingCount || 0,
        photoUrl: (profile.state && profile.state !== 'LOCKED' && profile.state !== 'DISCOVERING') ? profile.photoUrl : null,
        profileState: profile.state || 'LOCKED'
      });
    }

    const newStars = me.isAdmin ? me.stars : await repo.creditStars(me.id, -EXTRA_CANDIDATE_COST);
    res.json({ candidates, stars: me.isAdmin ? '무한' : newStars, isAdmin: !!me.isAdmin });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
