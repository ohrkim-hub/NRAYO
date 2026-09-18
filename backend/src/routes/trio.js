const express = require('express');
const { nanoid } = require('nanoid');
const repo = require('../data/repo');
const { SAME5_PROMPTS, DRAW_WORDS } = require('../data/gamePrompts');

const router = express.Router();

// GET /trio/list/:userId - 내가 속한 모든 대화방(1:1 DM + TRIO) 목록
router.get('/list/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const rooms = await repo.listRoomsForUser(userId);

    const enriched = [];
    for (const room of rooms) {
      const members = await repo.getRoomMembers(room.id);
      const otherMembers = members.filter(m => m.userId !== userId);
      let title;
      if (room.isDM) {
        const otherUser = otherMembers[0] ? await repo.getUser(otherMembers[0].userId) : null;
        title = otherUser ? otherUser.nickname : '알 수 없음';
      } else {
        const names = await Promise.all(otherMembers.map(async m => {
          const u = await repo.getUser(m.userId);
          return u ? u.nickname : '';
        }));
        title = names.filter(Boolean).join(', ') || 'TRIO';
      }
      enriched.push({
        roomId: room.id,
        title,
        isDM: !!room.isDM,
        isFiveChat: !!room.isFiveChat,
        lastMessageText: room.lastMessageText || '',
        lastMessageAt: room.lastMessageAt || room.createdAt,
        memberCount: members.length
      });
    }
    res.json({ rooms: enriched });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

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
    await repo.updateRoom(roomId, { lastMessageAt: message.createdAt, lastMessageText: text });
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

// ---------------- 그림 맞추기 (캐치마인드 스타일) ----------------
const DRAW_IMAGE_MAX_LENGTH = 700000; // base64 문자열 기준 대략 500KB 정도 캡 (작은 캔버스라 여유있게)

// POST /trio/:roomId/game/draw/start  body: { userId }
// 랜덤 단어를 뽑아서 새 라운드를 시작 (그림/맞히기 기록은 초기화됨)
router.post('/:roomId/game/draw/start', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId는 필수입니다.' });

    const members = (await repo.getRoomMembers(roomId)).map(m => m.userId);
    if (!members.includes(userId)) return res.status(403).json({ error: '이 방의 멤버가 아니에요.' });

    const word = DRAW_WORDS[Math.floor(Math.random() * DRAW_WORDS.length)];
    await repo.clearDrawGuesses(roomId);
    await repo.saveDrawRound(roomId, {
      word, drawerUserId: userId, imageBase64: null,
      correctUserId: null, correctAt: null, startedAt: new Date().toISOString()
    });
    res.status(201).json({ word, drawerUserId: userId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /trio/:roomId/game/draw/update  body: { userId, imageBase64 }
// 그리는 사람이 스트로크를 끝낼 때마다(pointerup) 캔버스 스냅샷을 업로드 -> 다른 멤버는 폴링으로 확인
router.post('/:roomId/game/draw/update', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, imageBase64 } = req.body;
    const round = await repo.getDrawRound(roomId);
    if (!round) return res.status(404).json({ error: '진행 중인 게임이 없어요.' });
    if (round.drawerUserId !== userId) return res.status(403).json({ error: '그림을 그리는 사람만 업데이트할 수 있어요.' });
    if (round.correctUserId) return res.status(400).json({ error: '이미 정답이 나온 라운드예요.' });
    if (imageBase64 && imageBase64.length > DRAW_IMAGE_MAX_LENGTH) {
      return res.status(400).json({ error: '이미지 용량이 너무 커요.' });
    }
    await repo.updateDrawRound(roomId, { imageBase64: imageBase64 || null });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /trio/:roomId/game/draw?userId=xxx
// 정답이 나오기 전까지는 그리는 사람 본인에게만 단어(word)를 내려줌
router.get('/:roomId/game/draw', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.query;
    const round = await repo.getDrawRound(roomId);
    const guesses = await repo.listDrawGuesses(roomId);
    if (!round) return res.json({ round: null, guesses: [] });

    const revealWord = round.drawerUserId === userId || !!round.correctUserId;
    res.json({
      round: {
        drawerUserId: round.drawerUserId,
        imageBase64: round.imageBase64,
        correctUserId: round.correctUserId,
        startedAt: round.startedAt,
        word: revealWord ? round.word : null
      },
      guesses
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /trio/:roomId/game/draw/guess  body: { userId, nickname, guess }
router.post('/:roomId/game/draw/guess', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, nickname, guess } = req.body;
    const round = await repo.getDrawRound(roomId);
    if (!round) return res.status(404).json({ error: '진행 중인 게임이 없어요.' });
    if (round.drawerUserId === userId) return res.status(400).json({ error: '그리는 사람은 맞힐 수 없어요.' });
    if (round.correctUserId) return res.status(400).json({ error: '이미 정답이 나왔어요.' });
    if (!guess || !guess.trim()) return res.status(400).json({ error: '정답을 입력해주세요.' });

    const normalize = (s) => String(s).trim().toLowerCase().replace(/\s/g, '');
    const correct = normalize(guess) === normalize(round.word);
    const guessId = nanoid();
    await repo.addDrawGuess(roomId, guessId, {
      id: guessId, userId, nickname: nickname || '', guess: guess.trim(), correct,
      createdAt: new Date().toISOString()
    });
    if (correct) {
      await repo.updateDrawRound(roomId, { correctUserId: userId, correctAt: new Date().toISOString() });
    }
    res.json({ correct, word: correct ? round.word : undefined });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
