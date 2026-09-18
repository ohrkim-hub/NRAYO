const express = require('express');
const { nanoid } = require('nanoid');
const repo = require('../data/repo');
const { bucket } = require('../data/firestore');

const router = express.Router();

const MAX_TEXT_LENGTH = 500;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PLACE_NAME_LENGTH = 40;

async function uploadPostPhoto(postId, imageBase64) {
  if (!bucket) throw new Error('사진 업로드 기능이 아직 설정되지 않았어요. (Storage 초기화 실패)');
  const matches = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!matches) throw new Error('올바른 이미지 데이터가 아닙니다.');
  const contentType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.length > MAX_PHOTO_BYTES) throw new Error('이미지 용량은 5MB 이하로 올려주세요.');

  const ext = contentType.split('/')[1] || 'jpg';
  const file = bucket.file(`posts/${postId}.${ext}`);
  await file.save(buffer, { metadata: { contentType }, public: true });
  return `https://storage.googleapis.com/${bucket.name}/posts/${postId}.${ext}`;
}

// GET /feed/posts - 동네생활 최신 글 목록 (최대 50개)
router.get('/posts', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 50);
    const posts = await repo.listRecentPosts(limit);
    res.json({ posts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /feed/posts  body: { userId, text, photoBase64?, placeName? }
// placeName이 있으면 "같이 갈 사람 모집" 글(postType: recruit)로 만들어지고, 작성자는 자동으로 참여자 1번이 됨
router.post('/posts', async (req, res) => {
  try {
    const { userId, text, photoBase64 = null, placeName = null } = req.body;
    if (!userId || !text || !text.trim()) {
      return res.status(400).json({ error: '내용을 입력해주세요.' });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ error: `글은 최대 ${MAX_TEXT_LENGTH}자까지 쓸 수 있어요.` });
    }
    const trimmedPlace = placeName && placeName.trim() ? placeName.trim() : null;
    if (trimmedPlace && trimmedPlace.length > MAX_PLACE_NAME_LENGTH) {
      return res.status(400).json({ error: `장소명은 최대 ${MAX_PLACE_NAME_LENGTH}자까지예요.` });
    }
    const user = await repo.getUser(userId);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    if (user.banned) return res.status(403).json({ error: '정지된 계정입니다.' });

    const postId = nanoid();
    let photoUrl = null;
    if (photoBase64) {
      try { photoUrl = await uploadPostPhoto(postId, photoBase64); }
      catch (e) { return res.status(400).json({ error: e.message }); }
    }

    const now = new Date().toISOString();
    const post = {
      id: postId, userId, nickname: user.nickname, region: user.region || '',
      text: text.trim(), photoUrl, likedBy: [], commentCount: 0,
      postType: trimmedPlace ? 'recruit' : 'general',
      placeName: trimmedPlace,
      participants: trimmedPlace ? [{ userId, nickname: user.nickname, joinedAt: now }] : [],
      createdAt: now
    };
    await repo.createPost(postId, post);
    res.status(201).json({ post });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /feed/posts/:postId/join  body: { userId } - 모집글에 "참여하기" 토글
router.post('/posts/:postId/join', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId는 필수입니다.' });
    const post = await repo.getPost(req.params.postId);
    if (!post) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
    if (post.postType !== 'recruit') return res.status(400).json({ error: '모집글이 아니에요.' });
    const user = await repo.getUser(userId);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    if (user.banned) return res.status(403).json({ error: '정지된 계정입니다.' });

    const result = await repo.toggleJoin(req.params.postId, userId, user.nickname);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// DELETE /feed/posts/:postId  body: { userId }  (본인 글만 삭제 가능. 관리자 삭제는 /admin 쪽에서)
router.delete('/posts/:postId', async (req, res) => {
  try {
    const { userId } = req.body;
    const post = await repo.getPost(req.params.postId);
    if (!post) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
    if (post.userId !== userId) return res.status(403).json({ error: '본인 글만 삭제할 수 있어요.' });
    await repo.deletePost(req.params.postId);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /feed/posts/:postId/like  body: { userId }
router.post('/posts/:postId/like', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId는 필수입니다.' });
    const liked = await repo.toggleLike(req.params.postId, userId);
    if (liked === null) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
    res.json({ liked });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /feed/posts/:postId/comments
router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const comments = await repo.listComments(req.params.postId);
    res.json({ comments });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /feed/posts/:postId/comments  body: { userId, text }
router.post('/posts/:postId/comments', async (req, res) => {
  try {
    const { userId, text } = req.body;
    if (!userId || !text || !text.trim()) return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ error: `댓글은 최대 ${MAX_TEXT_LENGTH}자까지 쓸 수 있어요.` });
    }
    const post = await repo.getPost(req.params.postId);
    if (!post) return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
    const user = await repo.getUser(userId);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    if (user.banned) return res.status(403).json({ error: '정지된 계정입니다.' });

    const commentId = nanoid();
    const comment = {
      id: commentId, postId: req.params.postId, userId, nickname: user.nickname,
      text: text.trim(), createdAt: new Date().toISOString()
    };
    await repo.addComment(req.params.postId, commentId, comment);
    res.status(201).json({ comment });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
