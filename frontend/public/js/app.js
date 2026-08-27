// 너랑요 (NRAYO) 프론트엔드 - P0 스캐폴드
// 백엔드 API_BASE는 배포 환경에 맞게 교체 (로컬 개발 시 http://localhost:8080)
const API_BASE = window.NRAYO_API_BASE || 'http://localhost:8080';

const state = {
  userId: null,
  nickname: null,
  purpose: new Set(),
  interests: new Set(),
  friends: [], // { userId, nickname }
  pendingRequests: {}, // requestId -> targetUserId
  currentQuizTarget: null,
  currentTrioRoom: null
};

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

async function api(path, method = 'GET', body) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

function setupChips(containerId, targetSet) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
      const v = chip.dataset.v;
      if (targetSet.has(v)) targetSet.delete(v); else targetSet.add(v);
    });
  });
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${name}"]`);
  if (tabBtn) tabBtn.classList.add('active');

  if (name === 'today') loadToday();
  if (name === 'trio') loadTrioList();
  if (name === 'me') loadMe();
}

// ---------------- 온보딩 ----------------
async function signup() {
  const phone = document.getElementById('ob-phone').value.trim();
  const birthYear = document.getElementById('ob-birthyear').value.trim();
  const region = document.getElementById('ob-region').value.trim();
  const nickname = document.getElementById('ob-nickname').value.trim();

  if (!phone || !birthYear || !region || !nickname) {
    toast('필수 항목을 모두 입력해주세요');
    return;
  }

  try {
    const result = await api('/auth/signup', 'POST', {
      phone, birthYear, region, nickname,
      interests: Array.from(state.interests),
      purpose: Array.from(state.purpose)
    });
    state.userId = result.userId;
    state.nickname = nickname;
    document.getElementById('me-nickname-label').textContent = nickname + '님';
    document.getElementById('screen-onboarding').classList.remove('active');
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('tabbar').style.display = 'flex';
    toast('너랑요에 오신 걸 환영해요!');
    loadToday();
  } catch (e) {
    toast(e.message);
  }
}

// ---------------- TODAY'S 2 ----------------
async function loadToday() {
  if (!state.userId) return;
  try {
    const data = await api(`/discovery/today/${state.userId}`);
    const list = document.getElementById('today-list');
    if (!data.candidates.length) {
      list.innerHTML = `<div class="empty-state">오늘은 근처에 새로운 사람이 없어요.<br/>내일 다시 확인해주세요.</div>`;
      return;
    }
    list.innerHTML = data.candidates.map(c => renderPersonCard(c)).join('');
  } catch (e) { toast(e.message); }
}

function renderPersonCard(c) {
  const stateLabel = {
    LOCKED: '알아가기 전',
    DISCOVERING: '알아가는 중',
    REVEALED: '사진 공개됨',
    FRIENDABLE: '친구신청 가능'
  }[c.profileState] || c.profileState;

  const photoBlock = c.photoUrl
    ? `<img src="${c.photoUrl}" style="width:100%;height:100%;object-fit:cover;" />`
    : `<span class="lock-icon" style="font-size:34px;">🔒</span>`;

  const actionBtn = (c.profileState === 'FRIENDABLE')
    ? `<button class="btn btn-primary btn-sm" onclick="sendFriendRequest('${c.userId}','${c.nickname}')">친구신청</button>`
    : `<button class="btn btn-outline btn-sm" onclick="openQuiz('${c.userId}','${c.nickname}')">이 사람 알아보기</button>`;

  return `
  <div class="person-card">
    <div class="person-photo">
      <span class="state-tag">${stateLabel}</span>
      ${photoBlock}
    </div>
    <div class="person-body">
      <div class="person-name">${c.nickname} · ${c.birthYear}</div>
      <div class="person-meta">${c.region}</div>
      <div class="tag-row">${(c.interests || []).map(i => `<span class="tag">${i}</span>`).join('')}</div>
      <div style="margin-top:12px;">${actionBtn}</div>
    </div>
  </div>`;
}

