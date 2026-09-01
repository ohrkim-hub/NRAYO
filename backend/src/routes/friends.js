const express = require('express');
const { nanoid } = require('nanoid');
const repo = require('../data/repo');

const router = express.Router();

// POST /friends/request
router.post('/request', async (req, res) => {
  try {
    const { fromUserId, toUserId } = req.body;
    const toProfile = await repo.getProfile(toUserId);
    if (!toProfile) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    if (toProfile.state !== 'FRIENDABLE' && toProfile.state !== 'CONNECTED') {
      return res.status(400).json({ error: '아직 친구신청이 가능한 상태가 아닙니다. (프로필 Reveal 필요)' });
    }

    const reqId = nanoid();
    await repo.createFriendRequest(reqId, {
      id: reqId, fromUserId, toUserId, status: 'PENDING', createdAt: new Date().toISOString()
    });
    res.status(201).json({ requestId: reqId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /friends/accept
router.post('/accept', async (req, res) => {
  try {
    const { requestId } = req.body;
    const request = await repo.getFriendRequest(requestId);
    if (!request) return res.status(404).json({ error: '친구신청을 찾을 수 없습니다.' });

    await repo.updateFriendRequest(requestId, { status: 'ACCEPTED' });

    const friendshipId = nanoid();
    await repo.createFriendship(friendshipId, {
      id: friendshipId, userA: request.fromUserId, userB: request.toUserId,
      createdAt: new Date().toISOString(), casual: false
    });

    await Promise.all([
      repo.updateProfile(request.fromUserId, { state: 'DM_OPEN' }),
      repo.updateProfile(request.toUserId, { state: 'DM_OPEN' })
    ]);

    res.json({ friendshipId, status: 'CONNECTED', dmOpen: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
