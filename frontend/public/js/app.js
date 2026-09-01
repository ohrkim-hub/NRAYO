// NRAYO frontend - P0 scaffold
// Backend API_BASE - change per environment
const API_BASE = window.NRAYO_API_BASE || 'https://nrayo-backend-761047791567.asia-northeast3.run.app';

const PROMPT_QUESTIONS = [
  '주말엔 보통',
  '요즘 꽂힌 것',
  '나만 아는 동네 맛집',
  '스트레스 풀리는 방법',
  '최근에 웃겼던 일',
  '좋아하는 계절과 이유'
];

const PURPOSE_ICONS = {
  '동갑친구': '🎂', '동네친구': '🏘️', '취미친구': '🎨', '카페': '☕',
  '맛집': '🍽️', '운동': '💪', '여행': '✈️', '외국인친구': '🌍'
};

const state = {
  userId: null,
  nickname: null,
  purpose: new Set(),
  interests: new Set(),
  friends: [], // { userId, nickname }
  pendingRequests: {}, // requestId -> targetUserId
  currentQuizTarget: null,
  currentTrioRoom: null,
  trioPollTimer: null,
  currentGame: null // 'same5' | 'whosthis' | null
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
  if (name !== 'trio-room' && state.trioPollTimer) {
    clearInterval(state.trioPollTimer);
    state.trioPollTimer = null;
  }

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

// ---------------- 관리자로 바로 앱 진입 ----------------
async function adminLogin() {
  const key = prompt('관리자 키를 입력해주세요');
  if (!key) return;
  try {
    const result = await api('/auth/admin-login', 'POST', { key });
    state.userId = result.userId;
    state.nickname = result.nickname;
    document.getElementById('me-nickname-label').textContent = result.nickname + '님';
    document.getElementById('screen-onboarding').classList.remove('active');
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('tabbar').style.display = 'flex';
    toast('관리자로 입장했어요 (별 무한)');
    loadToday();
  } catch (e) {
    toast(e.message);
  }
}

// ---------------- 구글 로그인 ----------------
async function signInWithGoogle() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await firebase.auth().signInWithPopup(provider);
    const googleUser = result.user;

    // 이미 가입된 계정인지 확인 -> 있으면 온보딩 건너뛰고 바로 로그인
    try {
      const existing = await api(`/auth/by-google/${googleUser.uid}`);
      state.userId = existing.userId;
      state.nickname = existing.nickname;
      document.getElementById('me-nickname-label').textContent = existing.nickname + '님';
      document.getElementById('screen-onboarding').classList.remove('active');
      document.getElementById('main-app').style.display = 'flex';
      document.getElementById('tabbar').style.display = 'flex';
      toast(`${existing.nickname}님, 다시 오셨네요!`);
      loadToday();
      return;
    } catch (notFoundErr) {
      // 가입 이력 없음 -> 신규 가입 흐름으로 계속 진행 (구글 정보만 저장해두고 온보딩 이어감)
    }

    obState.googleUid = googleUser.uid;
    obState.googleEmail = googleUser.email;
    toast('구글 계정 연결 완료! 나머지 정보를 마저 입력해주세요');
    obNext();
  } catch (e) {
    console.error(e);
    toast('구글 로그인에 실패했어요: ' + (e.message || ''));
  }
}

// ---------------- 온보딩 (단계별) ----------------
const obState = { currentStep: 0, totalSteps: 10, termsAgreed: false, gender: null, photoBase64: null, googleUid: null, googleEmail: null };

function showObStep(idx) {
  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  document.querySelector(`.ob-step[data-step="${idx}"]`).classList.add('active');
  document.getElementById('ob-progress-bar').style.width = (idx / obState.totalSteps * 100) + '%';
  document.getElementById('ob-back-btn').style.display = idx === 0 ? 'none' : 'block';
  obState.currentStep = idx;

  const stepEl = document.querySelector(`.ob-step[data-step="${idx}"] .ob-input`);
  if (stepEl) setTimeout(() => stepEl.focus(), 250);
}

function obNext() {
  showObStep(obState.currentStep + 1);
}

function obPrev() {
  if (obState.currentStep === 0) return;
  showObStep(obState.currentStep - 1);
}

function obBindInput(inputId, ctaId) {
  const input = document.getElementById(inputId);
  const cta = document.getElementById(ctaId);
  const check = () => { cta.disabled = input.value.trim().length === 0; };
  input.addEventListener('input', check);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !cta.disabled) cta.click(); });
  check();
}

