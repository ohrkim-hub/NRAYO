const express = require('express');
const router = express.Router();

// POST /geocode/reverse  body: { lat, lng }
// GPS 좌표를 한국 행정구역 주소로 변환 (카카오 로컬 API 사용)
router.post('/reverse', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'lat, lng가 필요합니다.' });

    if (!process.env.KAKAO_REST_API_KEY) {
      return res.status(503).json({ error: '위치 변환 기능이 아직 설정되지 않았어요. (KAKAO_REST_API_KEY 미설정)' });
    }

    const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`;
    const kakaoRes = await fetch(url, {
      headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` }
    });

    if (!kakaoRes.ok) {
      const errBody = await kakaoRes.text();
      console.error('카카오 API 오류:', errBody);
      return res.status(502).json({ error: '주소 변환에 실패했어요.' });
    }

    const data = await kakaoRes.json();
    const doc = data.documents?.[0]?.address;
    if (!doc) return res.status(404).json({ error: '해당 위치의 주소를 찾을 수 없어요.' });

    const region = `${doc.region_2depth_name} ${doc.region_3depth_name}`.trim();
    res.json({ region });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
