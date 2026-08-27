// 로컬 개발/테스트용 JSON 파일 기반 저장소
// 실 서비스 배포 시 이 파일의 함수 시그니처를 유지한 채 Firestore 구현으로 교체하면 됨
// (users, profiles, discoveries, quizAttempts, friendRequests, friendships,
//  rooms(TRIO), roomMembers, roomMessages, reports, blocks 컬렉션 구조는
//  기획서 "56. DB 큰 구조" 기준을 그대로 따름)

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      users: {},
      profiles: {},
      quizQuestions: seedQuizQuestions(),
      quizAttempts: {},
      friendRequests: {},
      friendships: {},
      rooms: {},
      roomMembers: {},
      roomMessages: {},
      reports: {},
      blocks: {}
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function seedQuizQuestions() {
  // 기획서 10. QUIZ 카테고리 기반 초기 문항 템플릿
  return {
    q1: {
      id: 'q1',
      category: 'MY FOOD',
      prompt: '자주 먹는 음식은?',
      choices: ['떡볶이', '초밥', '파스타', '삼겹살'],
    },
    q2: {
      id: 'q2',
      category: 'MY SPOT',
      prompt: '주말에 자주 가는 곳은?',
      choices: ['카페', '공원', '헬스장', '집'],
    },
    q3: {
      id: 'q3',
      category: 'BACK THEN',
      prompt: '학창시절 별명은 어떤 느낌이었을까?',
      choices: ['활발한 별명', '조용한 별명', '특이한 별명', '별명 없음'],
    },
    q4: {
      id: 'q4',
      category: 'MY PICK',
      prompt: '가장 아끼는 물건은?',
      choices: ['사진', '옷', '전자기기', '기념품'],
    },
    q5: {
      id: 'q5',
      category: 'MBTI GUESS',
      prompt: 'MBTI 성향 추측?',
      choices: ['E(외향)', 'I(내향)', '반반', '모르겠음'],
    }
  };
}

module.exports = { loadDB, saveDB };
