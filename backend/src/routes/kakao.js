// 카카오톡 ID 교환 (유료, 상호 동의 기반) - 결제하면 바로 상대 아이디를 주는 게 아니라,
// 별을 써서 "교환 요청"을 보내고 상대가 수락해야만 서로의 카카오톡 ID가 보이는 구조.
// 일방적으로 개인 연락처가 공개되는 걸 막기 위한 안전장치이자, 친구요청/수락과 같은 패턴을 재사용.
const express = require('express');
const { nanoid } = require('nanoid');
const repo = require('../data/repo');
const { sendPushToUser } = require('../lib/push');

const router = express.Router();

const KAKAO_EXCHANGE_COST = 5;
const MAX_KAKAO_ID_LENGTH = 30;

// POST /kakao/set-id  body: { userId, kakaoId }
// 본인 카카오톡 ID를 등록/수정 (무료). 상대가 교환을 수락하기 전까지는 공개되지 않음.
router.post('/set-id', async (req, res) => {
  try {
    const { userId, kakaoId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId는 필수입니다.' });
    const user = await repo.getUser(userId);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    if (user.banned) return res.status(403).json({ error: '정지된 계정입니다.' });

    const trimmed = (kakaoId || '').trim();
    if (!trimmed) return res.status(400).json({ error: '카카오톡 ID를 입력해주세요.' });
    if (trimmed.length > MAX_KAKAO_ID_LENGTH) {
      return res.status(400).json({ error: `카카오톡 ID는 ${MAX_KAKAO_ID_LENGTH}자 이하로 입력해주세요.` });
    }

    await repo.updateUser(userId, { kakaoId: trimmed });
    res.json({ kakaoId: trimmed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /kakao/exchanges/:userId - 내가 보내거나 받은 모든 교환 요청 목록(상태 포함)
// 수락된 건은 그 사이에 상대가 카톡 ID를 바꿨을 수도 있으니, 캐시가 아니라 최신 값을 매번 다시 조회해서 내려줌
router.get('/exchanges/:userId', async (req, res) => {
  try {
    const exchanges = await repo.listKakaoExchangesForUser(req.params.userId);
    const enriched = await Promise.all(exchanges.map(async (ex) => {
      if (ex.status !== 'ACCEPTED') return ex;
      const [fromUser, toUser] = await Promise.all([repo.getUser(ex.fromUserId), repo.getUser(ex.toUserId)]);
      return {
        ...ex,
        fromKakaoIdCache: (fromUser && fromUser.kakaoId) || null,
        toKakaoIdCache: (toUser && toUser.kakaoId) || null
      };
    }));
    res.json({ exchanges: enriched });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /kakao/request  body: { fromUserId, toUserId }
// 별 5개를 소모해서 상대에게 카카오톡 교환을 요청 (친구 사이에서만 가능)
router.post('/request', async (req, res) => {
  try {
    const { fromUserId, toUserId } = req.body;
    if (!fromUserId || !toUserId) return res.status(400).json({ error: 'fromUserId, toUserId는 필수입니다.' });
    if (fromUserId === toUserId) return res.status(400).json({ error: '본인에게는 요청할 수 없습니다.' });

    const fromUser = await repo.getUser(fromUserId);
    const toUser = await repo.getUser(toUserId);
    if (!fromUser || !toUser) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    if (fromUser.banned) return res.status(403).json({ error: '정지된 계정입니다.' });
    if (toUser.banned) return res.status(400).json({ error: '요청할 수 없는 상대예요.' });

    const existing = (await repo.listKakaoExchangesForUser(fromUserId))
      .find(ex => (ex.fromUserId === toUserId || ex.toUserId === toUserId) && ex.status !== 'DECLINED');
    if (existing) {
      return res.status(409).json({ error: '이미 진행 중이거나 완료된 교환 요청이 있어요.', exchange: existing });
    }

    if (!fromUser.isAdmin && (fromUser.stars || 0) < KAKAO_EXCHANGE_COST) {
      return res.status(400).json({ error: `별이 부족해요. (필요: ${KAKAO_EXCHANGE_COST}개)` });
    }

    const exchangeId = nanoid();
    const now = new Date().toISOString();
    const exchange = {
      id: exchangeId, fromUserId, toUserId,
      fromNickname: fromUser.nickname, toNickname: toUser.nickname,
      status: 'PENDING', createdAt: now
    };
    await repo.createKakaoExchange(exchangeId, exchange);

    const newStars = fromUser.isAdmin ? fromUser.stars : await repo.creditStars(fromUserId, -KAKAO_EXCHANGE_COST);

    sendPushToUser(toUserId, {
      title: '너랑요',
      body: `${fromUser.nickname}님이 카카오톡 교환을 요청했어요.`,
      data: { type: 'kakao-request', exchangeId }
    });

    res.status(201).json({ exchange, stars: fromUser.isAdmin ? '무한' : newStars });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /kakao/:exchangeId/respond  body: { userId, accept: true|false }
router.post('/:exchangeId/respond', async (req, res) => {
  try {
    const { userId, accept } = req.body;
    const exchange = await repo.getKakaoExchange(req.params.exchangeId);
    if (!exchange) return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
    if (exchange.toUserId !== userId) return res.status(403).json({ error: '이 요청에 응답할 권한이 없습니다.' });
    if (exchange.status !== 'PENDING') return res.status(400).json({ error: '이미 처리된 요청이에요.' });

    const status = accept ? 'ACCEPTED' : 'DECLINED';
    const update = { status, respondedAt: new Date().toISOString() };

    let fromKakaoId = null, toKakaoId = null;
    if (accept) {
      // 수락 시점의 카톡 ID를 요청 문서에 그대로 저장해둠(캐시) - 나중에 목록을 다시 불러올 때도
      // 매번 두 유저 문서를 추가 조회하지 않고 바로 보여줄 수 있게 하기 위함
      const fromUser = await repo.getUser(exchange.fromUserId);
      const toUser = await repo.getUser(exchange.toUserId);
      fromKakaoId = fromUser.kakaoId || null;
      toKakaoId = toUser.kakaoId || null;
      update.fromKakaoIdCache = fromKakaoId;
      update.toKakaoIdCache = toKakaoId;
    }
    await repo.updateKakaoExchange(exchange.id, update);

    if (accept) {
      sendPushToUser(exchange.fromUserId, {
        title: '너랑요',
        body: `${exchange.toNickname}님이 카카오톡 교환을 수락했어요!`,
        data: { type: 'kakao-accepted', exchangeId: exchange.id }
      });
    }

    res.json({ status, fromKakaoId, toKakaoId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
