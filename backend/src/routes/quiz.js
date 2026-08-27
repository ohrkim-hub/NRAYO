const express = require('express');
const { nanoid } = require('nanoid');
const { loadDB, saveDB } = require('../data/store');

const router = express.Router();

const UNLOCK_THRESHOLD = 2; // 기획서 10. "퀴즈 2~3회 Unlock" -> 2회로 설정 (조정 가능)

// GET /quiz/questions
router.get('/questions', (req, res) => {
  const db = loadDB();
  res.json(Object.values(db.quizQuestions));
});

// POST /quiz/attempt
// body: { fromUserId, toUserId, questionId, choice }
// 정답 여부와 무관하게 "알아본 횟수"로 카운트 (오답이어도 관계는 막히지 않음)
router.post('/attempt', (req, res) => {
  const { fromUserId, toUserId, questionId, choice } = req.body;
  const db = loadDB();

  if (!db.users[fromUserId] || !db.users[toUserId]) {
    return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  }
  const question = db.quizQuestions[questionId];
  if (!question) return res.status(404).json({ error: '퀴즈 문항을 찾을 수 없습니다.' });

  const attemptId = nanoid();
  db.quizAttempts[attemptId] = {
    id: attemptId,
    fromUserId,
    toUserId,
    questionId,
    choice,
    createdAt: new Date().toISOString()
  };

  // toUserId에 대해 fromUserId가 시도한 퀴즈 총 횟수 계산
  const attemptCount = Object.values(db.quizAttempts)
    .filter(a => a.fromUserId === fromUserId && a.toUserId === toUserId).length;

  const profile = db.profiles[toUserId];
  let stateChanged = false;

  if (attemptCount === 1 && profile.state === 'LOCKED') {
    profile.state = 'DISCOVERING';
    stateChanged = true;
  }
  if (attemptCount >= UNLOCK_THRESHOLD && (profile.state === 'DISCOVERING' || profile.state === 'LOCKED')) {
    profile.state = 'REVEALED';
    stateChanged = true;
  }
  if (profile.state === 'REVEALED') {
    // 사진 공개 후 바로 친구신청 가능 상태로 전이
    profile.state = 'FRIENDABLE';
    stateChanged = true;
  }

  saveDB(db);
  res.json({
    attemptId,
    attemptCount,
    unlockThreshold: UNLOCK_THRESHOLD,
    profileState: profile.state,
    stateChanged
  });
});

module.exports = router;
