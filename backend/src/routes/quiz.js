const express = require('express');
const { nanoid } = require('nanoid');
const repo = require('../data/repo');
const { QUIZ_QUESTIONS } = require('../data/quizQuestions');

const router = express.Router();
const UNLOCK_THRESHOLD = 2;

// GET /quiz/questions
router.get('/questions', (req, res) => {
  res.json(Object.values(QUIZ_QUESTIONS));
});

// POST /quiz/attempt
router.post('/attempt', async (req, res) => {
  try {
    const { fromUserId, toUserId, questionId, choice } = req.body;

    const [fromUser, toUser] = await Promise.all([repo.getUser(fromUserId), repo.getUser(toUserId)]);
    if (!fromUser || !toUser) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const question = QUIZ_QUESTIONS[questionId];
    if (!question) return res.status(404).json({ error: '퀴즈 문항을 찾을 수 없습니다.' });

    const attemptId = nanoid();
    await repo.addQuizAttempt(attemptId, {
      id: attemptId, fromUserId, toUserId, questionId, choice, createdAt: new Date().toISOString()
    });

    const attemptCount = await repo.countAttempts(fromUserId, toUserId);
    const profile = await repo.getProfile(toUserId);
    let newState = profile.state;
    let stateChanged = false;

    if (attemptCount === 1 && newState === 'LOCKED') { newState = 'DISCOVERING'; stateChanged = true; }
    if (attemptCount >= UNLOCK_THRESHOLD && (newState === 'DISCOVERING' || newState === 'LOCKED')) {
      newState = 'REVEALED'; stateChanged = true;
    }
    if (newState === 'REVEALED') { newState = 'FRIENDABLE'; stateChanged = true; }

    if (stateChanged) await repo.updateProfile(toUserId, { state: newState });

    res.json({ attemptId, attemptCount, unlockThreshold: UNLOCK_THRESHOLD, profileState: newState, stateChanged });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
