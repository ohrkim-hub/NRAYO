// TRIO 관계 게임 - SAME 5 (공통점 찾기) 프롬프트
const SAME5_PROMPTS = {
  s1: { id: 's1', prompt: '좋아하는 계절은?' },
  s2: { id: 's2', prompt: '아침형 인간 vs 저녁형 인간?' },
  s3: { id: 's3', prompt: '여행 갈 때 짐 싸는 스타일은? (미리 vs 급하게)' },
  s4: { id: 's4', prompt: '초성으로 답해보세요: 최근 본 영화/드라마' },
  s5: { id: 's5', prompt: 'MBTI 앞글자 (E/I)?' }
};

// WHO'S THIS - 나이/시절 맞히기 미니게임 (방장이 문제 출제)
const WHOSTHIS_TEMPLATE = {
  question: '이 사진 속 저는 몇 살이었을까요?',
  hint: '힌트를 자유롭게 적어보세요'
};

module.exports = { SAME5_PROMPTS, WHOSTHIS_TEMPLATE };
