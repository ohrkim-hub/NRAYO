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
  currentGame: null, // 'same5' | 'whosthis' | 'draw' | null
  drawPollTimer: null
};

// ---------------- 자동 로그인용 세션 저장 ----------------
const SESSION_USERID_KEY = 'nrayo_userId';
const SESSION_NICKNAME_KEY = 'nrayo_nickname';

function saveSession(userId, nickname) {
  try {
    localStorage.setItem(SESSION_USERID_KEY, userId);
    localStorage.setItem(SESSION_NICKNAME_KEY, nickname || '');
  } catch (e) { /* 저장 실패해도 로그인 자체는 계속 진행 */ }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_USERID_KEY);
    localStorage.removeItem(SESSION_NICKNAME_KEY);
  } catch (e) { /* noop */ }
}

function hideSplash() {
  const el = document.getElementById('screen-splash');
  if (el) el.classList.remove('active');
}

function showOnboarding() {
  hideSplash();
  document.getElementById('screen-onboarding').classList.add('active');
}

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
  if (name === 'feed') loadFeed();
  if (name === 'suggest') loadSuggestions();
  if (name === 'me') loadMe();
}

// ---------------- 동네생활 (게시판) ----------------
const feedState = { photoBase64: null };

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

function timeAgo(iso) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

function previewFeedPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('사진 용량은 5MB 이하로 올려주세요'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    feedState.photoBase64 = reader.result;
    const preview = document.getElementById('feed-photo-preview');
    preview.src = reader.result;
    preview.style.display = 'block';
    document.getElementById('feed-photo-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function toggleRecruitField(checked) {
  document.getElementById('feed-place-field').style.display = checked ? 'block' : 'none';
  if (!checked) {
    document.getElementById('feed-place-name').value = '';
    document.getElementById('feed-capacity').value = '';
  }
}

async function submitPost() {
  const textEl = document.getElementById('feed-compose-text');
  const text = textEl.value.trim();
  if (!text) { toast('내용을 입력해주세요'); return; }
  const isRecruit = document.getElementById('feed-recruit-toggle').checked;
  const placeName = document.getElementById('feed-place-name').value.trim();
  const capacityRaw = document.getElementById('feed-capacity').value.trim();
  if (isRecruit && !placeName) { toast('어디 가고 싶은지 장소를 입력해주세요'); return; }
  try {
    await api('/feed/posts', 'POST', {
      userId: state.userId, text, photoBase64: feedState.photoBase64,
      placeName: isRecruit ? placeName : null,
      capacity: (isRecruit && capacityRaw) ? Number(capacityRaw) : null
    });
    textEl.value = '';
    feedState.photoBase64 = null;
    document.getElementById('feed-photo-preview').style.display = 'none';
    document.getElementById('feed-photo-placeholder').style.display = 'block';
    document.getElementById('feed-photo-input').value = '';
    document.getElementById('feed-recruit-toggle').checked = false;
    document.getElementById('feed-place-name').value = '';
    document.getElementById('feed-capacity').value = '';
    document.getElementById('feed-place-field').style.display = 'none';
    toast('글이 등록됐어요');
    loadFeed();
  } catch (e) { toast(e.message); }
}

async function loadFeed() {
  const list = document.getElementById('feed-list');
  if (!list) return;
  list.innerHTML = `<div class="muted" style="text-align:center; padding:20px;">불러오는 중...</div>`;
  try {
    const data = await api('/feed/posts');
    if (!data.posts.length) {
      list.innerHTML = `<div class="empty-state">아직 글이 없어요.<br/>첫 이야기를 남겨보세요!</div>`;
      return;
    }
    list.innerHTML = data.posts.map(renderPostCard).join('');
  } catch (e) {
    list.innerHTML = `<div class="empty-state">글을 불러오지 못했어요.</div>`;
  }
}

function renderPostCard(post) {
  const likedBy = post.likedBy || [];
  const liked = likedBy.includes(state.userId);
  const isMine = post.userId === state.userId;
  const isRecruit = post.postType === 'recruit';
  const participants = post.participants || [];
  const joined = participants.some(p => p.userId === state.userId);

  const capacity = post.capacity || null;
  const isFull = capacity ? participants.length >= capacity : false;
  const capacityLabel = capacity ? ` / 최대 ${capacity}명` : '';
  const recruitBlock = isRecruit ? `
      <div style="margin-top:10px; background:var(--surface-soft); border-radius:var(--radius-sm); padding:10px 12px;">
        <div style="font-weight:800; color:var(--accent-dark); font-size:13px;">🙋 같이가요 · ${escapeHtml(post.placeName || '')}${capacityLabel}</div>
        <div class="muted" data-role="join-names" style="margin-top:4px; font-size:12px;">
          ${participants.length > 0 ? participants.map(p => escapeHtml(p.nickname)).join(', ') + '님 참여중' : '아직 참여자가 없어요'}
        </div>
        <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
          <button class="btn ${joined ? 'btn-outline' : 'btn-primary'} btn-sm"
            data-role="join-btn" data-count="${participants.length}" data-capacity="${capacity || ''}"
            ${(!joined && isFull) ? 'disabled' : ''}
            onclick="NRAYO.toggleJoin('${post.id}')">${joined ? '참여 취소하기' : (isFull ? '인원 마감' : '참여하기')} (${participants.length}${capacity ? '/' + capacity : ''}명)</button>
          <button class="btn btn-ghost btn-sm" data-role="chat-btn" style="display:${joined ? 'inline-flex' : 'none'};"
            onclick="NRAYO.toggleRoomChat('${post.id}')">💬 모임방 채팅</button>
        </div>
        <div id="room-chat-${post.id}" style="display:none; margin-top:10px;"></div>
      </div>` : '';

  return `
    <div class="card" id="post-${post.id}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-weight:800;">${escapeHtml(post.nickname)}</div>
          <div class="muted">${post.region ? escapeHtml(post.region) + ' · ' : ''}${timeAgo(post.createdAt)}</div>
        </div>
        ${isMine
          ? `<button class="btn btn-ghost btn-sm" onclick="NRAYO.deletePost('${post.id}')">삭제</button>`
          : `<button class="btn btn-ghost btn-sm" onclick="NRAYO.reportPost('${post.id}','${post.userId}')">신고</button>`}
      </div>
      <div style="margin-top:10px; white-space:pre-wrap; font-size:14px; line-height:1.5;">${escapeHtml(post.text)}</div>
      ${post.photoUrl ? `<img src="${post.photoUrl}" style="width:100%; border-radius:var(--radius-sm); margin-top:10px;" />` : ''}
      ${recruitBlock}
      <div style="display:flex; gap:10px; margin-top:12px;">
        <button class="btn btn-ghost btn-sm" data-role="like-btn" data-count="${likedBy.length}" onclick="NRAYO.toggleLike('${post.id}')">${liked ? '💛' : '🤍'} 좋아요 ${likedBy.length}</button>
        <button class="btn btn-ghost btn-sm" data-role="comment-count" data-count="${post.commentCount || 0}" onclick="NRAYO.toggleComments('${post.id}')">💬 댓글 ${post.commentCount || 0}</button>
      </div>
      <div id="comments-${post.id}" style="display:none; margin-top:10px;"></div>
    </div>`;
}

async function toggleLike(postId) {
  try {
    const result = await api(`/feed/posts/${postId}/like`, 'POST', { userId: state.userId });
    const btn = document.querySelector(`#post-${postId} [data-role="like-btn"]`);
    if (btn) {
      let count = parseInt(btn.dataset.count || '0', 10);
      count = result.liked ? count + 1 : Math.max(0, count - 1);
      btn.dataset.count = count;
      btn.textContent = `${result.liked ? '💛' : '🤍'} 좋아요 ${count}`;
    }
  } catch (e) { toast(e.message); }
}

async function toggleJoin(postId) {
  try {
    const result = await api(`/feed/posts/${postId}/join`, 'POST', { userId: state.userId });
    const card = document.getElementById(`post-${postId}`);
    if (!card) return;
    const participants = result.participants || [];
    const joined = participants.some(p => p.userId === state.userId);
    const namesEl = card.querySelector('[data-role="join-names"]');
    if (namesEl) {
      namesEl.textContent = participants.length > 0
        ? participants.map(p => p.nickname).join(', ') + '님 참여중'
        : '아직 참여자가 없어요';
    }
    const btn = card.querySelector('[data-role="join-btn"]');
    if (btn) {
      const capacity = Number(btn.dataset.capacity) || null;
      const isFull = capacity ? participants.length >= capacity : false;
      btn.textContent = `${joined ? '참여 취소하기' : (isFull ? '인원 마감' : '참여하기')} (${participants.length}${capacity ? '/' + capacity : ''}명)`;
      btn.dataset.count = participants.length;
      btn.classList.toggle('btn-primary', !joined);
      btn.classList.toggle('btn-outline', joined);
      btn.disabled = !joined && isFull;
    }
    const chatBtn = card.querySelector('[data-role="chat-btn"]');
    if (chatBtn) chatBtn.style.display = joined ? 'inline-flex' : 'none';
    if (!joined) {
      // 참여 취소하면 모임방 채팅 접근 권한도 없어지므로 열려있던 채팅창은 닫아줌
      const chatBox = document.getElementById(`room-chat-${postId}`);
      if (chatBox) chatBox.style.display = 'none';
    }
  } catch (e) { toast(e.message); }
}

async function toggleRoomChat(postId) {
  const box = document.getElementById(`room-chat-${postId}`);
  if (!box) return;
  const isOpen = box.style.display !== 'none';
  if (isOpen) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  await renderRoomChat(postId);
}

async function renderRoomChat(postId) {
  const box = document.getElementById(`room-chat-${postId}`);
  if (!box) return;
  box.innerHTML = `<div class="muted">불러오는 중...</div>`;
  try {
    const data = await api(`/feed/posts/${postId}/room/messages?userId=${encodeURIComponent(state.userId)}`);
    const messagesHtml = data.messages.map(m => `
      <div style="padding:8px 0; border-bottom:1px solid var(--line);">
        <div style="font-weight:700; font-size:13px;">${escapeHtml(m.nickname)}</div>
        <div style="font-size:13px;">${escapeHtml(m.text)}</div>
      </div>`).join('') || `<div class="muted" style="padding:6px 0;">아직 대화가 없어요. 먼저 인사해보세요!</div>`;
    box.innerHTML = `<div class="draw-guess-feed" style="max-height:200px;">${messagesHtml}</div>
      <div style="display:flex; gap:8px; margin-top:8px;">
        <input type="text" id="room-chat-input-${postId}" placeholder="모임방에 메시지 보내기" style="flex:1;" />
        <button class="btn btn-primary btn-sm" onclick="NRAYO.submitRoomChat('${postId}')">전송</button>
      </div>`;
  } catch (e) {
    box.innerHTML = `<div class="muted">${escapeHtml(e.message)}</div>`;
  }
}

async function submitRoomChat(postId) {
  const input = document.getElementById(`room-chat-input-${postId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  try {
    await api(`/feed/posts/${postId}/room/messages`, 'POST', { userId: state.userId, text });
    await renderRoomChat(postId);
  } catch (e) { toast(e.message); }
}

async function toggleComments(postId) {
  const box = document.getElementById(`comments-${postId}`);
  if (!box) return;
  const isOpen = box.style.display !== 'none';
  if (isOpen) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  await renderComments(postId);
}

async function renderComments(postId) {
  const box = document.getElementById(`comments-${postId}`);
  if (!box) return;
  box.innerHTML = `<div class="muted">불러오는 중...</div>`;
  try {
    const data = await api(`/feed/posts/${postId}/comments`);
    const commentsHtml = data.comments.map(c => `
      <div style="padding:8px 0; border-bottom:1px solid var(--line);">
        <div style="font-weight:700; font-size:13px;">${escapeHtml(c.nickname)}</div>
        <div style="font-size:13px;">${escapeHtml(c.text)}</div>
      </div>`).join('') || `<div class="muted" style="padding:6px 0;">아직 댓글이 없어요.</div>`;
    box.innerHTML = `${commentsHtml}
      <div style="display:flex; gap:8px; margin-top:8px;">
        <input type="text" id="comment-input-${postId}" placeholder="댓글 달기" style="flex:1;" />
        <button class="btn btn-primary btn-sm" onclick="NRAYO.submitComment('${postId}')">등록</button>
      </div>`;
  } catch (e) {
    box.innerHTML = `<div class="muted">댓글을 불러오지 못했어요.</div>`;
  }
}

async function submitComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  try {
    await api(`/feed/posts/${postId}/comments`, 'POST', { userId: state.userId, text });
    await renderComments(postId);
    const countBtn = document.querySelector(`#post-${postId} [data-role="comment-count"]`);
    if (countBtn) {
      const count = parseInt(countBtn.dataset.count || '0', 10) + 1;
      countBtn.dataset.count = count;
      countBtn.textContent = `💬 댓글 ${count}`;
    }
  } catch (e) { toast(e.message); }
}

async function deletePost(postId) {
  if (!confirm('이 글을 삭제할까요?')) return;
  try {
    await api(`/feed/posts/${postId}`, 'DELETE', { userId: state.userId });
    toast('삭제됐어요');
    loadFeed();
  } catch (e) { toast(e.message); }
}

async function reportPost(postId, targetUserId) {
  if (!confirm('이 글을 신고할까요? 신고 시 작성자와의 상호작용이 즉시 제한돼요.')) return;
  try {
    await api('/safety/report', 'POST', { fromUserId: state.userId, targetUserId, reason: '기타', postId });
    toast('신고가 접수됐어요');
  } catch (e) { toast(e.message); }
}

// ---------------- 건의사항 (유저가 만들어가는 앱) ----------------
const SUGGESTION_STATUS_COLOR = {
  '신규': 'var(--text-soft)',
  '검토중': 'var(--accent-dark)',
  '반영 예정': 'var(--accent-dark)',
  '반영 완료': 'var(--success)',
  '보류': 'var(--text-soft)'
};

function getSelectedSuggestCategory() {
  const selected = document.querySelector('#suggest-category-chips .chip.selected');
  return selected ? selected.dataset.v : '기타';
}

async function submitSuggestion() {
  const textEl = document.getElementById('suggest-compose-text');
  const text = textEl.value.trim();
  if (!text) { toast('내용을 입력해주세요'); return; }
  const category = getSelectedSuggestCategory();
  try {
    await api('/suggestions', 'POST', { userId: state.userId, text, category });
    textEl.value = '';
    toast('건의해주셔서 감사해요!');
    loadSuggestions();
  } catch (e) { toast(e.message); }
}

async function loadSuggestions() {
  const list = document.getElementById('suggest-list');
  if (!list) return;
  list.innerHTML = `<div class="muted" style="text-align:center; padding:20px;">불러오는 중...</div>`;
  try {
    const data = await api('/suggestions');
    if (!data.suggestions.length) {
      list.innerHTML = `<div class="empty-state">아직 건의사항이 없어요.<br/>첫 의견을 남겨보세요!</div>`;
      return;
    }
    list.innerHTML = data.suggestions.map(renderSuggestionCard).join('');
  } catch (e) {
    list.innerHTML = `<div class="empty-state">불러오지 못했어요.</div>`;
  }
}

function renderSuggestionCard(s) {
  const likedBy = s.likedBy || [];
  const liked = likedBy.includes(state.userId);
  const isMine = s.userId === state.userId;
  const statusColor = SUGGESTION_STATUS_COLOR[s.status] || 'var(--text-soft)';
  return `
    <div class="card" id="suggest-${s.id}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <span class="tag">${escapeHtml(s.category)}</span>
          <span class="state-pill" style="margin-left:6px; background:transparent; border:1px solid ${statusColor}; color:${statusColor};">${escapeHtml(s.status)}</span>
        </div>
        ${isMine
          ? `<button class="btn btn-ghost btn-sm" onclick="NRAYO.deleteSuggestion('${s.id}')">삭제</button>`
          : `<button class="btn btn-ghost btn-sm" onclick="NRAYO.reportSuggestion('${s.id}','${s.userId}')">신고</button>`}
      </div>
      <div class="muted" style="margin-top:6px;">${escapeHtml(s.nickname)} · ${timeAgo(s.createdAt)}</div>
      <div style="margin-top:8px; white-space:pre-wrap; font-size:14px; line-height:1.5;">${escapeHtml(s.text)}</div>
      <div style="display:flex; gap:10px; margin-top:12px;">
        <button class="btn btn-ghost btn-sm" data-role="slike-btn" data-count="${likedBy.length}" onclick="NRAYO.toggleSuggestionLike('${s.id}')">${liked ? '💛' : '🤍'} 저도 원해요 ${likedBy.length}</button>
        <button class="btn btn-ghost btn-sm" data-role="scomment-count" data-count="${s.commentCount || 0}" onclick="NRAYO.toggleSuggestionComments('${s.id}')">💬 댓글 ${s.commentCount || 0}</button>
      </div>
      <div id="scomments-${s.id}" style="display:none; margin-top:10px;"></div>
    </div>`;
}

async function toggleSuggestionLike(id) {
  try {
    const result = await api(`/suggestions/${id}/like`, 'POST', { userId: state.userId });
    const btn = document.querySelector(`#suggest-${id} [data-role="slike-btn"]`);
    if (btn) {
      let count = parseInt(btn.dataset.count || '0', 10);
      count = result.liked ? count + 1 : Math.max(0, count - 1);
      btn.dataset.count = count;
      btn.textContent = `${result.liked ? '💛' : '🤍'} 저도 원해요 ${count}`;
    }
  } catch (e) { toast(e.message); }
}

async function toggleSuggestionComments(id) {
  const box = document.getElementById(`scomments-${id}`);
  if (!box) return;
  const isOpen = box.style.display !== 'none';
  if (isOpen) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  await renderSuggestionComments(id);
}

async function renderSuggestionComments(id) {
  const box = document.getElementById(`scomments-${id}`);
  if (!box) return;
  box.innerHTML = `<div class="muted">불러오는 중...</div>`;
  try {
    const data = await api(`/suggestions/${id}/comments`);
    const commentsHtml = data.comments.map(c => `
      <div style="padding:8px 0; border-bottom:1px solid var(--line);">
        <div style="font-weight:700; font-size:13px;">${escapeHtml(c.nickname)}</div>
        <div style="font-size:13px;">${escapeHtml(c.text)}</div>
      </div>`).join('') || `<div class="muted" style="padding:6px 0;">아직 댓글이 없어요.</div>`;
    box.innerHTML = `${commentsHtml}
      <div style="display:flex; gap:8px; margin-top:8px;">
        <input type="text" id="scomment-input-${id}" placeholder="댓글 달기" style="flex:1;" />
        <button class="btn btn-primary btn-sm" onclick="NRAYO.submitSuggestionComment('${id}')">등록</button>
      </div>`;
  } catch (e) {
    box.innerHTML = `<div class="muted">댓글을 불러오지 못했어요.</div>`;
  }
}

async function submitSuggestionComment(id) {
  const input = document.getElementById(`scomment-input-${id}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  try {
    await api(`/suggestions/${id}/comments`, 'POST', { userId: state.userId, text });
    await renderSuggestionComments(id);
    const countBtn = document.querySelector(`#suggest-${id} [data-role="scomment-count"]`);
    if (countBtn) {
      const count = parseInt(countBtn.dataset.count || '0', 10) + 1;
      countBtn.dataset.count = count;
      countBtn.textContent = `💬 댓글 ${count}`;
    }
  } catch (e) { toast(e.message); }
}

async function deleteSuggestion(id) {
  if (!confirm('이 건의글을 삭제할까요?')) return;
  try {
    await api(`/suggestions/${id}`, 'DELETE', { userId: state.userId });
    toast('삭제됐어요');
    loadSuggestions();
  } catch (e) { toast(e.message); }
}

async function reportSuggestion(id, targetUserId) {
  if (!confirm('이 글을 신고할까요? 신고 시 작성자와의 상호작용이 즉시 제한돼요.')) return;
  try {
    await api('/safety/report', 'POST', { fromUserId: state.userId, targetUserId, reason: '기타', postId: id });
    toast('신고가 접수됐어요');
  } catch (e) { toast(e.message); }
}

// ---------------- 관리자로 바로 앱 진입 ----------------
async function adminLogin() {
  const key = prompt('관리자 키를 입력해주세요');
  if (!key) return;
  try {
    const result = await api('/auth/admin-login', 'POST', { key });
    state.userId = result.userId;
    state.nickname = result.nickname;
    saveSession(result.userId, result.nickname);
    document.getElementById('me-nickname-label').textContent = result.nickname + '님';
    document.getElementById('screen-onboarding').classList.remove('active');
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('tabbar').style.display = 'flex';
    toast('관리자로 입장했어요 (별 무한)');
    loadToday();
    registerFcmToken();
  } catch (e) {
    toast(e.message);
  }
}

// ---------------- 현재 위치로 지역 찾기 ----------------
function useCurrentLocation() {
  if (!navigator.geolocation) {
    toast('이 브라우저는 위치 기능을 지원하지 않아요');
    return;
  }
  const btn = document.getElementById('btn-use-location');
  btn.disabled = true;
  btn.textContent = '위치 확인 중...';

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const result = await api('/geocode/reverse', 'POST', { lat: latitude, lng: longitude });
        document.getElementById('ob-region').value = result.region;
        document.getElementById('ob-region').dispatchEvent(new Event('input'));
        toast('현재 위치를 찾았어요');
      } catch (e) {
        toast(e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = '📍 현재 위치로 찾기';
      }
    },
    () => {
      toast('위치 권한을 허용해주셔야 사용할 수 있어요');
      btn.disabled = false;
      btn.textContent = '📍 현재 위치로 찾기';
    }
  );
}

