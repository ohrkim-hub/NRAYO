const express = require('express');
const { nanoid } = require('nanoid');
const repo = require('../data/repo');

const router = express.Router();

// POST /meets/create
router.post('/create', async (req, res) => {
  try {
    const meetId = nanoid();
    const now = new Date().toISOString();
    const meet = { id: meetId, ...req.body, status: 'OPEN', createdAt: now };
    await repo.createMeet(meetId, meet);
    await repo.addMeetParticipant(meetId, { userId: req.body.hostUserId, joinedAt: now, status: 'CONFIRMED' });
    res.status(201).json({ meetId, meet });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /meets/:meetId/join
router.post('/:meetId/join', async (req, res) => {
  try {
    const { meetId } = req.params;
    const { userId } = req.body;
    const meet = await repo.getMeet(meetId);
    if (!meet) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });

    await repo.addMeetParticipant(meetId, { userId, joinedAt: new Date().toISOString(), status: 'CONFIRMED' });

    const user = await repo.getUser(userId);
    if (user) await repo.updateUser(userId, { meetJoined: (user.meetJoined || 0) + 1 });

    const participants = await repo.getMeetParticipants(meetId);
    res.status(201).json({ meetId, participants });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /meets/:meetId/cancel
router.post('/:meetId/cancel', async (req, res) => {
  try {
    const { meetId } = req.params;
    const { userId } = req.body;
    const meet = await repo.getMeet(meetId);
    if (!meet) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });

    const meetDate = new Date(meet.dateTime);
    const daysLeft = (meetDate - new Date()) / (1000 * 60 * 60 * 24);

    let penalty = 'NONE';
    if (daysLeft <= 0) penalty = 'SAME_DAY_STRONG';
    else if (daysLeft <= 1) penalty = 'LATE_CANCEL_PARTIAL';
    else if (daysLeft <= 2) penalty = 'LIGHT_RECORD';

    await repo.updateMeetParticipant(meetId, userId, { status: 'CANCELLED', penalty });

    const user = await repo.getUser(userId);
    if (user && penalty !== 'NONE') {
      const update = { lateCancelCount: (user.lateCancelCount || 0) + 1 };
      if (!user.isAdmin) {
        if (penalty === 'LATE_CANCEL_PARTIAL' && user.stars >= 1) update.stars = user.stars - 1;
        if (penalty === 'SAME_DAY_STRONG' && user.stars >= 2) update.stars = user.stars - 2;
      }
      await repo.updateUser(userId, update);
    }

    res.json({ meetId, penalty });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /meets/:meetId
router.get('/:meetId', async (req, res) => {
  try {
    const meet = await repo.getMeet(req.params.meetId);
    if (!meet) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });
    const participants = await repo.getMeetParticipants(req.params.meetId);
    res.json({ meet, participants });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