function obBindChips(containerId, ctaId, targetSet) {
  const container = document.getElementById(containerId);
  const cta = document.getElementById(ctaId);
  const check = () => { cta.disabled = targetSet.size === 0; };
  container.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', check));
  check();
}

function setupSingleChip(containerId, ctaId, onSelect) {
  const container = document.getElementById(containerId);
  const cta = document.getElementById(ctaId);
  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      onSelect(chip.dataset.v);
      if (cta) cta.disabled = false;
    });
  });
}

// ---------------- 약관동의 ----------------
function setupTerms() {
  const allBox = document.getElementById('terms-all');
  const items = Array.from(document.querySelectorAll('.terms-item'));
  const requiredItems = items.filter(i => i.dataset.required === 'true');
  const cta = document.getElementById('ob-cta-1');

  function refresh() {
    const allChecked = items.every(i => i.checked);
    allBox.checked = allChecked;
    const requiredOk = requiredItems.every(i => i.checked);
    obState.termsAgreed = requiredOk;
    cta.disabled = !requiredOk;
  }

  allBox.addEventListener('change', () => {
    items.forEach(i => { i.checked = allBox.checked; });
    refresh();
  });
  items.forEach(i => i.addEventListener('change', refresh));
  refresh();
}

// ---------------- 휴대폰 인증 ----------------
let verifyTimerInterval = null;

async function sendVerifyCode() {
  const phone = document.getElementById('ob-phone').value.trim();
  if (!/^01[0-9]{8,9}$/.test(phone)) {
    toast('올바른 휴대폰 번호를 입력해주세요');
    return;
  }
  try {
    const result = await api('/verify/send', 'POST', { phone });
    document.getElementById('verify-code-area').style.display = 'block';
    document.getElementById('verify-desc').textContent = `${phone}로 인증번호를 보냈어요`;
    document.getElementById('ob-code').value = '';
    document.getElementById('ob-cta-2').disabled = true;

    // 실제 SMS 벤더 연동 전까지 임시로 인증번호를 화면에 계속 보이게 안내 (실서비스 배포 시 반드시 제거할 것)
    let devCodeEl = document.getElementById('dev-code-hint');
    if (!devCodeEl) {
      devCodeEl = document.createElement('div');
      devCodeEl.id = 'dev-code-hint';
      devCodeEl.className = 'state-pill';
      devCodeEl.style.marginTop = '10px';
      document.getElementById('verify-code-area').appendChild(devCodeEl);
    }
    devCodeEl.innerHTML = `[테스트용] 인증번호: <b>${result.devCode}</b> <span style="text-decoration:underline; cursor:pointer;" onclick="document.getElementById('ob-code').value='${result.devCode}'; document.getElementById('ob-cta-2').disabled=false;">(자동입력)</span>`;

    let remain = 180;
    if (verifyTimerInterval) clearInterval(verifyTimerInterval);
    const timerEl = document.getElementById('verify-timer');
    const tick = () => {
      const m = String(Math.floor(remain / 60)).padStart(2, '0');
      const s = String(remain % 60).padStart(2, '0');
      timerEl.textContent = `남은 시간 ${m}:${s}`;
      if (remain <= 0) { clearInterval(verifyTimerInterval); timerEl.textContent = '인증번호가 만료됐어요'; }
      remain--;
    };
    tick();
    verifyTimerInterval = setInterval(tick, 1000);
  } catch (e) { toast(e.message); }
}

async function confirmVerifyCode() {
  const phone = document.getElementById('ob-phone').value.trim();
  const code = document.getElementById('ob-code').value.trim();
  if (!code) { toast('인증번호를 입력해주세요'); return; }
  try {
    await api('/verify/confirm', 'POST', { phone, code });
    if (verifyTimerInterval) clearInterval(verifyTimerInterval);
    toast('휴대폰 인증이 완료됐어요');
    obNext();
  } catch (e) { toast(e.message); }
}

document.getElementById('ob-code') && document.getElementById('ob-code').addEventListener('input', () => {
  document.getElementById('ob-cta-2').disabled = document.getElementById('ob-code').value.trim().length !== 6;
});

