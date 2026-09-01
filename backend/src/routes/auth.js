const express = require('express');
const { nanoid } = require('nanoid');
const repo = require('../data/repo');
const { bucket } = require('../data/firestore');

const router = express.Router();

const ADMIN_KEY = process.env.ADMIN_KEY || 'nrayo-admin-2026';

// POST /auth/admin-login  body: { key }
// 관리자 키만 입력하면 가입 절차 없이 바로 앱에 진입 (전용 관리자 테스트 계정 자동 생성/재사용, 무한 별)
router.post('/admin-login', async (req, res) => {
  try {
    const { key } = req.body;
    if (key !== ADMIN_KEY) return res.status(401).json({ error: '관리자 키가 올바르지 않습니다.' });

    const ADMIN_PHONE = '01000000000';
    let user = await repo.findUserByPhone(ADMIN_PHONE);

    if (!user) {
      const userId = nanoid();
      const now = new Date().toISOString();
      user = {
        id: userId, phone: ADMIN_PHONE, birthYear: 2000, region: '천안', nickname: '관리자',
        gender: '선택안함', googleUid: null, googleEmail: null,
        verified: true, createdAt: now, banned: false, isAdmin: true,
        meetJoined: 0, meetCompleted: 0, lateCancelCount: 0, noShowCount: 0,
        attendanceRate: 100, penaltyLevel: 0, stars: 999
      };
      await repo.createUser(userId, user);
      await repo.createProfile(userId, {
        userId, interests: ['커피', '여행'], purpose: ['동갑친구'], bio: '',
        prompts: [], photoUrl: null, state: 'LOCKED'
      });
    } else if (!user.isAdmin) {
      await repo.updateUser(user.id, { isAdmin: true });
    }

    res.json({ userId: user.id, nickname: user.nickname });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /auth/signup
router.post('/signup', async (req, res) => {
  try {
    const {
      phone, birthYear, region, nickname, gender = '선택안함', bio = '', prompts = [],
      interests = [], purpose = [], termsAgreed = false, googleUid = null, googleEmail = null
    } = req.body;

    if (!phone || !birthYear || !region || !nickname) {
      return res.status(400).json({ error: 'phone, birthYear, region, nickname은 필수입니다.' });
    }
    if (!termsAgreed) {
      return res.status(400).json({ error: '필수 약관에 동의해주세요.' });
    }
    if (nickname.length > 5) {
      return res.status(400).json({ error: '닉네임은 최대 5글자입니다.' });
    }
    const age = new Date().getFullYear() - Number(birthYear);
    if (age < 14) {
      return res.status(400).json({ error: '연령 요건을 충족하지 않습니다.' });
    }

    const phoneVerified = await repo.isPhoneVerified(phone);
    if (!phoneVerified) {
      return res.status(400).json({ error: '휴대폰 본인인증을 먼저 완료해주세요.' });
    }

    const existing = await repo.findUserByPhone(phone);
    if (existing) {
      return res.status(409).json({ error: '이미 가입된 휴대폰 번호입니다.', userId: existing.id });
    }
    if (googleUid) {
      const existingGoogle = await repo.findUserByGoogleUid(googleUid);
      if (existingGoogle) {
        return res.status(409).json({ error: '이미 이 구글 계정으로 가입되어 있습니다.', userId: existingGoogle.id });
      }
    }

    const userId = nanoid();
    const now = new Date().toISOString();

    const user = {
      id: userId, phone, birthYear: Number(birthYear), region, nickname, gender,
      googleUid, googleEmail,
      verified: true, createdAt: now, banned: false, isAdmin: false,
      meetJoined: 0, meetCompleted: 0, lateCancelCount: 0, noShowCount: 0,
      attendanceRate: 100, penaltyLevel: 0, stars: 5
    };
    await repo.createUser(userId, user);

    const profile = { userId, interests, purpose, bio, prompts, photoUrl: null, state: 'LOCKED' };
    await repo.createProfile(userId, profile);

    res.status(201).json({ userId, message: '회원가입 완료' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /auth/me/:userId
router.get('/me/:userId', async (req, res) => {
  try {
    const user = await repo.getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    const profile = await repo.getProfile(req.params.userId);
    res.json({ user, profile });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /auth/photo  body: { userId, imageBase64 } (data URL, 예: "data:image/jpeg;base64,...")
router.post('/photo', async (req, res) => {
  try {
    if (!bucket) return res.status(503).json({ error: '사진 업로드 기능이 아직 설정되지 않았어요. (Storage 초기화 실패)' });

    const { userId, imageBase64 } = req.body;
    if (!userId || !imageBase64) return res.status(400).json({ error: 'userId, imageBase64는 필수입니다.' });

    const user = await repo.getUser(userId);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const matches = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: '올바른 이미지 데이터가 아닙니다.' });
    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: '이미지 용량은 5MB 이하로 올려주세요.' });
    }

    const ext = contentType.split('/')[1] || 'jpg';
    const file = bucket.file(`profiles/${userId}.${ext}`);
    await file.save(buffer, { metadata: { contentType }, public: true });
    const photoUrl = `https://storage.googleapis.com/${bucket.name}/profiles/${userId}.${ext}`;

    await repo.updateProfile(userId, { photoUrl });
    res.json({ photoUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '사진 업로드 중 오류가 발생했습니다. (Storage 권한 설정이 필요할 수 있어요)' });
  }
});

// GET /auth/by-google/:googleUid - 구글 로그인 시 기존 가입 여부 확인
router.get('/by-google/:googleUid', async (req, res) => {
  try {
    const user = await repo.findUserByGoogleUid(req.params.googleUid);
    if (!user) return res.status(404).json({ error: '가입된 계정이 없습니다.' });
    res.json({ userId: user.id, nickname: user.nickname });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