// ---------------- 알림(FCM) 토큰 등록 ----------------
// VAPID 키가 설정 안 돼있거나 브라우저가 지원 안 하거나 권한을 거부해도 앱 사용에는 지장 없도록 전부 조용히 실패 처리
let fcmForegroundHandlerRegistered = false;
async function registerFcmToken() {
  try {
    if (typeof FCM_VAPID_KEY === 'undefined' || !FCM_VAPID_KEY) return; // README 안내대로 Firebase 콘솔에서 VAPID 키 발급 전이면 알림 기능 자동 비활성
    if (!('serviceWorker' in navigator) || typeof firebase === 'undefined' || !firebase.messaging) return;
    if (!('Notification' in window)) return;

    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const swRegistration = await navigator.serviceWorker.ready;
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: swRegistration });
    if (!token || !state.userId) return;

    await api('/auth/fcm-token', 'POST', { userId: state.userId, token });

    if (!fcmForegroundHandlerRegistered) {
      fcmForegroundHandlerRegistered = true;
      messaging.onMessage((payload) => {
        const body = (payload.notification && payload.notification.body) || '새 알림이 도착했어요';
        toast(body);
      });
    }
  } catch (e) {
    console.warn('알림 토큰 등록 실패(무시하고 진행):', e.message);
  }
}