// ---------------- 프로필 사진 ----------------
function previewPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('사진 용량은 5MB 이하로 올려주세요'); return; }

  const reader = new FileReader();
  reader.onload = () => {
    obState.photoBase64 = reader.result;
    const preview = document.getElementById('photo-preview');
    preview.src = reader.result;
    preview.style.display = 'block';
    document.getElementById('photo-placeholder').style.display = 'none';
    document.getElementById('ob-cta-7').disabled = false;
  };
  reader.readAsDataURL(file);
}

// ---------------- 프롬프트 자기소개 ----------------
function setupPrompts() {
  const sel1 = document.getElementById('ob-prompt-q1');
  const sel2 = document.getElementById('ob-prompt-q2');

  function fillOptions(select, excludeValue) {
    select.innerHTML = PROMPT_QUESTIONS
      .filter(q => q !== excludeValue)
      .map(q => `<option value="${q}">${q}</option>`).join('');
  }

  fillOptions(sel1, sel2.value);
  fillOptions(sel2, sel1.value);
  sel2.selectedIndex = 1;

  sel1.addEventListener('change', () => { fillOptions(sel2, sel1.value); });
  sel2.addEventListener('change', () => { fillOptions(sel1, sel2.value); });
}
// ---------------- 회원가입 제출 ----------------
async function signup() {
  const phone = document.getElementById('ob-phone').value.trim();
  const birthYear = document.getElementById('ob-birthyear').value.trim();
  const region = document.getElementById('ob-region').value.trim();
  const nickname = document.getElementById('ob-nickname').value.trim();

  const prompts = [
    { q: document.getElementById('ob-prompt-q1').value, a: document.getElementById('ob-prompt-a1').value.trim() },
    { q: document.getElementById('ob-prompt-q2').value, a: document.getElementById('ob-prompt-a2').value.trim() }
  ].filter(p => p.a.length > 0);

  if (!phone || !birthYear || !region || !nickname) {
    toast('필수 항목을 모두 입력해주세요');
    return;
  }

  try {
    const result = await api('/auth/signup', 'POST', {
      phone, birthYear, region, nickname, prompts,
      gender: obState.gender || '선택안함',
      termsAgreed: obState.termsAgreed,
      googleUid: obState.googleUid,
      googleEmail: obState.googleEmail,
      interests: Array.from(state.interests),
      purpose: Array.from(state.purpose)
    });
    state.userId = result.userId;
    state.nickname = nickname;

    if (obState.photoBase64) {
      try { await api('/auth/photo', 'POST', { userId: result.userId, imageBase64: obState.photoBase64 }); }
      catch (e) { console.warn('사진 업로드 실패:', e.message); }
    }

    document.getElementById('me-nickname-label').textContent = nickname + '님';
    document.getElementById('screen-onboarding').classList.remove('active');
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('tabbar').style.display = 'flex';
    toast('너랑요에 오신 걸 환영해요!');
    showContactsPromptCard();
    loadToday();
  } catch (e) {
    toast(e.message);
  }
}

// ---------------- 지인 피하기 ----------------
function showContactsPromptCard() {
  if (localStorage.getItem('nrayo_contacts_done')) return;
  const card = document.getElementById('contacts-prompt-card');
  card.innerHTML = `
    <div class="card contacts-card">
      <div style="font-weight:800; font-size:15px;">지인 피하기</div>
      <div class="muted" style="margin:4px 0 10px;">아는 사람 번호를 등록하면 추천에서 제외해드려요</div>
      <textarea id="contacts-input" placeholder="번호를 쉼표(,)로 구분해서 붙여넣으세요&#10;예: 01011112222, 01033334444"></textarea>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button class="btn btn-primary btn-sm" onclick="NRAYO.saveContacts()">등록하기</button>
        <button class="btn btn-ghost btn-sm" onclick="NRAYO.skipContacts()">나중에 할게요</button>
      </div>
    </div>`;
}

async function saveContacts() {
  const raw = document.getElementById('contacts-input').value.trim();
  const phones = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
  try {
    if (phones.length > 0) {
      await api('/contacts/upload', 'POST', { userId: state.userId, phones });
    }
    toast('지인 피하기가 설정됐어요');
    localStorage.setItem('nrayo_contacts_done', '1');
    document.getElementById('contacts-prompt-card').innerHTML = '';
    loadToday();
  } catch (e) { toast(e.message); }
}

function skipContacts() {
  localStorage.setItem('nrayo_contacts_done', '1');
  document.getElementById('contacts-prompt-card').innerHTML = '';
}

