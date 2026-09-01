const express = require('express');
const repo = require('../data/repo');

const router = express.Router();

// 관리자 키는 Cloud Run 환경변수 ADMIN_KEY로 설정 (미설정 시 기본값 사용 - 배포 후 꼭 바꿀 것)
const ADMIN_KEY = process.env.ADMIN_KEY || 'nrayo-admin-2026';

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) return res.status(401).json({ error: '관리자 인증이 필요합니다.' });
  next();
}

// POST /admin/login  body: { key }
router.post('/login', (req, res) => {
  const { key } = req.body;
  if (key !== ADMIN_KEY) return res.status(401).json({ error: '관리자 키가 올바르지 않습니다.' });
  res.json({ ok: true });
});

// GET /admin/users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await repo.listAllUsers();
    res.json({ users });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /admin/users/:userId/ban  body: { banned: true|false }
router.post('/users/:userId/ban', requireAdmin, async (req, res) => {
  try {
    const { banned = true } = req.body;
    await repo.updateUser(req.params.userId, { banned });
    res.json({ userId: req.params.userId, banned });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /admin/users/:userId/set-admin  body: { isAdmin: true|false }
// 관리자로 지정된 계정은 별(재화)을 무한으로 사용 (소모되지 않음)
router.post('/users/:userId/set-admin', requireAdmin, async (req, res) => {
  try {
    const { isAdmin = true } = req.body;
    await repo.updateUser(req.params.userId, { isAdmin });
    res.json({ userId: req.params.userId, isAdmin });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /admin/reports
router.get('/reports', requireAdmin, async (req, res) => {
  try {
    const reports = await repo.listReports();
    res.json({ reports });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /admin/reports/:reportId/resolve  body: { status: 'REVIEWING'|'RESOLVED' }
router.post('/reports/:reportId/resolve', requireAdmin, async (req, res) => {
  try {
    const { status = 'RESOLVED' } = req.body;
    await repo.resolveReport(req.params.reportId, status);
    res.json({ reportId: req.params.reportId, status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