// ---------------- 구글 로그인 ----------------
// 이미 가입된 계정으로 바로 로그인 처리 (온보딩 건너뛰기)
function enterAppAsExistingUser(userId, nickname, opts = {}) {
  state.userId = userId;
  state.nickname = nickname;
  saveSession(userId, nickname);
  hideSplash();
  document.getElementById('me-nickname-label').textContent = nickname + '님';
  document.getElementById('screen-onboarding').classList.remove('active');
  document.getElementById('main-app').style.display = 'flex';
  document.getElementById('tabbar').style.display = 'flex';
  if (!opts.silent) toast(`${nickname}님, 다시 오셨네요!`);
  loadToday();
  registerFcmToken();
}

// ---------------- 로그아웃 ----------------
function logout() {
  clearSession();
  try { firebase.auth().signOut(); } catch (e) { /* noop */ }
  location.reload();
}

function fromE164Local(e164Phone) {
  return e164Phone.replace(/^\+82/, '0');
}

// ---------------- 앱 시작 시 자동 로그인 시도 ----------------
async function initAutoLogin() {
  let settled = false;
  const finishOnboarding = () => { if (!settled) { settled = true; showOnboarding(); } };
  // 안전장치: 어떤 이유로든 확인이 오래 걸리면 온보딩 화면으로 넘어감
  const timeoutId = setTimeout(finishOnboarding, 4000);

  const savedUserId = localStorage.getItem(SESSION_USERID_KEY);
  if (savedUserId) {
    try {
      const data = await api(`/auth/me/${savedUserId}`);
      if (data.user && !data.user.banned) {
        settled = true;
        clearTimeout(timeoutId);
        enterAppAsExistingUser(data.user.id, data.user.nickname, { silent: true });
        return;
      }
      clearSession();
    } catch (e) {
      clearSession();
    }
  }

  // localStorage에 저장된 세션이 없거나 무효한 경우, Firebase에 남아있는 인증 세션으로 한 번 더 시도
  try {
    firebase.auth().onAuthStateChanged(async (fbUser) => {
      if (settled) return;
      if (!fbUser) { clearTimeout(timeoutId); finishOnboarding(); return; }
      try {
        let existing = null;
        if (fbUser.phoneNumber) {
          existing = await api(`/auth/by-phone/${fromE164Local(fbUser.phoneNumber)}`);
        } else {
          const isGoogle = fbUser.providerData.some(p => p.providerId === 'google.com');
          if (isGoogle) existing = await api(`/auth/by-google/${fbUser.uid}`);
        }
        if (!existing) { clearTimeout(timeoutId); finishOnboarding(); return; }
        // 정지(banned)된 계정은 자동 로그인시켜주지 않도록 최신 상태를 한 번 더 확인
        const meData = await api(`/auth/me/${existing.userId}`);
        clearTimeout(timeoutId);
        if (meData.user && !meData.user.banned && !settled) {
          settled = true;
          enterAppAsExistingUser(meData.user.id, meData.user.nickname, { silent: true });
        } else {
          finishOnboarding();
        }
      } catch (e) {
        clearTimeout(timeoutId);
        finishOnboarding();
      }
    });
  } catch (e) {
    clearTimeout(timeoutId);
    finishOnboarding();
  }
}

