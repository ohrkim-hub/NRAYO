const express = require('express');
const { nanoid } = require('nanoid');
const { loadDB, saveDB } = require('../data/store');

const router = express.Router();

// POST /trio/create  body: { creatorUserId, memberUserIds: [] }
// 기획서 13~15. TRIO는 기본 3명, 7일 방, 관계 게임 지원
router.post('/create', (req, res) => {
  const { creatorUserId, memberUserIds = [] } = req.body;
  const db = loadDB();

  const allMembers = Array.from(new Set([creatorUserId, ...memberUserIds]));
  if (allMembers.length < 3) {
    return res.status(400).json({ error: 'TRIO는 최소 3명부터 시작합니다.' });
  }
  if (allMembers.length > 5) {
    return res.status(400).json({ error: 'TRIO는 최대 5명까지 성장 가능합니다.' });
  }

  const roomId = nanoid();
  const now = Date.now();
  db.rooms[roomId] = {
    id: roomId,
    creatorUserId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7일 방
    status: 'ACTIVE', // ACTIVE -> KEEP | ENDED
    tone: 'CASUAL_HONORIFIC', // 기본: 편한 존댓말
    casualUnlocked: false
  };
  db.roomMembers[roomId] = allMembers.map(uid => ({ userId: uid, joinedAt: new Date(now).toISOString() }));
  db.roomMessages[roomId] = [];

  saveDB(db);
  res.status(201).json({ roomId, members: allMembers, expiresAt: db.rooms[roomId].expiresAt });
});

// POST /trio/:roomId/message  body: { userId, text }
router.post('/:roomId/message', (req, res) => {
  const { roomId } = req.params;
  const { userId, text } = req.body;
  const db = loadDB();
  const room = db.rooms[roomId];
  if (!room) return res.status(404).json({ error: '방을 찾을 수 없습니다.' });

  const members = (db.roomMembers[roomId] || []).map(m => m.userId);
  if (!members.includes(userId)) return res.status(403).json({ error: '방 멤버가 아닙니다.' });

  const messageId = nanoid();
  const message = { id: messageId, userId, text, createdAt: new Date().toISOString() };
  db.roomMessages[roomId].push(message);
  saveDB(db);
  res.status(201).json(message);
});

// GET /trio/:roomId
router.get('/:roomId', (req, res) => {
  const db = loadDB();
  const room = db.rooms[req.params.roomId];
  if (!room) return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
  res.json({
    room,
    members: db.roomMembers[req.params.roomId] || [],
    messages: db.roomMessages[req.params.roomId] || []
  });
});

// POST /trio/:roomId/keep  body: { userId, vote: 'YES'|'NO' }
// 7일 후 "우리 계속할까요?" 투표 -> 전원 YES면 KEEP, 전원 NO면 ENDED, 일부 YES면 안내만
router.post('/:roomId/keep', (req, res) => {
  const { roomId } = req.params;
  const { userId, vote } = req.body;
  const db = loadDB();
  const room = db.rooms[roomId];
  if (!room) return res.status(404).json({ error: '방을 찾을 수 없습니다.' });

  if (!room.keepVotes) room.keepVotes = {};
  room.keepVotes[userId] = vote;

  const members = (db.roomMembers[roomId] || []).map(m => m.userId);
  const votes = members.map(uid => room.keepVotes[uid]);
  let result = 'PENDING';

  if (votes.every(v => v === 'YES')) {
    room.status = 'KEEP';
    result = 'KEEP';
  } else if (votes.every(v => v === 'NO')) {
    room.status = 'ENDED';
    result = 'ENDED';
  } else if (votes.filter(v => v === 'YES').length === 2 && votes.every(v => v)) {
    result = 'PARTIAL_TWO_YES'; // 2명만 YES -> 프론트에서 2명 친구 관계 제안 UI 노출
  }

  saveDB(db);
  res.json({ result, keepVotes: room.keepVotes });
});

module.exports = router;
