const express = require('express');
const { nanoid } = require('nanoid');
const { loadDB, saveDB } = require('../data/store');

const router = express.Router();

const REPORT_REASONS = [
  '성희롱', '스토킹', '사기/금전요구', '음란물', '사칭', '스팸', '불법광고', '미성년관련', '위험한오프라인행동', '기타'
];

// POST /safety/report  body: { fromUserId, targetUserId, reason, messageId?, roomId? }
router.post('/report', (req, res) => {
  const { fromUserId, targetUserId, reason, messageId = null, roomId = null } = req.body;
  const db = loadDB();

  if (!db.users[fromUserId] || !db.users[targetUserId]) {
    return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  }

  const reportId = nanoid();
  db.reports[reportId] = {
    id: reportId,
    fromUserId,
    targetUserId,
    reason: REPORT_REASONS.includes(reason) ? reason : '기타',
    messageId,
    roomId,
    status: 'NEW', // NEW -> REVIEWING -> RESOLVED
    createdAt: new Date().toISOString()
  };

  // 신고 즉시: 상호 메시지 숨김 + 친구신청 차단 + DM 차단 + 재매칭 제한 (블록으로 즉시 반영)
  const blockId = nanoid();
  db.blocks[blockId] = {
    id: blockId,
    fromUserId,
    targetUserId,
    reason: 'AUTO_ON_REPORT',
    createdAt: new Date().toISOString()
  };

  saveDB(db);
  res.status(201).json({ reportId, blockId, message: '신고 접수 완료. 상대와의 상호작용이 즉시 제한됩니다.' });
});

// POST /safety/block  body: { fromUserId, targetUserId }
router.post('/block', (req, res) => {
  const { fromUserId, targetUserId } = req.body;
  const db = loadDB();
  const blockId = nanoid();
  db.blocks[blockId] = { id: blockId, fromUserId, targetUserId, reason: 'MANUAL', createdAt: new Date().toISOString() };
  saveDB(db);
  res.status(201).json({ blockId });
});

// GET /safety/dashboard  (관리자용 요약)
router.get('/dashboard', (req, res) => {
  const db = loadDB();
  const reports = Object.values(db.reports);
  const summary = {
    total: reports.length,
    new: reports.filter(r => r.status === 'NEW').length,
    byReason: REPORT_REASONS.reduce((acc, r) => {
      acc[r] = reports.filter(rep => rep.reason === r).length;
      return acc;
    }, {})
  };
  res.json({ summary, reports });
});

module.exports = router;
