const express = require('express');
const { nanoid } = require('nanoid');
const repo = require('../data/repo');

const router = express.Router();

const REPORT_REASONS = [
  '성희롱', '스토킹', '사기/금전요구', '음란물', '사칭', '스팸', '불법광고', '미성년관련', '위험한오프라인행동', '기타'
];

// POST /safety/report
router.post('/report', async (req, res) => {
  try {
    const { fromUserId, targetUserId, reason, messageId = null, roomId = null } = req.body;

    const [fromUser, targetUser] = await Promise.all([repo.getUser(fromUserId), repo.getUser(targetUserId)]);
    if (!fromUser || !targetUser) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const reportId = nanoid();
    await repo.createReport(reportId, {
      id: reportId, fromUserId, targetUserId,
      reason: REPORT_REASONS.includes(reason) ? reason : '기타',
      messageId, roomId, status: 'NEW', createdAt: new Date().toISOString()
    });

    const blockId = nanoid();
    await repo.createBlock(blockId, {
      id: blockId, fromUserId, targetUserId, reason: 'AUTO_ON_REPORT', createdAt: new Date().toISOString()
    });

    res.status(201).json({ reportId, blockId, message: '신고 접수 완료. 상대와의 상호작용이 즉시 제한됩니다.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /safety/block
router.post('/block', async (req, res) => {
  try {
    const { fromUserId, targetUserId } = req.body;
    const blockId = nanoid();
    await repo.createBlock(blockId, {
      id: blockId, fromUserId, targetUserId, reason: 'MANUAL', createdAt: new Date().toISOString()
    });
    res.status(201).json({ blockId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /safety/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const reports = await repo.listReports();
    const summary = {
      total: reports.length,
      new: reports.filter(r => r.status === 'NEW').length,
      byReason: REPORT_REASONS.reduce((acc, r) => {
        acc[r] = reports.filter(rep => rep.reason === r).length;
        return acc;
      }, {})
    };
    res.json({ summary, reports });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
