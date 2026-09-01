const express = require('express');
const { nanoid } = require('nanoid');
const repo = require('../data/repo');
const { SAME5_PROMPTS } = require('../data/gamePrompts');

const router = express.Router();

// POST /trio/create
router.post('/create', async (req, res) => {
  try {
    const { creatorUserId, memberUserIds = [] } = req.body;
    const allMembers = Array.from(new Set([creatorUserId, ...memberUserIds]));
    if (allMembers.length < 3) return res.status(400).json({ error: 'TRIO는 최소 3명부터 시작합니다.' });
    if (allMembers.length > 5) return res.status(400).json({ error: 'TRIO는 최대 5명까지 성장 가능합니다.' });

    const roomId = nanoid();
    const now = Date.now();
    const room = {
      id: roomId, creatorUserId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'ACTIVE', tone: 'CASUAL_HONORIFIC', casualUnlocked: false
    };
    await repo.createRoom(roomId, room);
    await repo.addRoomMembers(roomId, allMembers.map(uid => ({ userId: uid, joinedAt: room.createdAt })));

    res.status(201).json({ roomId, members: allMembers, expiresAt: room.expiresAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /trio/:roomId/message
router.post('/:roomId/message', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, text } = req.body;
    const room = await repo.getRoom(roomId);
    if (!room) return res.status(404).json({ error: '방을 찾을 수 없습니다.' });

    const members = (await repo.getRoomMembers(roomId)).map(m => m.userId);
    if (!members.includes(userId)) return res.status(403).json({ error: '방 멤버가 아닙니다.' });

    const message = { id: nanoid(), userId, text, createdAt: new Date().toISOString() };
    await repo.addRoomMessage(roomId, message);
    res.status(201).json(message);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /trio/:roomId
router.get('/:roomId', async (req, res) => {
  try {
    const room = await repo.getRoom(req.params.roomId);
    if (!room) return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
    const [members, messages] = await Promise.all([
      repo.getRoomMembers(req.params.roomId),
      repo.getRoomMessages(req.params.roomId)
    ]);
    res.json({ room, members, messages });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /trio/:roomId/keep
router.post('/:roomId/keep', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, vote } = req.body;
    const room = await repo.getRoom(roomId);
    if (!room) return res.status(404).json({ error: '방을 찾을 수 없습니다.' });

    const keepVotes = { ...(room.keepVotes || {}), [userId]: vote };
    const members = (await repo.getRoomMembers(roomId)).map(m => m.userId);
    const votes = members.map(uid => keepVotes[uid]);
    let result = 'PENDING';
    let statusUpdate = {};

    if (votes.every(v => v === 'YES')) {
      result = 'KEEP';
      // KEEP 확정 시 7일 만료 방을 없애고 영구 5CHAT으로 전환
      statusUpdate.status = 'KEEP';
      statusUpdate.isFiveChat = true;
      statusUpdate.expiresAt = null;
    }
    else if (votes.every(v => v === 'NO')) { result = 'ENDED'; statusUpdate.status = 'ENDED'; }
    else if (votes.filter(v => v === 'YES').length === 2 && votes.every(v => v)) {
      result = 'PARTIAL_TWO_YES';
    }

    await repo.updateRoom(roomId, { keepVotes, ...statusUpdate });
    res.json({ result, keepVotes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /trio/:roomId/casual-vote  body: { userId, vote: 'YES'|'NO' }
// 말놓기(반말) 제안 투표 - 전원 YES면 말놓기 Unlock
router.post('/:roomId/casual-vote', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, vote } = req.body;
    const room = await repo.getRoom(roomId);
    if (!room) return res.status(404).json({ error: '방을 찾을 수 없습니다.' });

    const casualVotes = { ...(room.casualVotes || {}), [userId]: vote };
    const members = (await repo.getRoomMembers(roomId)).map(m => m.userId);
    const votes = members.map(uid => casualVotes[uid]);

    let unlocked = room.casualUnlocked || false;
    if (votes.every(v => v === 'YES')) unlocked = true;

    await repo.updateRoom(roomId, {
      casualVotes,
      casualUnlocked: unlocked,
      tone: unlocked ? 'FRIENDLY_CASUAL' : room.tone
    });
    res.json({ casualUnlocked: unlocked, casualVotes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ---------------- SAME 5 관계 게임 ----------------
// GET /trio/:roomId/game/same5/prompts
router.get('/:roomId/game/same5/prompts', (req, res) => {
  res.json(Object.values(SAME5_PROMPTS));
});

// POST /trio/:roomId/game/same5/answer  body: { userId, promptId, answer }
router.post('/:roomId/game/same5/answer', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, promptId, answer } = req.body;
    if (!SAME5_PROMPTS[promptId]) return res.status(404).json({ error: '존재하지 않는 질문이에요.' });

    await repo.saveGameAnswer(roomId, promptId, userId, answer.trim());
    const answers = await repo.getGameAnswers(roomId, promptId);
    const members = (await repo.getRoomMembers(roomId)).map(m => m.userId);

    const allAnswered = members.every(uid => answers.some(a => a.userId === uid));
    let matched = false;
    if (allAnswered) {
      const normalized = answers.map(a => a.answer.toLowerCase().replace(/\s/g, ''));
      matched = normalized.every(a => a === normalized[0]) && normalized.length === members.length;
    }

    res.json({ answers, allAnswered, matched, totalMembers: members.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ---------------- WHO'S THIS 관계 게임 ----------------
// POST /trio/:roomId/game/whosthis/set  body: { userId, hint, correctAnswer }
router.post('/:roomId/game/whosthis/set', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, hint, correctAnswer } = req.body;
    await repo.saveWhosThisQuestion(roomId, {
      ownerUserId: userId, hint, correctAnswer: String(correctAnswer).trim(),
      createdAt: new Date().toISOString()
    });
    res.status(201).json({ message: '문제가 등록됐어요.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /trio/:roomId/game/whosthis
router.get('/:roomId/game/whosthis', async (req, res) => {
  try {
    const question = await repo.getWhosThisQuestion(req.params.roomId);
    const guesses = await repo.getWhosThisGuesses(req.params.roomId);
    res.json({ question, guesses });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /trio/:roomId/game/whosthis/guess  body: { userId, guess }
router.post('/:roomId/game/whosthis/guess', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, guess } = req.body;
    const question = await repo.getWhosThisQuestion(roomId);
    if (!question) return res.status(404).json({ error: '등록된 문제가 없어요.' });

    await repo.saveWhosThisGuess(roomId, userId, String(guess).trim());
    const correct = String(guess).trim().toLowerCase() === question.correctAnswer.toLowerCase();
    res.json({ correct, correctAnswer: correct ? question.correctAnswer : undefined });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
