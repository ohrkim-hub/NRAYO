const express = require('express');
const { nanoid } = require('nanoid');
const repo = require('../data/repo');

const router = express.Router();

// 실제 PG(토스페이먼츠 등) 연동 전 임시 목업 결제.
// 항상 결제 성공으로 처리하며, 실서비스 배포 전 반드시 실제 PG로 교체해야 함.
const STAR_PACKAGES = [
  { id: 'p10', stars: 10, price: 3900, label: '별 10개' },
  { id: 'p30', stars: 33, price: 9900, label: '별 33개 (+3 보너스)' },
  { id: 'p100', stars: 115, price: 29900, label: '별 115개 (+15 보너스)' }
];

// GET /payments/packages
router.get('/packages', (req, res) => {
  res.json(STAR_PACKAGES);
});

// POST /payments/charge  body: { userId, packageId }
router.post('/charge', async (req, res) => {
  try {
    const { userId, packageId } = req.body;
    const pkg = STAR_PACKAGES.find(p => p.id === packageId);
    if (!pkg) return res.status(400).json({ error: '존재하지 않는 상품입니다.' });

    const user = await repo.getUser(userId);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const paymentId = nanoid();
    await repo.createPayment(paymentId, {
      id: paymentId, userId, packageId, stars: pkg.stars, price: pkg.price,
      status: 'SUCCESS', mock: true, createdAt: new Date().toISOString()
    });

    const newStars = await repo.creditStars(userId, pkg.stars);
    res.json({ paymentId, stars: newStars, message: `${pkg.label} 충전 완료 (모의 결제)` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
