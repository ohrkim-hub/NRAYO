const express = require('express');
const { nanoid } = require('nanoid');
const { loadDB, saveDB } = require('../data/store');

const router = express.Router();

// POST /meets/create
// body: { hostUserId, region, distanceKm, purpose, dateTime, capacity, ageCondition, tone, drinking, placeType }
router.post('/create', (req, res) => {
  const db = loadDB();
  const meetId = nanoid();
  const now = new Date().toISOString();

  db.meets = db.meets || {};
  db.meetParticipants = db.meetParticipants || {};
  db.meetAttendance = db.meetAttendance || {};

  db.meets[meetId] = { id: meetId, ...req.body, status: 'OPEN', createdAt: now };
  db.meetParticipants[meetId] = [{ userId: req.body.hostUserId, joinedAt: now, status: 'CONFIRMED' }];

  saveDB(db);
  res.status(201).json({ meetId, meet: db.meets[meetId] });
});

// POST /meets/:meetId/join  body: { userId }
router.post('/:meetId/join', (req, res) => {
  const { meetId } = req.params;
  const { userId } = req.body;
  const db = loadDB();
  const meet = (db.meets || {})[meetId];
  if (!meet) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });

  db.meetParticipants[meetId].push({ userId, joinedAt: new Date().toISOString(), status: 'CONFIRMED' });

  const user = db.users[userId];
  if (user) user.meetJoined = (user.meetJoined || 0) + 1;

  saveDB(db);
  res.status(201).json({ meetId, participants: db.meetParticipants[meetId] });
});

// POST /meets/:meetId/cancel  body: { userId }
// 기획서 19. 참석 취소/노쇼 정책 - D-3 이전 무료, D-1 이후 패널티
router.post('/:meetId/cancel', (req, res) => {
  const { meetId } = req.params;
  const { userId } = req.body;
  const db = loadDB();
  const meet = (db.meets || {})[meetId];
  if (!meet) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });

  const meetDate = new Date(meet.dateTime);
  const daysLeft = (meetDate - new Date()) / (1000 * 60 * 60 * 24);

  let penalty = 'NONE';
  if (daysLeft <= 0) penalty = 'SAME_DAY_STRONG';
  else if (daysLeft <= 1) penalty = 'LATE_CANCEL_PARTIAL';
  else if (daysLeft <= 2) penalty = 'LIGHT_RECORD';

  db.meetParticipants[meetId] = (db.meetParticipants[meetId] || []).map(p =>
    p.userId === userId ? { ...p, status: 'CANCELLED', penalty } : p
  );

  const user = db.users[userId];
  if (user && penalty !== 'NONE') {
    user.lateCancelCount = (user.lateCancelCount || 0) + 1;
    if (penalty === 'LATE_CANCEL_PARTIAL' && user.stars >= 1) user.stars -= 1;
    if (penalty === 'SAME_DAY_STRONG' && user.stars >= 2) user.stars -= 2;
  }

  saveDB(db);
  res.json({ meetId, penalty });
});

// GET /meets/:meetId
router.get('/:meetId', (req, res) => {
  const db = loadDB();
  const meet = (db.meets || {})[req.params.meetId];
  if (!meet) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });
  res.json({ meet, participants: db.meetParticipants[req.params.meetId] || [] });
});

module.exports = router;