// ---------------- 매너 평점 ----------------
async function rateManner(targetUserId, nickname) {
  const input = prompt(`${nickname}님의 매너를 1~5점으로 평가해주세요`, '5');
  if (!input) return;
  const score = Number(input);
  if (!score || score < 1 || score > 5) { toast('1~5 사이 숫자를 입력해주세요'); return; }
  try {
    await api(`/ratings/${targetUserId}`, 'POST', { raterUserId: state.userId, score });
    toast('평가가 반영됐어요');
  } catch (e) { toast(e.message); }
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
    list.innerHTML += `<button class="btn btn-outline" id="extra-candidates-btn" onclick="NRAYO.loadExtraCandidates()">더 보기 (⭐3 소모)</button>`;
  } catch (e) { toast(e.message); }
}

async function loadExtraCandidates() {
  try {
    const result = await api(`/discovery/extra/${state.userId}`, 'POST');
    const list = document.getElementById('today-list');
    const existingBtn = document.getElementById('extra-candidates-btn');
    if (existingBtn) existingBtn.remove();

    const extraHtml = result.candidates.map(c => renderPersonCard(c)).join('');
    list.insertAdjacentHTML('beforeend', extraHtml);
    list.insertAdjacentHTML('beforeend', `<button class="btn btn-outline" id="extra-candidates-btn" onclick="NRAYO.loadExtraCandidates()">더 보기 (⭐3 소모)</button>`);

    document.getElementById('star-count').textContent = result.stars;
    toast(result.isAdmin ? '관리자 계정: 별이 소모되지 않아요' : '추천을 더 받았어요');
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

  const mannerBadge = c.mannerScore
    ? `<span class="manner-badge">⭐ 매너 ${c.mannerScore}</span>`
    : '';

  const purposeBadges = (c.purpose || []).map(p =>
    `<span class="purpose-icon-badge">${PURPOSE_ICONS[p] || '✨'} ${p}</span>`
  ).join('');

  const promptBlock = (c.prompts && c.prompts.length > 0)
    ? c.prompts.map(p => `<div class="muted" style="margin-top:6px;"><b style="color:var(--text);">${p.q}</b> — ${p.a}</div>`).join('')
    : '';

  return `
  <div class="person-card">
    <div class="person-photo">
      <span class="state-tag">${stateLabel}</span>
      ${photoBlock}
    </div>
    <div class="person-body">
      <div class="person-name">${c.nickname} · ${c.birthYear} ${mannerBadge}</div>
      <div class="person-meta">${c.region}</div>
      ${purposeBadges ? `<div class="purpose-icon-row">${purposeBadges}</div>` : ''}
      <div class="tag-row">${(c.interests || []).map(i => `<span class="tag">${i}</span>`).join('')}</div>
      ${promptBlock}
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

  if (state.trioPollTimer) clearInterval(state.trioPollTimer);
  state.trioPollTimer = setInterval(refreshTrioRoom, 3000); // 3초마다 새 메시지 폴링 (새로고침 없이 반영)
}

function leaveTrioRoom() {
  if (state.trioPollTimer) { clearInterval(state.trioPollTimer); state.trioPollTimer = null; }
  showScreen('trio');
}

async function refreshTrioRoom() {
  if (!state.currentTrioRoom) return;
  const data = await api(`/trio/${state.currentTrioRoom}`);
  const box = document.getElementById('trio-room-messages');
  if (!data.messages.length) {
    box.innerHTML = `<p class="muted">아직 메시지가 없어요. 아래 관계 게임으로 대화를 시작해보세요.</p>`;
  } else {
    box.innerHTML = data.messages.map(m => `
      <div class="chat-bubble ${m.userId === state.userId ? 'me' : 'other'}">
        ${m.userId !== state.userId ? `<div class="chat-sender">${m.userId.slice(0,4)}</div>` : ''}
        ${m.text}
      </div>`).join('');
  }

  const badges = document.getElementById('trio-room-badges');
  const badgeParts = [];
  if (data.room.isFiveChat) badgeParts.push(`<span class="state-pill">💛 5CHAT (계속 이어가는 방)</span>`);
  else badgeParts.push(`<span class="muted">7일 방 · ${data.room.expiresAt ? data.room.expiresAt.slice(0,10) + ' 까지' : ''}</span>`);
  if (data.room.casualUnlocked) badgeParts.push(`<span class="state-pill">😄 말 놓는 사이</span>`);
  badges.innerHTML = badgeParts.join(' ');

  const casualBtn = document.getElementById('btn-casual');
  if (casualBtn) {
    casualBtn.style.display = data.room.casualUnlocked ? 'none' : 'block';
  }
}

async function proposeCasual() {
  try {
    const result = await api(`/trio/${state.currentTrioRoom}/casual-vote`, 'POST', { userId: state.userId, vote: 'YES' });
    if (result.casualUnlocked) toast('모두 동의해서 말을 놓기로 했어요!');
    else toast('말 놓기에 찬성했어요. 다른 멤버들의 동의를 기다려요.');
    await refreshTrioRoom();
  } catch (e) { toast(e.message); }
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

// ---------------- TRIO 관계 게임 ----------------
async function showGame(name) {
  state.currentGame = name;
  const area = document.getElementById('game-area');
  if (!name) { area.innerHTML = ''; return; }
  if (name === 'same5') return renderSame5();
  if (name === 'whosthis') return renderWhosThis();
}

async function renderSame5() {
  const area = document.getElementById('game-area');
  const prompts = await api(`/trio/${state.currentTrioRoom}/game/same5/prompts`);
  area.innerHTML = `
    <select id="same5-prompt-select" class="ob-input" style="font-size:14px; padding:10px;">
      ${prompts.map(p => `<option value="${p.id}">${p.prompt}</option>`).join('')}
    </select>
    <div style="display:flex; gap:8px; margin-top:8px;">
      <input type="text" id="same5-answer-input" placeholder="답변 입력" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:1.5px solid var(--line);" />
      <button class="btn btn-primary btn-sm" onclick="NRAYO.submitSame5()">제출</button>
    </div>
    <div id="same5-result" class="muted" style="margin-top:8px;"></div>
  `;
}

async function submitSame5() {
  const promptId = document.getElementById('same5-prompt-select').value;
  const answer = document.getElementById('same5-answer-input').value.trim();
  if (!answer) { toast('답변을 입력해주세요'); return; }
  try {
    const result = await api(`/trio/${state.currentTrioRoom}/game/same5/answer`, 'POST', {
      userId: state.userId, promptId, answer
    });
    const resultEl = document.getElementById('same5-result');
    if (!result.allAnswered) {
      resultEl.textContent = `${result.answers.length}/${result.totalMembers}명 답변 완료. 다른 멤버를 기다려요.`;
    } else if (result.matched) {
      resultEl.textContent = '🎉 공통점 발견! 답이 모두 같아요.';
      resultEl.style.color = 'var(--accent-dark)';
    } else {
      resultEl.textContent = '답이 서로 달라요. 다음 질문도 도전해보세요.';
    }
  } catch (e) { toast(e.message); }
}

async function renderWhosThis() {
  const area = document.getElementById('game-area');
  const data = await api(`/trio/${state.currentTrioRoom}/game/whosthis`);

  if (!data.question) {
    area.innerHTML = `
      <div class="muted" style="margin-bottom:8px;">아직 문제가 없어요. 문제를 내보세요!</div>
      <input type="text" id="whosthis-hint" class="ob-input" placeholder="힌트 (예: 이 사진 속 저는 몇 살?)" style="font-size:14px; padding:10px;" />
      <input type="text" id="whosthis-answer" class="ob-input" placeholder="정답" style="font-size:14px; padding:10px; margin-top:8px;" />
      <button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="NRAYO.setWhosThis()">문제 등록</button>
    `;
  } else {
    const myGuess = data.guesses.find(g => g.userId === state.userId);
    area.innerHTML = `
      <div style="font-weight:700; margin-bottom:8px;">${data.question.hint}</div>
      ${myGuess
        ? `<div class="muted">이미 "${myGuess.guess}"라고 답했어요.</div>`
        : `<div style="display:flex; gap:8px;">
            <input type="text" id="whosthis-guess-input" placeholder="정답 추측" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:1.5px solid var(--line);" />
            <button class="btn btn-primary btn-sm" onclick="NRAYO.guessWhosThis()">제출</button>
          </div>`}
      <div id="whosthis-result" class="muted" style="margin-top:8px;"></div>
    `;
  }
}

async function setWhosThis() {
  const hint = document.getElementById('whosthis-hint').value.trim();
  const correctAnswer = document.getElementById('whosthis-answer').value.trim();
  if (!hint || !correctAnswer) { toast('힌트와 정답을 모두 입력해주세요'); return; }
  try {
    await api(`/trio/${state.currentTrioRoom}/game/whosthis/set`, 'POST', {
      userId: state.userId, hint, correctAnswer
    });
    toast('문제가 등록됐어요');
    renderWhosThis();
  } catch (e) { toast(e.message); }
}

async function guessWhosThis() {
  const guess = document.getElementById('whosthis-guess-input').value.trim();
  if (!guess) return;
  try {
    const result = await api(`/trio/${state.currentTrioRoom}/game/whosthis/guess`, 'POST', {
      userId: state.userId, guess
    });
    const resultEl = document.getElementById('whosthis-result');
    resultEl.textContent = result.correct ? '🎉 정답이에요!' : '아쉽지만 틀렸어요.';
    resultEl.style.color = result.correct ? 'var(--accent-dark)' : '';
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
  document.getElementById('star-count').textContent = data.user.isAdmin ? '무한' : data.user.stars;
  const mannerLine = data.user.mannerScore
    ? `<span class="manner-badge">⭐ 매너 ${data.user.mannerScore} (${data.user.mannerRatingCount}명 평가)</span>`
    : `<span class="muted">아직 매너 평가가 없어요</span>`;

  document.getElementById('me-summary').innerHTML = `
    <div style="font-weight:800; font-size:16px;">${data.user.nickname}</div>
    <div class="muted" style="margin:6px 0;">${data.user.region} · ${data.user.birthYear}</div>
    <div style="margin:8px 0;">${mannerLine}</div>
    <div class="tag-row">${(data.profile.interests || []).map(i => `<span class="tag">${i}</span>`).join('')}</div>
    <div style="margin-top:14px;" class="muted">친구 ${state.friends.length}명 · Meet 참여 ${data.user.meetJoined}회</div>
  `;

  const friendListEl = document.getElementById('me-friends-list');
  if (friendListEl) {
    friendListEl.innerHTML = state.friends.length
      ? state.friends.map(f => `
          <div class="card" style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px;">
            <span style="font-weight:700;">${f.nickname}</span>
            <button class="btn btn-ghost btn-sm" onclick="NRAYO.rateManner('${f.userId}','${f.nickname}')">매너 평가하기</button>
          </div>`).join('')
      : `<p class="muted">아직 친구가 없어요.</p>`;
  }

  await loadStarPackages();
}

// ---------------- 별 충전 (모의 결제) ----------------
async function loadStarPackages() {
  const box = document.getElementById('star-packages');
  if (!box) return;
  try {
    const packages = await api('/payments/packages');
    box.innerHTML = packages.map(p => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--line);">
        <div>
          <div style="font-weight:700;">${p.label}</div>
          <div class="muted">${p.price.toLocaleString()}원</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="NRAYO.chargeStars('${p.id}')">충전</button>
      </div>`).join('');
    box.innerHTML += `<p class="muted" style="margin-top:10px;">※ 아직 실제 결제 연동 전이라 모의(테스트) 충전이에요.</p>`;
  } catch (e) { console.error(e); }
}

