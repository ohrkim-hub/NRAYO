// NRAYO admin dashboard
const API_BASE = window.NRAYO_API_BASE || 'https://nrayo-backend-761047791567.asia-northeast3.run.app';

let adminKey = localStorage.getItem('nrayo_admin_key') || null;

async function adminApi(path, method = 'GET', body) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey || '' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

async function login() {
  const key = document.getElementById('admin-key-input').value.trim();
  if (!key) return;
  try {
    await fetch(API_BASE + '/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key })
    }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '로그인 실패');
    });
    adminKey = key;
    localStorage.setItem('nrayo_admin_key', key);
    showDashboard();
  } catch (e) {
    alert(e.message);
  }
}

function logout() {
  adminKey = null;
  localStorage.removeItem('nrayo_admin_key');
  document.getElementById('admin-dashboard').style.display = 'none';
  document.getElementById('admin-login').style.display = 'block';
}

async function showDashboard() {
  document.getElementById('admin-login').style.display = 'none';
  document.getElementById('admin-dashboard').style.display = 'block';
  await Promise.all([loadUsers(), loadReports(), loadPosts(), loadSuggestions()]);
}

const SUGGESTION_STATUSES = ['신규', '검토중', '반영 예정', '반영 완료', '보류'];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

async function loadUsers() {
  try {
    const data = await adminApi('/admin/users');
    document.getElementById('count-users').textContent = data.users.length;
    document.getElementById('users-tbody').innerHTML = data.users.map(u => `
      <tr>
        <td>${u.nickname}</td>
        <td>${u.region}</td>
        <td>${u.birthYear}</td>
        <td>${(u.createdAt || '').slice(0, 10)}</td>
        <td>${u.banned ? '<span class="badge-banned">정지</span>' : '<span class="badge-active">활동중</span>'}</td>
        <td>${u.isAdmin ? '<span class="badge-active">⭐ 무한별</span>' : '-'}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-ghost btn-sm" onclick="Admin.toggleBan('${u.id}', ${!u.banned})">${u.banned ? '정지 해제' : '정지'}</button>
          <button class="btn btn-ghost btn-sm" onclick="Admin.toggleAdmin('${u.id}', ${!u.isAdmin})">${u.isAdmin ? '관리자 해제' : '관리자 지정'}</button>
        </td>
      </tr>`).join('');
  } catch (e) { console.error(e); }
}

async function loadReports() {
  try {
    const data = await adminApi('/admin/reports');
    document.getElementById('count-reports').textContent = data.reports.length;
    document.getElementById('reports-tbody').innerHTML = data.reports.map(r => `
      <tr>
        <td>${r.reason}</td>
        <td>${(r.fromUserId || '').slice(0, 6)}</td>
        <td>${(r.targetUserId || '').slice(0, 6)}</td>
        <td>${(r.createdAt || '').slice(0, 10)}</td>
        <td>${r.status}</td>
        <td>${r.status !== 'RESOLVED' ? `<button class="btn btn-ghost btn-sm" onclick="Admin.resolveReport('${r.id}')">처리완료</button>` : '-'}</td>
      </tr>`).join('');
  } catch (e) { console.error(e); }
}

async function toggleBan(userId, banned) {
  try {
    await adminApi(`/admin/users/${userId}/ban`, 'POST', { banned });
    await loadUsers();
  } catch (e) { alert(e.message); }
}

async function toggleAdmin(userId, isAdmin) {
  try {
    await adminApi(`/admin/users/${userId}/set-admin`, 'POST', { isAdmin });
    await loadUsers();
  } catch (e) { alert(e.message); }
}

async function resolveReport(reportId) {
  try {
    await adminApi(`/admin/reports/${reportId}/resolve`, 'POST', { status: 'RESOLVED' });
    await loadReports();
  } catch (e) { alert(e.message); }
}

