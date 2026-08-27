const express = require('express');
const { nanoid } = require('nanoid');
const { loadDB, saveDB } = require('../data/store');

const router = express.Router();

// POST /friends/request  body: { fromUserId, toUserId }
router.post('/request', (req, res) => {
  const { fromUserId, toUserId } = req.body;
  const db = loadDB();
  const toProfile = db.profiles[toUserId];

  if (!toProfile) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  if (toProfile.state !== 'FRIENDABLE' && toProfile.state !== 'CONNECTED') {
    return res.status(400).json({ error: '아직 친구신청이 가능한 상태가 아닙니다. (프로필 Reveal 필요)' });
  }

  const reqId = nanoid();
  db.friendRequests[reqId] = {
    id: reqId,
    fromUserId,
    toUserId,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };
  saveDB(db);
  res.status(201).json({ requestId: reqId });
});

// POST /friends/accept  body: { requestId }
router.post('/accept', (req, res) => {
  const { requestId } = req.body;
  const db = loadDB();
  const request = db.friendRequests[requestId];
  if (!request) return res.status(404).json({ error: '친구신청을 찾을 수 없습니다.' });

  request.status = 'ACCEPTED';

  const friendshipId = nanoid();
  db.friendships[friendshipId] = {
    id: friendshipId,
    userA: request.fromUserId,
    userB: request.toUserId,
    createdAt: new Date().toISOString(),
    casual: false // 말놓기 여부 (17. 호칭 시스템)
  };

  // 양측 프로필 상태를 CONNECTED -> DM_OPEN 으로 전이
  [request.fromUserId, request.toUserId].forEach(uid => {
    if (db.profiles[uid]) db.profiles[uid].state = 'DM_OPEN';
  });

  saveDB(db);
  res.json({ friendshipId, status: 'CONNECTED', dmOpen: true });
});

module.exports = router;