// ---------------- QUIZ ----------------
async function openQuiz(targetUserId, nickname) {
  state.currentQuizTarget = { userId: targetUserId, nickname };
  document.getElementById('quiz-target-name').textContent = nickname + '님 알아보기';
  showScreen('quiz');
  await renderNextQuizQuestion();
}

async function renderNextQuizQuestion() {
  const questions = await api('/quiz/questions');
  const q = questions[Math.floor(Math.random() * questions.length)];
  const area = document.getElementById('quiz-question-area');
  area.innerHTML = `
    <div class="muted" style="margin-bottom:6px;">${q.category}</div>
    <div style="font-weight:700; font-size:15px; margin-bottom:12px;">${q.prompt}</div>
    ${q.choices.map(ch => `<button class="quiz-choice" onclick="answerQuiz('${q.id}', '${ch}')">${ch}</button>`).join('')}
  `;
}

async function answerQuiz(questionId, choice) {
  const target = state.currentQuizTarget;
  try {
    const result = await api('/quiz/attempt', 'POST', {
      fromUserId: state.userId, toUserId: target.userId, questionId, choice
    });
    document.getElementById('quiz-state').textContent =
      `알아본 횟수 ${result.attemptCount}/${result.unlockThreshold} · 상태: ${result.profileState}`;

    if (result.profileState === 'FRIENDABLE') {
      toast(`${target.nickname}님의 프로필이 공개됐어요!`);
      document.getElementById('quiz-question-area').innerHTML =
        `<p>프로필이 공개됐어요. Today's 2로 돌아가 친구신청을 보내보세요.</p>
         <button class="btn btn-primary" onclick="showScreen('today')">Today's 2로 이동</button>`;
    } else {
      await renderNextQuizQuestion();
    }
  } catch (e) { toast(e.message); }
}

// ---------------- 친구신청 / 수락 (프로토타입: 단일 사용자 데모용 즉시수락 버튼 제공) ----------------
async function sendFriendRequest(targetUserId, nickname) {
  try {
    const result = await api('/friends/request', 'POST', { fromUserId: state.userId, toUserId: targetUserId });
    state.pendingRequests[result.requestId] = { targetUserId, nickname };
    toast(`${nickname}님에게 친구신청을 보냈어요`);
    const proceed = confirm(`[데모용] ${nickname}님이 수락했다고 가정하고 다음 단계(TRIO)로 진행할까요?`);
    if (proceed) {
      const acceptResult = await api('/friends/accept', 'POST', { requestId: result.requestId });
      state.friends.push({ userId: targetUserId, nickname });
      toast(`${nickname}님과 친구가 됐어요! DM이 열렸어요.`);
      loadToday();
    }
  } catch (e) { toast(e.message); }
}

// ---------------- TRIO ----------------
async function loadTrioList() {
  const picker = document.getElementById('friend-picker');
  if (!state.friends.length) {
    picker.innerHTML = `<p class="muted">아직 친구가 없어요. Today's 2에서 친구를 먼저 만들어보세요.</p>`;
  } else {
    picker.innerHTML = state.friends.map(f =>
      `<div class="chip" data-friend="${f.userId}">${f.nickname}</div>`
    ).join('');
    picker.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => chip.classList.toggle('selected'));
    });
  }

  const list = document.getElementById('trio-list');
  if (state.currentTrioRoom) {
    list.innerHTML = `<div class="card">
      <div style="font-weight:800;">진행 중인 TRIO 방이 있어요</div>
      <button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="openTrioRoom('${state.currentTrioRoom}')">방 열기</button>
    </div>`;
  } else {
    list.innerHTML = '';
  }
}