async function signInWithGoogle() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await firebase.auth().signInWithPopup(provider);
    const googleUser = result.user;

    // 이미 가입된 계정인지 확인 -> 있으면 온보딩 건너뛰고 바로 로그인
    try {
      const existing = await api(`/auth/by-google/${googleUser.uid}`);
      enterAppAsExistingUser(existing.userId, existing.nickname);
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
const obState = { currentStep: 0, totalSteps: 10, termsAgreed: false, gender: null, photoBase64: null, googleUid: null, googleEmail: null, phoneIdToken: null };

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

// ---------------- 휴대폰 인증 (Firebase Phone Auth) ----------------
let confirmationResult = null;
let recaptchaVerifier = null;

function toE164(phone) {
  return '+82' + phone.replace(/^0/, '');
}

function getRecaptchaVerifier() {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { size: 'invisible' });
  }
  return recaptchaVerifier;
}

async function sendVerifyCode() {
  const phone = document.getElementById('ob-phone').value.trim();
  if (!/^01[0-9]{8,9}$/.test(phone)) {
    toast('올바른 휴대폰 번호를 입력해주세요');
    return;
  }
  try {
    const appVerifier = getRecaptchaVerifier();
    confirmationResult = await firebase.auth().signInWithPhoneNumber(toE164(phone), appVerifier);

    document.getElementById('verify-code-area').style.display = 'block';
    document.getElementById('verify-desc').textContent = `${phone}로 인증번호를 보냈어요`;
    document.getElementById('ob-code').value = '';
    document.getElementById('ob-cta-2').disabled = true;
    toast('인증번호를 문자로 보냈어요');
  } catch (e) {
    console.error(e);
    toast('인증번호 발송에 실패했어요: ' + (e.message || ''));
    if (recaptchaVerifier) { recaptchaVerifier.render().then(id => grecaptcha.reset(id)); }
  }
}

