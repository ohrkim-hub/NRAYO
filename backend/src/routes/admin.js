const express = require('express');
const { nanoid } = require('nanoid');
const repo = require('../data/repo');
const { SEED_POSTS } = require('../data/seedPosts');

const router = express.Router();
const SEED_SYSTEM_USER_ID = 'system-nrayojigi';

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

// GET /admin/posts - 동네생활 게시글 모더레이션용 목록 (최대 200개, 최신순)
router.get('/posts', requireAdmin, async (req, res) => {
  try {
    const posts = await repo.listRecentPosts(200);
    res.json({ posts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// DELETE /admin/posts/:postId - 신고/부적절한 게시글 관리자 강제 삭제
router.delete('/posts/:postId', requireAdmin, async (req, res) => {
  try {
    await repo.deletePost(req.params.postId);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /admin/seed-posts - 동네생활 콜드스타트용 시드 글 일괄 등록
// "너랑요지기"라는 공식 큐레이터 계정으로 등록됨(실제 유저를 사칭하지 않고 운영자 계정임을 닉네임으로 명시).
// 이미 시드를 등록한 적이 있으면 기본적으로 다시 등록하지 않음(body: { force: true }로 강제 재등록 가능).
router.post('/seed-posts', requireAdmin, async (req, res) => {
  try {
    const force = !!req.body.force;
    let systemUser = await repo.getUser(SEED_SYSTEM_USER_ID);

    if (systemUser && systemUser.seededAt && !force) {
      return res.json({
        seeded: false,
        already: true,
        message: `이미 ${systemUser.seededAt.slice(0, 10)}에 시드 콘텐츠를 등록했어요. 다시 등록하려면 force 옵션을 사용하세요.`
      });
    }

    const now = new Date();

    if (!systemUser) {
      systemUser = {
        id: SEED_SYSTEM_USER_ID, phone: null, birthYear: 2000, region: '천안',
        nickname: '너랑요지기', gender: null, googleUid: null, googleEmail: null,
        verified: true, createdAt: now.toISOString(), banned: false, isAdmin: true,
        meetJoined: 0, meetCompleted: 0, lateCancelCount: 0, noShowCount: 0,
        attendanceRate: 100, penaltyLevel: 0, stars: 5
      };
      await repo.createUser(SEED_SYSTEM_USER_ID, systemUser);
    }

    // 배열 0번이 가장 최근 글이 되도록, 뒤로 갈수록(과거로 갈수록) 시간 간격을 둠 (약 15시간씩)
    const createdIds = [];
    for (let i = 0; i < SEED_POSTS.length; i++) {
      const seed = SEED_POSTS[i];
      const postId = nanoid();
      const createdAt = new Date(now.getTime() - i * 15 * 60 * 60 * 1000).toISOString();
      const isRecruit = !!seed.placeName;
      const post = {
        id: postId, userId: SEED_SYSTEM_USER_ID, nickname: '너랑요지기', region: seed.region || '',
        text: seed.text, photoUrl: null, likedBy: [], commentCount: 0,
        postType: isRecruit ? 'recruit' : 'general',
        placeName: isRecruit ? seed.placeName : null,
        participants: isRecruit ? [{ userId: SEED_SYSTEM_USER_ID, nickname: '너랑요지기', joinedAt: createdAt }] : [],
        createdAt
      };
      await repo.createPost(postId, post);
      createdIds.push(postId);
    }

    await repo.updateUser(SEED_SYSTEM_USER_ID, { seededAt: now.toISOString() });

    res.json({ seeded: true, count: createdIds.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /admin/suggestions - 건의사항 모더레이션용 목록
router.get('/suggestions', requireAdmin, async (req, res) => {
  try {
    const suggestions = await repo.listSuggestions(200);
    res.json({ suggestions });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /admin/suggestions/:id/status  body: { status: '신규'|'검토중'|'반영 예정'|'반영 완료'|'보류' }
router.post('/suggestions/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status는 필수입니다.' });
    await repo.updateSuggestionStatus(req.params.id, status);
    res.json({ id: req.params.id, status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// DELETE /admin/suggestions/:id - 부적절한 건의글 강제 삭제
router.delete('/suggestions/:id', requireAdmin, async (req, res) => {
  try {
    await repo.deleteSuggestion(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
