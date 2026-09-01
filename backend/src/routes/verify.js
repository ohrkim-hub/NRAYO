const express = require('express');
const repo = require('../data/repo');

const router = express.Router();

// 실제 SMS 발송 벤더(NHN Toast, 카카오 알림톡 등) 연동 전까지의 임시 구현.
// 인증번호를 문자로 보내는 대신 응답에 devCode로 함께 내려주고 있음 (실서비스 전 반드시 교체 필요).
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /verify/send  body: { phone }
router.post('/send', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !/^01[0-9]{8,9}$/.test(phone)) {
      return res.status(400).json({ error: '올바른 휴대폰 번호를 입력해주세요.' });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString(); // 3분 유효

    await repo.saveVerificationCode(phone, code, expiresAt);

    // TODO: 실제 SMS 벤더 연동 시 이 부분에서 문자 발송하고 devCode는 응답에서 제거할 것
    res.json({ message: '인증번호를 보냈어요.', devCode: code, expiresAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /verify/confirm  body: { phone, code }
router.post('/confirm', async (req, res) => {
  try {
    const { phone, code } = req.body;
    const record = await repo.getVerificationCode(phone);

    if (!record) return res.status(400).json({ error: '인증번호를 먼저 요청해주세요.' });
    if (new Date(record.expiresAt) < new Date()) {
      return res.status(400).json({ error: '인증번호가 만료됐어요. 다시 요청해주세요.' });
    }
    if (record.code !== code) {
      return res.status(400).json({ error: '인증번호가 올바르지 않아요.' });
    }

    await repo.markPhoneVerified(phone);
    res.json({ verified: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