async function confirmVerifyCode() {
  const phone = document.getElementById('ob-phone').value.trim();
  const code = document.getElementById('ob-code').value.trim();
  if (!code) { toast('인증번호를 입력해주세요'); return; }
  if (!confirmationResult) { toast('인증번호를 먼저 받아주세요'); return; }
  try {
    const result = await confirmationResult.confirm(code);
    obState.phoneIdToken = await result.user.getIdToken();

    // 이미 가입된 번호인지 확인 -> 있으면 온보딩 건너뛰고 바로 로그인
    try {
      const existing = await api(`/auth/by-phone/${phone}`);
      enterAppAsExistingUser(existing.userId, existing.nickname);
      return;
    } catch (notFoundErr) {
      // 가입 이력 없음 -> 신규 가입 흐름으로 계속 진행
    }

    toast('휴대폰 인증이 완료됐어요');
    obNext();
  } catch (e) {
    console.error(e);
    toast('인증번호가 올바르지 않아요');
  }
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

  const referralCodeEl = document.getElementById('ob-referral-code');
  const referralCode = referralCodeEl ? referralCodeEl.value.trim() : '';

  try {
    const result = await api('/auth/signup', 'POST', {
      phone, birthYear, region, nickname, prompts,
      gender: obState.gender || '선택안함',
      termsAgreed: obState.termsAgreed,
      googleUid: obState.googleUid,
      googleEmail: obState.googleEmail,
      phoneIdToken: obState.phoneIdToken,
      interests: Array.from(state.interests),
      purpose: Array.from(state.purpose),
      referralCode: referralCode || null
    });
    state.userId = result.userId;
    state.nickname = nickname;
    saveSession(result.userId, nickname);

    if (obState.photoBase64) {
      try { await api('/auth/photo', 'POST', { userId: result.userId, imageBase64: obState.photoBase64 }); }
      catch (e) { console.warn('사진 업로드 실패:', e.message); }
    }

    document.getElementById('me-nickname-label').textContent = nickname + '님';
    document.getElementById('screen-onboarding').classList.remove('active');
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('tabbar').style.display = 'flex';
    if (result.referralBonus > 0) {
      toast(`너랑요에 오신 걸 환영해요! 초대 보너스 별 ${result.referralBonus}개 지급 🎁`);
    } else {
      toast('너랑요에 오신 걸 환영해요!');
    }
    showContactsPromptCard();
    loadToday();
    registerFcmToken();
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
    list.innerHTML += `<button class="btn btn-premium" id="extra-candidates-btn" onclick="NRAYO.loadExtraCandidates()">⚡ 실시간 새 추천 받기 (⭐3)</button>`;
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
    list.insertAdjacentHTML('beforeend', `<button class="btn btn-premium" id="extra-candidates-btn" onclick="NRAYO.loadExtraCandidates()">⚡ 실시간 새 추천 받기 (⭐3)</button>`);

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
      ${c.boosted ? `<span class="state-tag" style="left:auto; right:10px; background:rgba(232,130,90,0.9);">🔥 우선노출</span>` : ''}
      ${photoBlock}
    </div>
    <div class="person-body">
      <div class="person-name">${c.nickname} · ${c.birthYear} ${mannerBadge}</div>
      <div class="person-meta">${c.region}</div>
      ${purposeBadges ? `<div class="purpose-icon-row">${purposeBadges}</div>` : ''}
      <div class="tag-row">${(c.interests || []).map(i => `<span class="tag">${i}</span>`).join('')}</div>
      ${promptBlock}
      <div style="margin-top:12px;">${actionBtn}
        <button class="btn btn-ghost btn-sm" style="margin-top:6px;" onclick="NRAYO.getIcebreaker('${c.userId}','${c.nickname}')">🤖 AI 대화 주제 추천 (⭐2)</button>
      </div>
      <div id="icebreaker-${c.userId}"></div>
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

  const list = document.getElementById('chat-list');
  try {
    const data = await api(`/trio/list/${state.userId}`);
    if (!data.rooms.length) {
      list.innerHTML = `<div class="empty-state">아직 대화가 없어요.<br/>Today's 2에서 친구를 만들면 자동으로 채팅방이 생겨요.</div>`;
      return;
    }
    list.innerHTML = data.rooms.map(r => `
      <div class="card" style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; cursor:pointer;" onclick="NRAYO.openTrioRoom('${r.roomId}')">
        <div>
          <div style="font-weight:800;">${r.isDM ? '' : (r.isFiveChat ? '💛 ' : '👥 ')}${r.title}</div>
          <div class="muted" style="margin-top:2px; font-size:13px;">${r.lastMessageText || '대화를 시작해보세요'}</div>
        </div>
        <span class="muted" style="font-size:11px;">${(r.lastMessageAt || '').slice(5, 10)}</span>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = `<p class="muted">채팅 목록을 불러오지 못했어요.</p>`;
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
  if (state.drawPollTimer) { clearInterval(state.drawPollTimer); state.drawPollTimer = null; }
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
  if (state.drawPollTimer) { clearInterval(state.drawPollTimer); state.drawPollTimer = null; }
  const area = document.getElementById('game-area');
  if (!name) { area.innerHTML = ''; return; }
  if (name === 'same5') return renderSame5();
  if (name === 'whosthis') return renderWhosThis();
  if (name === 'draw') return renderDraw();
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

// ---------------- 그림 맞추기 (캐치마인드 스타일) ----------------
async function renderDraw() {
  const area = document.getElementById('game-area');
  const data = await api(`/trio/${state.currentTrioRoom}/game/draw?userId=${state.userId}`);

  if (!data.round) {
    area.innerHTML = `
      <div class="muted" style="margin-bottom:8px;">아직 시작된 라운드가 없어요. 누군가 그림을 그리면 다른 멤버가 맞혀요!</div>
      <button class="btn btn-primary btn-sm" onclick="NRAYO.startDraw()">🎨 내가 그릴래요 (라운드 시작)</button>
    `;
    return;
  }

  const isDrawer = data.round.drawerUserId === state.userId;
  const solved = !!data.round.correctUserId;

  if (isDrawer) {
    area.innerHTML = `
      <div style="font-weight:800; margin-bottom:6px;">🎨 그릴 단어: <span style="color:var(--accent-dark);">${escapeHtml(data.round.word)}</span></div>
      <canvas id="draw-canvas" class="draw-canvas" width="300" height="200"></canvas>
      <div style="display:flex; gap:8px; margin-top:8px;">
        <button class="btn btn-outline btn-sm" onclick="NRAYO.clearDrawCanvas()">지우기</button>
        <button class="btn btn-ghost btn-sm" onclick="NRAYO.startDraw()">다른 단어로 새로 시작</button>
      </div>
      <div id="draw-guess-feed" class="draw-guess-feed"></div>
    `;
    setupDrawCanvas();
  } else {
    area.innerHTML = `
      <div class="muted" style="margin-bottom:6px;">누군가 그림을 그리고 있어요. 뭘까요?</div>
      <img id="draw-view-img" class="draw-canvas" style="object-fit:contain;" src="${data.round.imageBase64 || ''}" />
      ${solved
        ? `<div style="margin-top:8px; font-weight:800; color:var(--accent-dark);">정답: ${escapeHtml(data.round.word)}</div>
           <button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="NRAYO.startDraw()">내가 그릴래요 (새 라운드)</button>`
        : `<div style="display:flex; gap:8px; margin-top:8px;">
             <input type="text" id="draw-guess-input" placeholder="정답 추측" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:1.5px solid var(--line);" />
             <button class="btn btn-primary btn-sm" onclick="NRAYO.submitDrawGuess()">제출</button>
           </div>`}
      <div id="draw-guess-feed" class="draw-guess-feed"></div>
    `;
  }

  renderDrawGuesses(data.guesses);

  if (!solved) {
    if (state.drawPollTimer) clearInterval(state.drawPollTimer);
    state.drawPollTimer = setInterval(pollDraw, 2000); // 2초마다 그림/추측 폴링 (실시간에 가깝게)
  }
}

async function pollDraw() {
  if (!state.currentTrioRoom || state.currentGame !== 'draw') {
    if (state.drawPollTimer) { clearInterval(state.drawPollTimer); state.drawPollTimer = null; }
    return;
  }
  try {
    const data = await api(`/trio/${state.currentTrioRoom}/game/draw?userId=${state.userId}`);
    if (!data.round) { clearInterval(state.drawPollTimer); state.drawPollTimer = null; return; }

    renderDrawGuesses(data.guesses);
    const isDrawer = data.round.drawerUserId === state.userId;
    if (!isDrawer) {
      const img = document.getElementById('draw-view-img');
      if (img && data.round.imageBase64) img.src = data.round.imageBase64;
    }

    if (data.round.correctUserId) {
      clearInterval(state.drawPollTimer);
      state.drawPollTimer = null;
      renderDraw(); // 정답 공개 화면으로 전환
    }
  } catch (e) { /* 폴링 실패는 조용히 무시하고 다음 주기에 재시도 */ }
}

function renderDrawGuesses(guesses) {
  const feed = document.getElementById('draw-guess-feed');
  if (!feed) return;
  feed.innerHTML = guesses.length
    ? guesses.slice().reverse().map(g => `
        <div class="draw-guess-item ${g.correct ? 'correct' : ''}">${g.correct ? '✅' : '💬'} ${escapeHtml(g.nickname || '익명')}: ${escapeHtml(g.guess)}</div>
      `).join('')
    : `<div class="muted">아직 추측이 없어요</div>`;
}

async function startDraw() {
  try {
    await api(`/trio/${state.currentTrioRoom}/game/draw/start`, 'POST', { userId: state.userId });
    toast('새 라운드가 시작됐어요! 그려보세요 🎨');
    renderDraw();
  } catch (e) { toast(e.message); }
}

function setupDrawCanvas() {
  const canvas = document.getElementById('draw-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#4A342E';
  let drawing = false;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  canvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
  const endStroke = () => {
    if (!drawing) return;
    drawing = false;
    uploadDrawSnapshot();
  };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointerleave', endStroke);
}

async function uploadDrawSnapshot() {
  const canvas = document.getElementById('draw-canvas');
  if (!canvas) return;
  try {
    const imageBase64 = canvas.toDataURL('image/png');
    await api(`/trio/${state.currentTrioRoom}/game/draw/update`, 'POST', { userId: state.userId, imageBase64 });
  } catch (e) { /* 업로드 한 번 실패해도 계속 그릴 수 있게 조용히 무시 */ }
}

function clearDrawCanvas() {
  const canvas = document.getElementById('draw-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  uploadDrawSnapshot();
}

async function submitDrawGuess() {
  const input = document.getElementById('draw-guess-input');
  const guess = input.value.trim();
  if (!guess) return;
  try {
    const result = await api(`/trio/${state.currentTrioRoom}/game/draw/guess`, 'POST', {
      userId: state.userId, nickname: state.nickname || '', guess
    });
    input.value = '';
    if (result.correct) {
      toast('🎉 정답이에요!');
      renderDraw();
    } else {
      toast('아쉽지만 틀렸어요');
      const data = await api(`/trio/${state.currentTrioRoom}/game/draw?userId=${state.userId}`);
      renderDrawGuesses(data.guesses);
    }
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

  const kakaoInput = document.getElementById('kakao-id-input');
  if (kakaoInput && !kakaoInput.matches(':focus')) kakaoInput.value = data.user.kakaoId || '';

  let exchanges = [];
  try {
    const exData = await api(`/kakao/exchanges/${state.userId}`);
    exchanges = exData.exchanges || [];
  } catch (e) { /* 조회 실패해도 친구 목록 자체는 보여줌 */ }

  const friendListEl = document.getElementById('me-friends-list');
  if (friendListEl) {
    friendListEl.innerHTML = state.friends.length
      ? state.friends.map(f => `
          <div class="card" style="display:flex; flex-direction:column; gap:8px; padding:12px 16px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="font-weight:700;">${f.nickname}</span>
              <button class="btn btn-ghost btn-sm" onclick="NRAYO.rateManner('${f.userId}','${f.nickname}')">매너 평가하기</button>
            </div>
            <div data-role="kakao-exchange-area">${renderKakaoExchangeArea(f, exchanges)}</div>
          </div>`).join('')
      : `<p class="muted">아직 친구가 없어요.</p>`;
  }

  await loadStarPackages();
  renderBoostCard(data.profile.boostedUntil);
  renderReferralCard();
}

// ---------------- 친구 초대 (추천인 코드) ----------------
async function renderReferralCard() {
  const card = document.getElementById('referral-card');
  if (!card) return;
  try {
    const data = await api(`/auth/referral/${state.userId}`);
    const shareUrl = `${location.origin}${location.pathname}?ref=${data.referralCode}`;
    card.innerHTML = `
      <div class="muted" style="margin-bottom:8px;">친구가 내 코드로 가입하면 나는 ⭐${data.referrerReward}개, 친구는 가입 축하 ⭐${data.newUserBonus}개를 추가로 받아요.</div>
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="font-size:22px; font-weight:800; letter-spacing:2px; color:var(--accent-dark);">${data.referralCode}</div>
        <button class="btn btn-outline btn-sm" onclick="NRAYO.copyReferralCode('${data.referralCode}')">코드 복사</button>
      </div>
      <button class="btn btn-premium btn-sm" style="margin-top:10px;" onclick="NRAYO.copyReferralLink('${shareUrl}')">🔗 초대 링크 복사해서 공유하기</button>
      <div class="muted" style="margin-top:10px; font-size:12px;">지금까지 ${data.referredCount}명 초대함</div>
    `;
  } catch (e) {
    card.innerHTML = `<div class="muted">초대 코드를 불러오지 못했어요.</div>`;
  }
}

function copyToClipboardCompat(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // 클립보드 API를 못 쓰는 환경(구형 브라우저 등)을 위한 대체 방법
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try { document.execCommand('copy'); } catch (e) { /* noop */ }
  document.body.removeChild(textarea);
  return Promise.resolve();
}

async function copyReferralCode(code) {
  try { await copyToClipboardCompat(code); toast('초대 코드를 복사했어요'); }
  catch (e) { toast('복사에 실패했어요'); }
}

async function copyReferralLink(url) {
  try { await copyToClipboardCompat(url); toast('초대 링크를 복사했어요'); }
  catch (e) { toast('복사에 실패했어요'); }
}

// ---------------- 카카오톡 ID 교환 (유료, 상호 동의) ----------------
function findKakaoExchange(friendUserId, exchanges) {
  return exchanges.find(ex => ex.fromUserId === friendUserId || ex.toUserId === friendUserId) || null;
}

function renderKakaoExchangeArea(friend, exchanges) {
  const ex = findKakaoExchange(friend.userId, exchanges);

  if (!ex) {
    return `<button class="btn btn-premium btn-sm" onclick="NRAYO.requestKakaoExchange('${friend.userId}')">✨ 카톡 교환 요청 (⭐5)</button>`;
  }
  if (ex.status === 'PENDING' && ex.fromUserId === state.userId) {
    return `<span class="premium-badge">요청 보냄 · 수락 대기중</span>`;
  }
  if (ex.status === 'PENDING' && ex.toUserId === state.userId) {
    return `
      <span class="muted" style="font-size:12px;">${escapeHtml(friend.nickname)}님이 카톡 교환을 요청했어요</span>
      <div style="display:flex; gap:8px; margin-top:4px;">
        <button class="btn btn-premium btn-sm" onclick="NRAYO.respondKakaoExchange('${ex.id}', true)">수락</button>
        <button class="btn btn-ghost btn-sm" onclick="NRAYO.respondKakaoExchange('${ex.id}', false)">거절</button>
      </div>`;
  }
  if (ex.status === 'ACCEPTED') {
    const myId = ex.fromUserId === state.userId ? ex.toKakaoIdCache : ex.fromKakaoIdCache;
    return `<div class="kakao-id-reveal">💬 ${escapeHtml(friend.nickname)}님 카톡: ${myId ? escapeHtml(myId) : '(상대가 아직 카톡 ID를 등록하지 않았어요)'}</div>`;
  }
  if (ex.status === 'DECLINED') {
    return `<span class="muted" style="font-size:12px;">교환 요청이 거절됐어요</span>`;
  }
  return '';
}

async function requestKakaoExchange(friendUserId) {
  try {
    const result = await api('/kakao/request', 'POST', { fromUserId: state.userId, toUserId: friendUserId });
    document.getElementById('star-count').textContent = result.stars;
    toast('카톡 교환 요청을 보냈어요');
    loadMe();
  } catch (e) { toast(e.message); }
}

async function respondKakaoExchange(exchangeId, accept) {
  try {
    const result = await api(`/kakao/${exchangeId}/respond`, 'POST', { userId: state.userId, accept });
    if (accept) {
      toast(result.fromKakaoId || result.toKakaoId ? '카톡 교환이 완료됐어요!' : '수락했어요 (상대가 아직 카톡 ID 미등록)');
    } else {
      toast('요청을 거절했어요');
    }
    loadMe();
  } catch (e) { toast(e.message); }
}

async function saveKakaoId() {
  const input = document.getElementById('kakao-id-input');
  const kakaoId = (input.value || '').trim();
  if (!kakaoId) { toast('카카오톡 ID를 입력해주세요'); return; }
  try {
    await api('/kakao/set-id', 'POST', { userId: state.userId, kakaoId });
    toast('카카오톡 ID를 저장했어요');
  } catch (e) { toast(e.message); }
}

// ---------------- 프로필 우선노출 (부스트) ----------------
function renderBoostCard(boostedUntil) {
  const box = document.getElementById('boost-card');
  if (!box) return;
  const isActive = boostedUntil && new Date(boostedUntil).getTime() > Date.now();

  if (isActive) {
    const remainMin = Math.round((new Date(boostedUntil).getTime() - Date.now()) / 60000);
    box.innerHTML = `
      <div style="font-weight:700;">🔥 지금 우선노출 중이에요</div>
      <div class="muted" style="margin-top:4px;">약 ${Math.floor(remainMin / 60)}시간 ${remainMin % 60}분 남았어요</div>
    `;
  } else {
    box.innerHTML = `
      <div class="muted" style="margin-bottom:10px;">별 5개로 24시간 동안 Today's 2에 먼저 보여드려요</div>
      <button class="btn btn-primary btn-sm" onclick="NRAYO.buyBoost()">프로필 우선노출 구매 (⭐5)</button>
    `;
  }
}

async function buyBoost() {
  try {
    const result = await api(`/discovery/boost/${state.userId}`, 'POST');
    toast('프로필 우선노출이 시작됐어요!');
    document.getElementById('star-count').textContent = result.stars;
    renderBoostCard(result.boostedUntil);
  } catch (e) { toast(e.message); }
}

// ---------------- AI 아이스브레이커 ----------------
async function getIcebreaker(targetUserId, nickname) {
  const box = document.getElementById(`icebreaker-${targetUserId}`);
  if (box) box.innerHTML = `<p class="muted" style="margin-top:8px;">AI가 대화 주제를 고민하고 있어요...</p>`;
  try {
    const result = await api(`/discovery/icebreaker/${targetUserId}`, 'POST', { userId: state.userId });
    if (box) {
      box.innerHTML = `
        <div class="card" style="margin-top:8px; padding:12px 14px;">
          <div class="muted" style="margin-bottom:6px;">🤖 ${nickname}님과 대화 시작하기 좋은 질문</div>
          ${result.icebreakers.map(q => `<div style="font-size:14px; margin-top:4px;">• ${q}</div>`).join('')}
        </div>`;
    }
    document.getElementById('star-count').textContent = result.stars;
  } catch (e) {
    if (box) box.innerHTML = '';
    toast(e.message);
  }
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
setupSingleChip('suggest-category-chips', null, () => {});
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
  startDraw, clearDrawCanvas, submitDrawGuess,
  loadExtraCandidates, chargeStars, signInWithGoogle, adminLogin, buyBoost, getIcebreaker, useCurrentLocation,
  logout,
  previewFeedPhoto, submitPost, loadFeed, toggleLike, toggleComments, submitComment, deletePost, reportPost,
  toggleRecruitField, toggleJoin, toggleRoomChat, submitRoomChat,
  submitSuggestion, loadSuggestions, toggleSuggestionLike, toggleSuggestionComments, submitSuggestionComment,
  deleteSuggestion, reportSuggestion,
  saveKakaoId, requestKakaoExchange, respondKakaoExchange,
  copyReferralCode, copyReferralLink
};

// 초대 링크(?ref=코드)로 들어온 경우 온보딩 마지막 단계의 초대 코드 입력란을 미리 채워둠
try {
  const refFromUrl = new URLSearchParams(location.search).get('ref');
  if (refFromUrl) {
    const el = document.getElementById('ob-referral-code');
    if (el) el.value = refFromUrl.trim().toUpperCase();
  }
} catch (e) { /* URL 파싱 실패해도 가입 자체엔 영향 없음 */ }

initAutoLogin();
window.sendFriendRequest = sendFriendRequest;
window.openQuiz = openQuiz;
window.answerQuiz = answerQuiz;
window.showScreen = showScreen;
window.openTrioRoom = openTrioRoom;