async function createTrio() {
  const picked = Array.from(document.querySelectorAll('#friend-picker .chip.selected')).map(c => c.dataset.friend);
  if (picked.length < 2) {
    toast('TRIO는 최소 3명(나 포함)부터 시작해요. 친구 2명을 선택해주세요.');
    return;
  }
  try {
    const result = await api('/trio/create', 'POST', { creatorUserId: state.userId, memberUserIds: picked });
    state.currentTrioRoom = result.roomId;
    toast('TRIO 방이 만들어졌어요!');
    openTrioRoom(result.roomId);
  } catch (e) { toast(e.message); }
}

async function openTrioRoom(roomId) {
  state.currentTrioRoom = roomId;
  showScreen('trio-room');
  await refreshTrioRoom();
}

async function refreshTrioRoom() {
  const data = await api(`/trio/${state.currentTrioRoom}`);
  const box = document.getElementById('trio-room-messages');
  if (!data.messages.length) {
    box.innerHTML = `<p class="muted">아직 메시지가 없어요. 관계 게임 카드로 대화를 시작해보세요.</p>`;
  } else {
    box.innerHTML = data.messages.map(m => `
      <div class="chat-bubble ${m.userId === state.userId ? 'me' : 'other'}">
        ${m.userId !== state.userId ? `<div class="chat-sender">${m.userId.slice(0,4)}</div>` : ''}
        ${m.text}
      </div>`).join('');
  }
}

async function sendTrioMessage() {
  const input = document.getElementById('trio-msg-input');
  const text = input.value.trim();
  if (!text || !state.currentTrioRoom) return;
  try {
    await api(`/trio/${state.currentTrioRoom}/message`, 'POST', { userId: state.userId, text });
    input.value = '';
    await refreshTrioRoom();
  } catch (e) { toast(e.message); }
}

// ---------------- MEET ----------------
async function createMeet() {
  const purpose = document.getElementById('meet-purpose').value.trim();
  const dateTime = document.getElementById('meet-datetime').value;
  const capacity = document.getElementById('meet-capacity').value;
  if (!purpose || !dateTime) { toast('목적과 날짜/시간을 입력해주세요'); return; }

  try {
    const result = await api('/meets/create', 'POST', {
      hostUserId: state.userId, region: '천안', distanceKm: 10,
      purpose, dateTime, capacity: Number(capacity), tone: '편한 존댓말', drinking: false
    });
    toast('모임이 만들어졌어요!');
    renderMeet(result.meet);
  } catch (e) { toast(e.message); }
}

function renderMeet(meet) {
  const list = document.getElementById('meet-list');
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `<div style="font-weight:800;">${meet.purpose} · ${meet.capacity}명</div>
    <div class="muted">${meet.dateTime}</div>`;
  list.prepend(div);
}

// ---------------- ME ----------------
async function loadMe() {
  if (!state.userId) return;
  const data = await api(`/auth/me/${state.userId}`);
  document.getElementById('star-count').textContent = data.user.stars;
  document.getElementById('me-summary').innerHTML = `
    <div style="font-weight:800; font-size:16px;">${data.user.nickname}</div>
    <div class="muted" style="margin:6px 0;">${data.user.region} · ${data.user.birthYear}</div>
    <div class="tag-row">${(data.profile.interests || []).map(i => `<span class="tag">${i}</span>`).join('')}</div>
    <div style="margin-top:14px;" class="muted">친구 ${state.friends.length}명 · Meet 참여 ${data.user.meetJoined}회</div>
  `;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

setupChips('ob-purpose', state.purpose);
setupChips('ob-interests', state.interests);

window.NRAYO = { signup, showScreen, sendFriendRequest, openQuiz, answerQuiz, createTrio, sendTrioMessage, createMeet };
window.sendFriendRequest = sendFriendRequest;
window.openQuiz = openQuiz;
window.answerQuiz = answerQuiz;
window.showScreen = showScreen;
window.openTrioRoom = openTrioRoom;