async function chargeStars(packageId) {
  try {
    const result = await api('/payments/charge', 'POST', { userId: state.userId, packageId });
    toast(result.message);
    document.getElementById('star-count').textContent = result.stars;
  } catch (e) { toast(e.message); }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

setupChips('ob-purpose', state.purpose);
setupChips('ob-interests', state.interests);

setupTerms();
setupSingleChip('ob-gender', 'ob-cta-3', (v) => { obState.gender = v; });
obBindInput('ob-birthyear', 'ob-cta-4');
obBindInput('ob-region', 'ob-cta-5');
obBindInput('ob-nickname', 'ob-cta-6');
setupPrompts();
obBindChips('ob-purpose', 'ob-cta-9', state.purpose);
obBindChips('ob-interests', 'ob-cta-10', state.interests);

window.NRAYO = {
  signup, showScreen, sendFriendRequest, openQuiz, answerQuiz, createTrio, sendTrioMessage, createMeet,
  obNext, obPrev, sendVerifyCode, confirmVerifyCode, previewPhoto,
  saveContacts, skipContacts, rateManner,
  leaveTrioRoom, proposeCasual, showGame, submitSame5, setWhosThis, guessWhosThis,
  loadExtraCandidates, chargeStars, signInWithGoogle, adminLogin
};
window.sendFriendRequest = sendFriendRequest;
window.openQuiz = openQuiz;
window.answerQuiz = answerQuiz;
window.showScreen = showScreen;
window.openTrioRoom = openTrioRoom;
