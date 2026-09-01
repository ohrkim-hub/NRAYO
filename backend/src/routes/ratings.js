const express = require('express');
const repo = require('../data/repo');

const router = express.Router();

// POST /ratings/:targetUserId  body: { raterUserId, score } (score 1~5)
router.post('/:targetUserId', async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const { raterUserId, score } = req.body;

    if (raterUserId === targetUserId) return res.status(400).json({ error: '본인은 평가할 수 없어요.' });
    const num = Number(score);
    if (!num || num < 1 || num > 5) return res.status(400).json({ error: '점수는 1~5 사이여야 해요.' });

    const target = await repo.getUser(targetUserId);
    if (!target) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const result = await repo.addMannerRating(targetUserId, raterUserId, num);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /ratings/:targetUserId
router.get('/:targetUserId', async (req, res) => {
  try {
    const result = await repo.getMannerScore(req.params.targetUserId);
    if (!result) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
