// 기획서 10. QUIZ 카테고리 기반 문항 템플릿 (콘텐츠성 데이터라 코드로 관리)
const QUIZ_QUESTIONS = {
  q1: { id: 'q1', category: 'MY FOOD', prompt: '자주 먹는 음식은?', choices: ['떡볶이', '초밥', '파스타', '삼겹살'] },
  q2: { id: 'q2', category: 'MY SPOT', prompt: '주말에 자주 가는 곳은?', choices: ['카페', '공원', '헬스장', '집'] },
  q3: { id: 'q3', category: 'BACK THEN', prompt: '학창시절 별명은 어떤 느낌이었을까?', choices: ['활발한 별명', '조용한 별명', '특이한 별명', '별명 없음'] },
  q4: { id: 'q4', category: 'MY PICK', prompt: '가장 아끼는 물건은?', choices: ['사진', '옷', '전자기기', '기념품'] },
  q5: { id: 'q5', category: 'MBTI GUESS', prompt: 'MBTI 성향 추측?', choices: ['E(외향)', 'I(내향)', '반반', '모르겠음'] }
};

module.exports = { QUIZ_QUESTIONS };