async function loadPosts() {
  try {
    const data = await adminApi('/admin/posts');
    document.getElementById('count-posts').textContent = data.posts.length;
    document.getElementById('posts-tbody').innerHTML = data.posts.map(p => `
      <tr>
        <td>${escapeHtml(p.nickname)}</td>
        <td>${escapeHtml(p.region || '-')}</td>
        <td style="max-width:260px; white-space:pre-wrap;">${escapeHtml((p.text || '').slice(0, 80))}${(p.text || '').length > 80 ? '…' : ''}</td>
        <td>${p.photoUrl ? `<a href="${p.photoUrl}" target="_blank" rel="noopener">사진보기</a>` : '-'}</td>
        <td>${(p.likedBy || []).length}</td>
        <td>${p.commentCount || 0}</td>
        <td>${(p.createdAt || '').slice(0, 10)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="Admin.deletePost('${p.id}')">삭제</button></td>
      </tr>`).join('') || '<tr><td colspan="8" style="text-align:center; color:var(--text-soft);">아직 게시글이 없어요</td></tr>';
  } catch (e) { console.error(e); }
}

async function deletePost(postId) {
  if (!confirm('이 게시글을 삭제할까요? 되돌릴 수 없어요.')) return;
  try {
    await adminApi(`/admin/posts/${postId}`, 'DELETE');
    await loadPosts();
  } catch (e) { alert(e.message); }
}

async function seedPosts() {
  if (!confirm('동네생활에 "너랑요지기" 계정으로 시드 글 19개를 등록할까요?\n(이미 등록한 적이 있으면 중복 등록되지 않아요)')) return;
  try {
    const data = await adminApi('/admin/seed-posts', 'POST', {});
    if (data.already) {
      alert(data.message);
    } else {
      alert(`시드 글 ${data.count}개를 등록했어요!`);
    }
    await loadPosts();
  } catch (e) { alert(e.message); }
}

async function loadSuggestions() {
  try {
    const data = await adminApi('/admin/suggestions');
    document.getElementById('count-suggestions').textContent = data.suggestions.length;
    document.getElementById('suggestions-tbody').innerHTML = data.suggestions.map(s => `
      <tr>
        <td>${escapeHtml(s.category)}</td>
        <td style="max-width:240px; white-space:pre-wrap;">${escapeHtml((s.text || '').slice(0, 80))}${(s.text || '').length > 80 ? '…' : ''}</td>
        <td>${escapeHtml(s.nickname)}</td>
        <td>${(s.likedBy || []).length}</td>
        <td>${s.commentCount || 0}</td>
        <td>${(s.createdAt || '').slice(0, 10)}</td>
        <td>
          <select onchange="Admin.updateSuggestionStatus('${s.id}', this.value)">
            ${SUGGESTION_STATUSES.map(st => `<option value="${st}" ${st === s.status ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
        </td>
        <td><button class="btn btn-ghost btn-sm" onclick="Admin.deleteSuggestion('${s.id}')">삭제</button></td>
      </tr>`).join('') || '<tr><td colspan="8" style="text-align:center; color:var(--text-soft);">아직 건의사항이 없어요</td></tr>';
  } catch (e) { console.error(e); }
}

async function updateSuggestionStatus(id, status) {
  try {
    await adminApi(`/admin/suggestions/${id}/status`, 'POST', { status });
  } catch (e) { alert(e.message); await loadSuggestions(); }
}

async function deleteSuggestion(id) {
  if (!confirm('이 건의글을 삭제할까요? 되돌릴 수 없어요.')) return;
  try {
    await adminApi(`/admin/suggestions/${id}`, 'DELETE');
    await loadSuggestions();
  } catch (e) { alert(e.message); }
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${name}"]`).classList.add('active');
  document.getElementById('tab-users').style.display = name === 'users' ? 'block' : 'none';
  document.getElementById('tab-reports').style.display = name === 'reports' ? 'block' : 'none';
  document.getElementById('tab-posts').style.display = name === 'posts' ? 'block' : 'none';
  document.getElementById('tab-suggestions').style.display = name === 'suggestions' ? 'block' : 'none';
}

if (adminKey) showDashboard();

window.Admin = {
  login, logout, switchTab, toggleBan, toggleAdmin, resolveReport, deletePost, seedPosts,
  updateSuggestionStatus, deleteSuggestion
};
