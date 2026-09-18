const express = require('express');
const { nanoid } = require('nanoid');
const repo = require('../data/repo');

const router = express.Router();

const MAX_TEXT_LENGTH = 500;
const CATEGORIES = ['기능 제안', '버그 신고', '디자인/UX', '기타'];

// GET /suggestions - 건의사항 목록 (최신순 최대 100개)
router.get('/', async (req, res) => {
  try {
    const suggestions = await repo.listSuggestions(100);
    res.json({ suggestions, categories: CATEGORIES });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /suggestions  body: { userId, text, category }
router.post('/', async (req, res) => {
  try {
    const { userId, text, category } = req.body;
    if (!userId || !text || !text.trim()) {
      return res.status(400).json({ error: '내용을 입력해주세요.' });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ error: `글은 최대 ${MAX_TEXT_LENGTH}자까지 쓸 수 있어요.` });
    }
    const user = await repo.getUser(userId);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    if (user.banned) return res.status(403).json({ error: '정지된 계정입니다.' });

    const id = nanoid();
    const suggestion = {
      id, userId, nickname: user.nickname,
      category: CATEGORIES.includes(category) ? category : '기타',
      text: text.trim(), status: '신규', likedBy: [], commentCount: 0,
      createdAt: new Date().toISOString()
    };
    await repo.createSuggestion(id, suggestion);
    res.status(201).json({ suggestion });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// DELETE /suggestions/:id  body: { userId }  (본인 글만. 관리자 삭제는 /admin 쪽에서)
router.delete('/:id', async (req, res) => {
  try {
    const { userId } = req.body;
    const suggestion = await repo.getSuggestion(req.params.id);
    if (!suggestion) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
    if (suggestion.userId !== userId) return res.status(403).json({ error: '본인 글만 삭제할 수 있어요.' });
    await repo.deleteSuggestion(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /suggestions/:id/like  body: { userId } - "저도 원해요" 공감
router.post('/:id/like', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId는 필수입니다.' });
    const liked = await repo.toggleSuggestionLike(req.params.id, userId);
    if (liked === null) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
    res.json({ liked });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /suggestions/:id/comments
router.get('/:id/comments', async (req, res) => {
  try {
    const comments = await repo.listSuggestionComments(req.params.id);
    res.json({ comments });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /suggestions/:id/comments  body: { userId, text }
router.post('/:id/comments', async (req, res) => {
  try {
    const { userId, text } = req.body;
    if (!userId || !text || !text.trim()) return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ error: `댓글은 최대 ${MAX_TEXT_LENGTH}자까지 쓸 수 있어요.` });
    }
    const suggestion = await repo.getSuggestion(req.params.id);
    if (!suggestion) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
    const user = await repo.getUser(userId);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    if (user.banned) return res.status(403).json({ error: '정지된 계정입니다.' });

    const commentId = nanoid();
    const comment = {
      id: commentId, userId, nickname: user.nickname,
      text: text.trim(), createdAt: new Date().toISOString()
    };
    await repo.addSuggestionComment(req.params.id, commentId, comment);
    res.status(201).json({ comment });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
