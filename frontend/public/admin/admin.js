// NRAYO admin dashboard
const API_BASE = window.NRAYO_API_BASE || 'https://nrayo-backend-761047791567.asia-northeast3.run.app';

let adminKey = sessionStorage.getItem('nrayo_admin_key') || null;

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
    sessionStorage.setItem('nrayo_admin_key', key);
    showDashboard();
  } catch (e) {
    alert(e.message);
  }
}

function logout() {
  adminKey = null;
  sessionStorage.removeItem('nrayo_admin_key');
  document.getElementById('admin-dashboard').style.display = 'none';
  document.getElementById('admin-login').style.display = 'block';
}

async function showDashboard() {
  document.getElementById('admin-login').style.display = 'none';
  document.getElementById('admin-dashboard').style.display = 'block';
  await Promise.all([loadUsers(), loadReports()]);
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

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${name}"]`).classList.add('active');
  document.getElementById('tab-users').style.display = name === 'users' ? 'block' : 'none';
  document.getElementById('tab-reports').style.display = name === 'reports' ? 'block' : 'none';
}

if (adminKey) showDashboard();

window.Admin = { login, logout, switchTab, toggleBan, toggleAdmin, resolveReport };
