const express = require('express');
const repo = require('../data/repo');
const { hashPhone } = require('./contacts');

const router = express.Router();

// 부스트(우선노출) 중인 후보를 먼저 보여주기 위한 정렬 헬퍼
function sortByBoost(candidatesWithProfile) {
  const now = Date.now();
  return candidatesWithProfile.sort((a, b) => {
    const aBoosted = a.profile.boostedUntil && new Date(a.profile.boostedUntil).getTime() > now;
    const bBoosted = b.profile.boostedUntil && new Date(b.profile.boostedUntil).getTime() > now;
    if (aBoosted && !bBoosted) return -1;
    if (!aBoosted && bBoosted) return 1;
    return 0;
  });
}

// GET /discovery/today/:userId
router.get('/today/:userId', async (req, res) => {
  try {
    const me = await repo.getUser(req.params.userId);
    if (!me) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const myContactHashes = new Set(await repo.getContactHashes(me.id));

    const rawCandidates = await repo.listUsersByRegionExcept(me.region, me.id, 10);
    const notContacts = rawCandidates.filter(u => !myContactHashes.has(hashPhone(u.phone)));

    const withProfile = [];
    for (const u of notContacts) {
      const profile = (await repo.getProfile(u.id)) || {};
      withProfile.push({ user: u, profile });
    }
    const sorted = sortByBoost(withProfile).slice(0, 2);

    const candidates = sorted.map(({ user: u, profile }) => ({
      userId: u.id,
      nickname: u.nickname,
      birthYear: u.birthYear,
      region: u.region,
      interests: profile.interests || [],
      purpose: profile.purpose || [],
      prompts: profile.prompts || [],
      mannerScore: u.mannerScore || null,
      mannerRatingCount: u.mannerRatingCount || 0,
      boosted: !!(profile.boostedUntil && new Date(profile.boostedUntil).getTime() > Date.now()),
      photoUrl: profile.state && profile.state !== 'LOCKED' && profile.state !== 'DISCOVERING'
        ? profile.photoUrl
        : null,
      profileState: profile.state || 'LOCKED'
    }));

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
    const notContacts = rawCandidates.filter(u => !myContactHashes.has(hashPhone(u.phone)));

    const withProfile = [];
    for (const u of notContacts) {
      const profile = (await repo.getProfile(u.id)) || {};
      withProfile.push({ user: u, profile });
    }
    const sorted = sortByBoost(withProfile).slice(0, 2);

    const candidates = sorted.map(({ user: u, profile }) => ({
      userId: u.id, nickname: u.nickname, birthYear: u.birthYear, region: u.region,
      interests: profile.interests || [], purpose: profile.purpose || [], prompts: profile.prompts || [],
      mannerScore: u.mannerScore || null, mannerRatingCount: u.mannerRatingCount || 0,
      boosted: !!(profile.boostedUntil && new Date(profile.boostedUntil).getTime() > Date.now()),
      photoUrl: (profile.state && profile.state !== 'LOCKED' && profile.state !== 'DISCOVERING') ? profile.photoUrl : null,
      profileState: profile.state || 'LOCKED'
    }));

    const newStars = me.isAdmin ? me.stars : await repo.creditStars(me.id, -EXTRA_CANDIDATE_COST);
    res.json({ candidates, stars: me.isAdmin ? '무한' : newStars, isAdmin: !!me.isAdmin });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

const BOOST_COST = 5;
const BOOST_HOURS = 24;

// POST /discovery/boost/:userId - 별을 소모해서 24시간 동안 프로필 우선노출
router.post('/boost/:userId', async (req, res) => {
  try {
    const me = await repo.getUser(req.params.userId);
    if (!me) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    if (!me.isAdmin && (me.stars || 0) < BOOST_COST) {
      return res.status(400).json({ error: `별이 부족해요. (필요: ${BOOST_COST}개)` });
    }

    const boostedUntil = new Date(Date.now() + BOOST_HOURS * 60 * 60 * 1000).toISOString();
    await repo.updateProfile(me.id, { boostedUntil });

    const newStars = me.isAdmin ? me.stars : await repo.creditStars(me.id, -BOOST_COST);
    res.json({ boostedUntil, stars: me.isAdmin ? '무한' : newStars, isAdmin: !!me.isAdmin });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

const ICEBREAKER_COST = 2;

// POST /discovery/icebreaker/:targetUserId  body: { userId }
// 별을 소모해서 상대 프로필 기반으로 AI가 대화 시작 질문 3개를 제안 (Claude Haiku 사용)
router.post('/icebreaker/:targetUserId', async (req, res) => {
  try {
    const { userId } = req.body;
    const { targetUserId } = req.params;

    const me = await repo.getUser(userId);
    const target = await repo.getUser(targetUserId);
    if (!me || !target) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    if (!me.isAdmin && (me.stars || 0) < ICEBREAKER_COST) {
      return res.status(400).json({ error: `별이 부족해요. (필요: ${ICEBREAKER_COST}개)` });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI 아이스브레이커 기능이 아직 설정되지 않았어요. (ANTHROPIC_API_KEY 미설정)' });
    }

    const targetProfile = (await repo.getProfile(targetUserId)) || {};
    const promptSummary = (targetProfile.prompts || []).map(p => `${p.q}: ${p.a}`).join(', ') || '없음';
    const interestsSummary = (targetProfile.interests || []).join(', ') || '없음';
    const purposeSummary = (targetProfile.purpose || []).join(', ') || '없음';

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: '너는 친구 소개 앱 "너랑요"의 대화 도우미야. 상대방 프로필 정보를 참고해서, 어색하지 않게 대화를 시작할 수 있는 짧고 자연스러운 질문 3개를 한국어로 제안해줘. 각 질문은 20자 내외로 짧게. 반드시 JSON 배열 형식으로만 응답해: ["질문1", "질문2", "질문3"]. 다른 설명 없이 배열만 출력.',
        messages: [{
          role: 'user',
          content: `상대방 정보 - 관심사: ${interestsSummary} / 목적: ${purposeSummary} / 자기소개: ${promptSummary}`
        }]
      })
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      console.error('Claude API 오류:', errBody);
      return res.status(502).json({ error: 'AI 응답 생성에 실패했어요. 잠시 후 다시 시도해주세요.' });
    }

    const aiData = await aiResponse.json();
    const text = aiData.content?.[0]?.text || '[]';
    let icebreakers;
    try {
      icebreakers = JSON.parse(text);
    } catch (parseErr) {
      icebreakers = [text];
    }

    const newStars = me.isAdmin ? me.stars : await repo.creditStars(me.id, -ICEBREAKER_COST);
    res.json({ icebreakers, stars: me.isAdmin ? '무한' : newStars, isAdmin: !!me.isAdmin });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
