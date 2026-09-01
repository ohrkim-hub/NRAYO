const express = require('express');
const crypto = require('crypto');
const repo = require('../data/repo');

const router = express.Router();

function hashPhone(phone) {
  return crypto.createHash('sha256').update(phone.replace(/[^0-9]/g, '')).digest('hex');
}

// POST /contacts/upload  body: { userId, phones: ['01012345678', ...] }
// 원본 번호는 저장하지 않고 해시값만 저장 (지인 피하기 매칭 필터링용)
router.post('/upload', async (req, res) => {
  try {
    const { userId, phones = [] } = req.body;
    const user = await repo.getUser(userId);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const hashedPhones = phones.map(hashPhone);
    await repo.saveContacts(userId, hashedPhones);
    res.json({ count: hashedPhones.length, message: '지인 피하기 설정이 저장됐어요.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
module.exports.hashPhone = hashPhone;
