const token = localStorage.getItem('token');
let allUsers = [];
let allModerators = [];
let selectedUserId = null;
let adminProfile = null;

// ===== KHỞI TẠO =====
document.addEventListener('DOMContentLoaded', () => {
    if (!token) { window.location.href = '/index.html'; return; }
    loadAdminInfo();
    loadUsers();
    loadStats();
    setupNavigation();
});

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const page = item.dataset.page;
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
            document.getElementById('page-' + page).classList.remove('hidden');
            if (page === 'posts') loadPosts();
            if (page === 'stats') loadStats();
            if (page === 'moderators') loadModerators();
        });
    });
}

// ===== THÔNG TIN ADMIN =====
async function loadAdminInfo() {
    try {
        const res = await fetch('/api/users/profile', { headers: { 'Authorization': 'Bearer ' + token } });
        if (!res.ok) { window.location.href = '/index.html'; return; }
        const data = await res.json();
        if (data.role !== 'ADMIN') {
            alert('Bạn không có quyền truy cập trang này.');
            window.location.href = '/html/home.html';
            return;
        }
        adminProfile = data;
        document.getElementById('sidebar-name').textContent = data.fullName;
        const avatarEl = document.getElementById('sidebar-avatar');
        if (data.avatar) {
            avatarEl.innerHTML = `<img src="${data.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            avatarEl.textContent = data.fullName.charAt(0).toUpperCase();
        }
    } catch (e) {
        window.location.href = '/index.html';
    }
}

// ===== PROFILE ADMIN =====
function openAdminProfile() {
    if (!adminProfile) return;
    switchToViewAdmin();

    const u = adminProfile;
    const avatarEl = document.getElementById('admin-profile-avatar');
    avatarEl.innerHTML = u.avatar ? `<img src="${u.avatar}" alt="">` : u.fullName.charAt(0).toUpperCase();

    document.getElementById('admin-profile-name').textContent = u.fullName;
    document.getElementById('admin-profile-badges').innerHTML = roleBadge('ADMIN') + ' ' + statusBadge(u.status);

    const bioEl = document.getElementById('admin-profile-bio');
    bioEl.textContent = u.bio || 'Chưa có tiểu sử';
    bioEl.className = 'user-detail-bio' + (u.bio ? '' : ' empty');

    const fields = [
        { label: 'Email',           value: u.email },
        { label: 'Tên đăng nhập',   value: u.username ? '@' + u.username : null },
        { label: 'Giới tính',       value: formatGender(u.gender) },
        { label: 'Ngày sinh',       value: u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString('vi-VN') : null },
        { label: 'Số điện thoại',   value: u.phoneNumber },
        { label: 'Đăng nhập qua',   value: u.provider === 'GOOGLE' ? '🔵 Google' : '📧 Email/Mật khẩu' },
        { label: 'ID',              value: '#' + u.id },
    ];

    document.getElementById('admin-profile-grid').innerHTML = fields.map(f => `
        <div class="detail-item">
            <span class="detail-label">${f.label}</span>
            <span class="detail-value${!f.value ? ' empty' : ''}">${escapeHtml(f.value || 'Chưa cập nhật')}</span>
        </div>
    `).join('');

    document.getElementById('admin-profile-modal').classList.remove('hidden');
}

function switchToEditAdmin() {
    const u = adminProfile;
    document.getElementById('edit-admin-fullname').value = u.fullName || '';
    document.getElementById('edit-admin-phone').value = u.phoneNumber || '';
    document.getElementById('edit-admin-gender').value = u.gender ? u.gender.toLowerCase() : '';
    document.getElementById('edit-admin-dob').value = u.dateOfBirth ? String(u.dateOfBirth).substring(0, 10) : '';

    document.getElementById('admin-profile-view').classList.add('hidden');
    document.getElementById('admin-edit-view').classList.remove('hidden');
    document.getElementById('admin-profile-footer').classList.add('hidden');
    document.getElementById('admin-edit-footer').classList.remove('hidden');
}

function switchToViewAdmin() {
    document.getElementById('admin-profile-view').classList.remove('hidden');
    document.getElementById('admin-edit-view').classList.add('hidden');
    document.getElementById('admin-profile-footer').classList.remove('hidden');
    document.getElementById('admin-edit-footer').classList.add('hidden');
}

async function saveAdminProfile() {
    const fullName = document.getElementById('edit-admin-fullname').value.trim();
    const phoneNumber = document.getElementById('edit-admin-phone').value.trim() || null;
    const gender = document.getElementById('edit-admin-gender').value || null;
    const dateOfBirth = document.getElementById('edit-admin-dob').value || null;

    if (!fullName) { showToast('Tên hiển thị không được để trống.', 'error'); return; }

    try {
        const res = await fetch('/api/users/onboarding', {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, phoneNumber, gender, dateOfBirth })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            showToast('Đã cập nhật thông tin thành công.', 'success');
            await loadAdminInfo();
            openAdminProfile();
        } else {
            showToast(data.message || 'Có lỗi xảy ra.', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối.', 'error');
    }
}

// ===== THỐNG KÊ =====
async function loadStats() {
    try {
        const res = await fetch('/api/admin/stats', { headers: { 'Authorization': 'Bearer ' + token } });
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById('big-total-users').textContent = data.totalUsers ?? '--';
        document.getElementById('big-total-posts').textContent = data.totalPosts ?? '--';
        document.getElementById('big-banned').textContent = data.bannedUsers ?? '--';
        document.getElementById('big-moderators').textContent = data.moderators ?? '--';
    } catch (e) {}
}

// ===== DANH SÁCH NGƯỜI DÙNG =====
async function loadUsers() {
    document.getElementById('users-tbody').innerHTML =
        '<tr><td colspan="7" class="loading-cell"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    try {
        const res = await fetch('/api/admin/users', { headers: { 'Authorization': 'Bearer ' + token } });
        if (res.status === 403) { showToast('Bạn không có quyền xem danh sách người dùng.', 'error'); return; }
        allUsers = await res.json();
        renderUsers(allUsers);
        updateStatCards(allUsers);
    } catch (e) {
        document.getElementById('users-tbody').innerHTML =
            '<tr><td colspan="7" class="loading-cell">Lỗi khi tải dữ liệu.</td></tr>';
    }
}

function updateStatCards(users) {
    document.getElementById('stat-total').textContent = users.length;
    document.getElementById('stat-active').textContent = users.filter(u => u.status === 'ACTIVE').length;
    document.getElementById('stat-banned').textContent = users.filter(u => u.status === 'BANNED').length;
}

function renderUsers(users) {
    const tbody = document.getElementById('users-tbody');
    document.getElementById('table-count').textContent = users.length + ' người dùng';

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Không tìm thấy người dùng nào.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => `
        <tr>
            <td style="color:var(--text-muted);font-size:13px;">#${u.id}</td>
            <td>
                <div class="user-cell">
                    <div class="user-avatar-sm" style="cursor:pointer;" onclick="openUserDetail(${u.id})">
                        ${u.avatar ? `<img src="${u.avatar}" alt="">` : u.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="user-fullname">
                            <span class="user-fullname-link" onclick="openUserDetail(${u.id})">${escapeHtml(u.fullName)}</span>
                        </div>
                        <div class="user-username">${u.username ? '@' + escapeHtml(u.username) : ''}</div>
                    </div>
                </div>
            </td>
            <td style="font-size:13px;color:var(--text-muted);">${escapeHtml(u.email)}</td>
            <td>${roleBadge(u.role)}</td>
            <td>${statusBadge(u.status)}</td>
            <td>${providerIcon(u.provider)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn" title="Đổi role" onclick="openRoleModal(${u.id}, '${escapeHtml(u.fullName)}', '${u.role}')">
                        <i class="fa-solid fa-user-shield"></i>
                    </button>
                    ${u.status !== 'BANNED'
                        ? `<button class="action-btn danger" title="Khoá tài khoản" onclick="banUser(${u.id}, '${escapeHtml(u.fullName)}')">
                               <i class="fa-solid fa-ban"></i>
                           </button>`
                        : `<button class="action-btn success" title="Mở khoá" onclick="unbanUser(${u.id}, '${escapeHtml(u.fullName)}')">
                               <i class="fa-solid fa-lock-open"></i>
                           </button>`
                    }
                    <button class="action-btn warning-btn" title="Cảnh báo" onclick="warnUser(${u.id}, '${escapeHtml(u.fullName)}')">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </button>
                    <button class="action-btn" title="Lịch sử đăng nhập" onclick="openLoginHistory(${u.id}, '${escapeHtml(u.fullName)}')">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </button>
                    <button class="action-btn danger" title="Xoá tài khoản" onclick="deleteUser(${u.id}, '${escapeHtml(u.fullName)}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function roleBadge(role) {
    const map = {
        ADMIN: ['badge-admin', 'fa-crown', 'Admin'],
        MODERATOR: ['badge-moderator', 'fa-shield-halved', 'Moderator'],
        USER: ['badge-user', 'fa-user', 'User'],
    };
    const [cls, icon, label] = map[role] || ['badge-user', 'fa-user', role];
    return `<span class="badge ${cls}"><i class="fa-solid ${icon}"></i> ${label}</span>`;
}

function statusBadge(status) {
    const map = {
        ACTIVE: ['badge-active', 'fa-circle-check', 'Hoạt động'],
        BANNED: ['badge-banned', 'fa-ban', 'Bị khoá'],
        WARNING: ['badge-warning', 'fa-triangle-exclamation', 'Cảnh báo'],
        INACTIVE: ['badge-inactive', 'fa-clock', 'Chưa kích hoạt'],
    };
    const [cls, icon, label] = map[status] || ['badge-inactive', 'fa-circle', status];
    return `<span class="badge ${cls}"><i class="fa-solid ${icon}"></i> ${label}</span>`;
}

function providerIcon(provider) {
    if (provider === 'GOOGLE')
        return `<span class="provider-google"><i class="fa-brands fa-google"></i> Google</span>`;
    return `<span class="provider-local"><i class="fa-solid fa-envelope"></i> Email</span>`;
}

// ===== LỌC =====
function filterUsers() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const role = document.getElementById('filter-role').value;
    const status = document.getElementById('filter-status').value;

    const filtered = allUsers.filter(u => {
        const matchName = u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
        const matchRole = !role || u.role === role;
        const matchStatus = !status || u.status === status;
        return matchName && matchRole && matchStatus;
    });
    renderUsers(filtered);
}

// ===== CÁC THAO TÁC =====
async function banUser(id, name) {
    if (!confirm(`Khoá tài khoản của "${name}"?`)) return;
    await adminAction(`/api/admin/users/${id}/ban`, 'PUT', `Đã khoá tài khoản ${name}`);
}

async function unbanUser(id, name) {
    if (!confirm(`Mở khoá tài khoản của "${name}"?`)) return;
    await adminAction(`/api/admin/users/${id}/unban`, 'PUT', `Đã mở khoá tài khoản ${name}`);
}

async function warnUser(id, name) {
    if (!confirm(`Gửi cảnh báo đến "${name}"?`)) return;
    await adminAction(`/api/admin/users/${id}/warn`, 'PUT', `Đã cảnh báo ${name}`);
}

async function deleteUser(id, name) {
    if (!confirm(`Xoá vĩnh viễn tài khoản của "${name}"? Hành động này không thể hoàn tác!`)) return;
    await adminAction(`/api/admin/users/${id}`, 'DELETE', `Đã xoá tài khoản ${name}`);
}

async function adminAction(url, method, successMsg, body = null) {
    try {
        const options = { method, headers: { 'Authorization': 'Bearer ' + token } };
        if (body) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        const res = await fetch(url, options);
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            showToast(successMsg, 'success');
            loadUsers();
        } else {
            showToast(data.message || 'Có lỗi xảy ra.', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối.', 'error');
    }
}

// ===== MODAL ĐỔI ROLE =====
function openRoleModal(id, name, currentRole) {
    selectedUserId = id;
    document.getElementById('modal-username').textContent = name;
    document.getElementById('modal-role-select').value = currentRole;
    document.getElementById('role-modal').classList.remove('hidden');
}

async function confirmChangeRole() {
    const newRole = document.getElementById('modal-role-select').value;
    closeModal('role-modal');
    await adminAction(`/api/admin/users/${selectedUserId}/role`, 'PUT', `Đã cập nhật role thành ${newRole}`, { role: newRole });
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// ===== DANH SÁCH BÀI VIẾT =====
let allPosts = [];

async function loadPosts() {
    document.getElementById('posts-tbody').innerHTML =
        '<tr><td colspan="8" class="loading-cell"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    try {
        const res = await fetch('/api/admin/posts', { headers: { 'Authorization': 'Bearer ' + token } });
        if (!res.ok) { showToast('Không thể tải danh sách bài viết.', 'error'); return; }
        allPosts = await res.json();
        updatePostStatCards(allPosts);
        renderPosts(allPosts);
    } catch (e) {
        document.getElementById('posts-tbody').innerHTML =
            '<tr><td colspan="8" class="loading-cell">Lỗi khi tải dữ liệu.</td></tr>';
    }
}

function updatePostStatCards(posts) {
    document.getElementById('post-stat-total').textContent = posts.length;
    document.getElementById('post-stat-public').textContent = posts.filter(p => p.visibility === 'PUBLIC').length;
    document.getElementById('post-stat-friends').textContent = posts.filter(p => p.visibility === 'FRIENDS').length;
    document.getElementById('post-stat-private').textContent = posts.filter(p => p.visibility === 'PRIVATE').length;
}

function renderPosts(posts) {
    const tbody = document.getElementById('posts-tbody');
    document.getElementById('post-table-count').textContent = posts.length + ' bài viết';
    if (!posts.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">Không có bài viết nào.</td></tr>';
        return;
    }
    tbody.innerHTML = posts.map(p => `
        <tr>
            <td style="color:var(--text-muted);font-size:13px;">#${p.id}</td>
            <td>
                <div class="user-cell">
                    <div class="user-avatar-sm">
                        ${p.user?.avatar ? `<img src="${p.user.avatar}" alt="">` : (p.user?.fullName?.charAt(0).toUpperCase() || '?')}
                    </div>
                    <div class="user-fullname">${escapeHtml(p.user?.fullName || '--')}</div>
                </div>
            </td>
            <td class="post-content-cell">${escapeHtml(p.content || '(không có nội dung)')}</td>
            <td>${visibilityBadge(p.visibility)}</td>
            <td style="text-align:center;">
                <span style="color:var(--red);font-weight:600;"><i class="fa-solid fa-heart"></i> ${p.likeCount ?? 0}</span>
            </td>
            <td style="text-align:center;">
                <span style="color:var(--blue);font-weight:600;"><i class="fa-solid fa-comment"></i> ${p.commentCount ?? 0}</span>
            </td>
            <td style="font-size:12px;color:var(--text-muted);white-space:nowrap;">${formatDate(p.createdAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn" title="Xem chi tiết" onclick="openPostDetail(${p.id})">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="action-btn danger" title="Xoá bài viết" onclick="deletePost(${p.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function filterPosts() {
    const q = document.getElementById('post-search-input').value.toLowerCase();
    const visibility = document.getElementById('post-filter-visibility').value;
    const filtered = allPosts.filter(p => {
        const matchText = (p.content || '').toLowerCase().includes(q) || (p.user?.fullName || '').toLowerCase().includes(q);
        const matchVis = !visibility || p.visibility === visibility;
        return matchText && matchVis;
    });
    renderPosts(filtered);
}

function visibilityBadge(v) {
    const map = {
        PUBLIC:  ['badge-active',   'fa-earth-asia',  'Công khai'],
        FRIENDS: ['badge-warning',  'fa-user-group',  'Bạn bè'],
        PRIVATE: ['badge-inactive', 'fa-lock',        'Riêng tư'],
    };
    const [cls, icon, label] = map[v] || ['badge-inactive', 'fa-circle', v];
    return `<span class="badge ${cls}"><i class="fa-solid ${icon}"></i> ${label}</span>`;
}

function openPostDetail(id) {
    const p = allPosts.find(p => p.id === id);
    if (!p) return;

    document.getElementById('post-detail-id').textContent = '#' + p.id;

    // Avatar tác giả
    const avatarEl = document.getElementById('post-detail-avatar');
    avatarEl.innerHTML = p.user?.avatar ? `<img src="${p.user.avatar}" alt="">` : (p.user?.fullName?.charAt(0).toUpperCase() || '?');

    document.getElementById('post-detail-author').textContent = p.user?.fullName || '--';
    document.getElementById('post-detail-meta').textContent = formatDate(p.createdAt) + (p.user?.email ? '  •  ' + p.user.email : '');
    document.getElementById('post-detail-visibility-badge').innerHTML = visibilityBadge(p.visibility);

    // Nội dung
    const contentEl = document.getElementById('post-detail-content');
    contentEl.textContent = p.content || '(không có nội dung)';
    contentEl.className = 'post-content-box' + (p.content ? '' : ' empty');

    // Hình ảnh
    const imgWrap = document.getElementById('post-detail-image-wrap');
    imgWrap.innerHTML = p.imageUrl ? `<img src="${p.imageUrl}" class="post-detail-img" alt="Ảnh bài viết">` : '';

    // Thống kê
    document.getElementById('post-detail-likes').textContent = p.likeCount ?? 0;
    document.getElementById('post-detail-comment-count').textContent = p.commentCount ?? 0;

    // Bình luận
    const commentsEl = document.getElementById('post-detail-comments');
    if (p.comments && p.comments.length > 0) {
        commentsEl.innerHTML = `<div class="comments-title"><i class="fa-solid fa-comment"></i> Bình luận (${p.comments.length})</div>` +
            p.comments.map(c => `
                <div class="comment-item">
                    <div class="comment-avatar">
                        ${c.user?.avatar ? `<img src="${c.user.avatar}" alt="">` : (c.user?.fullName?.charAt(0).toUpperCase() || '?')}
                    </div>
                    <div class="comment-body">
                        <span class="comment-author">${escapeHtml(c.user?.fullName || 'Ẩn danh')}</span>
                        <span class="comment-time">${formatDate(c.createdAt)}</span>
                        <div class="comment-text">${escapeHtml(c.content || '')}</div>
                    </div>
                </div>
            `).join('');
    } else {
        commentsEl.innerHTML = '<div class="no-comments">Chưa có bình luận nào.</div>';
    }

    // Nút xoá
    document.getElementById('post-detail-delete-btn').onclick = () => deletePost(p.id);

    document.getElementById('post-detail-modal').classList.remove('hidden');
}

async function deletePost(id) {
    if (!confirm(`Xoá bài viết #${id}? Hành động này không thể hoàn tác!`)) return;
    try {
        const res = await fetch(`/api/admin/posts/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            showToast(`Đã xoá bài viết #${id}.`, 'success');
            closeModal('post-detail-modal');
            loadPosts();
        } else {
            showToast(data.message || 'Có lỗi xảy ra.', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối.', 'error');
    }
}

// ===== UTILS =====
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/index.html';
}

function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast' + (type ? ' ' + type : '');
    setTimeout(() => { toast.className = 'toast hidden'; }, 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(dateStr) {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// ===== CHI TIẾT NGƯỜI DÙNG =====
async function openUserDetail(id) {
    document.getElementById('detail-fullname').textContent = 'Đang tải...';
    document.getElementById('detail-badges').innerHTML = '';
    document.getElementById('detail-bio').textContent = '';
    document.getElementById('detail-grid').innerHTML = '';
    document.getElementById('detail-avatar-wrap').innerHTML = '';
    document.getElementById('user-detail-modal').classList.remove('hidden');

    try {
        const res = await fetch(`/api/admin/users/${id}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) { showToast('Không thể tải thông tin người dùng.', 'error'); return; }
        const u = await res.json();

        // Avatar
        const avatarWrap = document.getElementById('detail-avatar-wrap');
        avatarWrap.innerHTML = u.avatar
            ? `<img src="${u.avatar}" alt="">`
            : u.fullName.charAt(0).toUpperCase();

        // Tên
        document.getElementById('detail-fullname').textContent = u.fullName;

        // Badges
        document.getElementById('detail-badges').innerHTML =
            roleBadge(u.role) + ' ' + statusBadge(u.status);

        // Bio
        const bioEl = document.getElementById('detail-bio');
        bioEl.textContent = u.bio || 'Chưa có tiểu sử';
        bioEl.className = 'user-detail-bio' + (u.bio ? '' : ' empty');

        // Grid thông tin
        const fields = [
            { label: 'Email',        value: u.email },
            { label: 'Tên đăng nhập', value: u.username ? '@' + u.username : null },
            { label: 'Giới tính',    value: formatGender(u.gender) },
            { label: 'Ngày sinh',    value: u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString('vi-VN') : null },
            { label: 'Số điện thoại', value: u.phoneNumber },
            { label: 'Tình trạng',   value: u.relationshipStatus },
            { label: 'Đăng nhập qua', value: u.provider === 'GOOGLE' ? '🔵 Google' : '📧 Email/Mật khẩu' },
            { label: 'ID',           value: '#' + u.id },
        ];

        document.getElementById('detail-grid').innerHTML = fields.map(f => `
            <div class="detail-item">
                <span class="detail-label">${f.label}</span>
                <span class="detail-value${!f.value ? ' empty' : ''}">${escapeHtml(f.value || 'Chưa cập nhật')}</span>
            </div>
        `).join('');

    } catch (e) {
        showToast('Lỗi kết nối.', 'error');
        closeModal('user-detail-modal');
    }
}

// ===== LỊCH SỬ ĐĂNG NHẬP =====
async function openLoginHistory(id, name) {
    document.getElementById('history-username').textContent = name;
    document.getElementById('history-tbody').innerHTML =
        '<tr><td colspan="4" class="loading-cell"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    document.getElementById('login-history-modal').classList.remove('hidden');

    try {
        const res = await fetch(`/api/admin/users/${id}/login-history`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const history = await res.json();
        const tbody = document.getElementById('history-tbody');

        if (!history.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">Chưa có lịch sử đăng nhập.</td></tr>';
            return;
        }

        tbody.innerHTML = history.map((h, i) => `
            <tr>
                <td style="color:var(--text-muted);font-size:13px;">${i + 1}</td>
                <td style="font-size:13px;">${formatDate(h.loginAt)}</td>
                <td style="font-size:13px;font-family:monospace;">${h.ipAddress || '--'}</td>
                <td>${h.provider === 'GOOGLE'
                    ? '<span class="provider-google"><i class="fa-brands fa-google"></i> Google</span>'
                    : '<span class="provider-local"><i class="fa-solid fa-envelope"></i> Email</span>'
                }</td>
            </tr>
        `).join('');
    } catch (e) {
        showToast('Lỗi kết nối.', 'error');
        closeModal('login-history-modal');
    }
}

function formatGender(g) {
    if (!g) return null;
    const map = { male: 'Nam', female: 'Nữ', other: 'Khác' };
    return map[g.toLowerCase()] || g;
}

// ===== DANH SÁCH KIỂM DUYỆT VIÊN =====
async function loadModerators() {
    document.getElementById('moderators-tbody').innerHTML =
        '<tr><td colspan="7" class="loading-cell"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    try {
        const res = await fetch('/api/admin/moderators', { headers: { 'Authorization': 'Bearer ' + token } });
        if (!res.ok) { showToast('Không thể tải danh sách kiểm duyệt viên.', 'error'); return; }
        allModerators = await res.json();
        renderModerators(allModerators);
        updateModStatCards(allModerators);
    } catch (e) {
        document.getElementById('moderators-tbody').innerHTML =
            '<tr><td colspan="7" class="loading-cell">Lỗi khi tải dữ liệu.</td></tr>';
    }
}

function updateModStatCards(mods) {
    document.getElementById('mod-stat-total').textContent = mods.length;
    document.getElementById('mod-stat-active').textContent = mods.filter(m => m.status === 'ACTIVE').length;
    document.getElementById('mod-stat-locked').textContent = mods.filter(m => m.status === 'BANNED').length;
}

function renderModerators(mods) {
    const tbody = document.getElementById('moderators-tbody');
    document.getElementById('mod-table-count').textContent = mods.length + ' kiểm duyệt viên';

    if (mods.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Không tìm thấy kiểm duyệt viên nào.</td></tr>';
        return;
    }

    tbody.innerHTML = mods.map(m => `
        <tr>
            <td style="color:var(--text-muted);font-size:13px;">#${m.id}</td>
            <td>
                <div class="user-cell">
                    <div class="user-avatar-sm" style="background:var(--purple);cursor:pointer;" onclick="openModeratorDetail(${m.id})">
                        ${m.avatar ? `<img src="${m.avatar}" alt="">` : m.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="user-fullname">
                            <span class="user-fullname-link" onclick="openModeratorDetail(${m.id})">${escapeHtml(m.fullName)}</span>
                        </div>
                        <div class="user-username">${m.username ? '@' + escapeHtml(m.username) : ''}</div>
                    </div>
                </div>
            </td>
            <td style="font-size:13px;color:var(--text-muted);">${escapeHtml(m.email)}</td>
            <td style="font-size:13px;color:var(--text-muted);">${m.phoneNumber ? escapeHtml(m.phoneNumber) : '<span style="color:var(--text-muted);font-style:italic;">Chưa cập nhật</span>'}</td>
            <td>${statusBadge(m.status)}</td>
            <td>${providerIcon(m.provider)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn" title="Xem chi tiết" onclick="openModeratorDetail(${m.id})">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="action-btn" title="Cập nhật thông tin" onclick="openEditModerator(${m.id})">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    ${m.status !== 'BANNED'
                        ? `<button class="action-btn danger" title="Khoá tài khoản" onclick="lockModerator(${m.id}, '${escapeHtml(m.fullName)}')">
                               <i class="fa-solid fa-ban"></i>
                           </button>`
                        : `<button class="action-btn success" title="Kích hoạt lại" onclick="activateModerator(${m.id}, '${escapeHtml(m.fullName)}')">
                               <i class="fa-solid fa-lock-open"></i>
                           </button>`
                    }
                    <button class="action-btn danger" title="Xoá tài khoản" onclick="deleteModerator(${m.id}, '${escapeHtml(m.fullName)}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function filterModerators() {
    const q = document.getElementById('mod-search-input').value.toLowerCase();
    const status = document.getElementById('mod-filter-status').value;

    const filtered = allModerators.filter(m => {
        const matchName = m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
        const matchStatus = !status || m.status === status;
        return matchName && matchStatus;
    });
    renderModerators(filtered);
}

// ===== CHI TIẾT KIỂM DUYỆT VIÊN =====
async function openModeratorDetail(id) {
    document.getElementById('mod-detail-fullname').textContent = 'Đang tải...';
    document.getElementById('mod-detail-badges').innerHTML = '';
    document.getElementById('mod-detail-bio').textContent = '';
    document.getElementById('mod-detail-grid').innerHTML = '';
    document.getElementById('mod-detail-avatar-wrap').innerHTML = '';
    document.getElementById('mod-detail-modal').classList.remove('hidden');

    try {
        const res = await fetch(`/api/admin/moderators/${id}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) { showToast('Không thể tải thông tin kiểm duyệt viên.', 'error'); return; }
        const u = await res.json();

        const avatarWrap = document.getElementById('mod-detail-avatar-wrap');
        avatarWrap.style.background = 'var(--purple)';
        avatarWrap.innerHTML = u.avatar
            ? `<img src="${u.avatar}" alt="">`
            : u.fullName.charAt(0).toUpperCase();

        document.getElementById('mod-detail-fullname').textContent = u.fullName;
        document.getElementById('mod-detail-badges').innerHTML = statusBadge(u.status);

        const bioEl = document.getElementById('mod-detail-bio');
        bioEl.textContent = u.bio || 'Chưa có tiểu sử';
        bioEl.className = 'user-detail-bio' + (u.bio ? '' : ' empty');

        const fields = [
            { label: 'Email',           value: u.email },
            { label: 'Tên đăng nhập',   value: u.username ? '@' + u.username : null },
            { label: 'Giới tính',       value: formatGender(u.gender) },
            { label: 'Ngày sinh',       value: u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString('vi-VN') : null },
            { label: 'Số điện thoại',   value: u.phoneNumber },
            { label: 'Đăng nhập qua',   value: u.provider === 'GOOGLE' ? '🔵 Google' : '📧 Email/Mật khẩu' },
            { label: 'ID',              value: '#' + u.id },
        ];

        document.getElementById('mod-detail-grid').innerHTML = fields.map(f => `
            <div class="detail-item">
                <span class="detail-label">${f.label}</span>
                <span class="detail-value${!f.value ? ' empty' : ''}">${escapeHtml(f.value || 'Chưa cập nhật')}</span>
            </div>
        `).join('');

    } catch (e) {
        showToast('Lỗi kết nối.', 'error');
        closeModal('mod-detail-modal');
    }
}

// ===== TẠO KIỂM DUYỆT VIÊN =====
function openCreateModeratorModal() {
    document.getElementById('new-mod-fullname').value = '';
    document.getElementById('new-mod-email').value = '';
    document.getElementById('new-mod-username').value = '';
    document.getElementById('new-mod-password').value = '';
    document.getElementById('create-mod-modal').classList.remove('hidden');
}

async function createModerator() {
    const fullName = document.getElementById('new-mod-fullname').value.trim();
    const email = document.getElementById('new-mod-email').value.trim();
    const username = document.getElementById('new-mod-username').value.trim();
    const password = document.getElementById('new-mod-password').value;

    if (!fullName) { showToast('Vui lòng nhập tên hiển thị.', 'error'); return; }
    if (!email) { showToast('Vui lòng nhập email.', 'error'); return; }
    if (!password || password.length < 6) { showToast('Mật khẩu phải có ít nhất 6 ký tự.', 'error'); return; }

    try {
        const res = await fetch('/api/admin/moderators', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, email, username, password })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            showToast('Đã tạo tài khoản kiểm duyệt viên thành công.', 'success');
            closeModal('create-mod-modal');
            loadModerators();
        } else {
            showToast(data.message || data || 'Có lỗi xảy ra.', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối.', 'error');
    }
}

// ===== CẬP NHẬT THÔNG TIN KIỂM DUYỆT VIÊN =====
let editModeratorId = null;

function openEditModerator(id) {
    const m = allModerators.find(m => m.id === id);
    if (!m) return;
    editModeratorId = id;
    document.getElementById('edit-mod-name').textContent = m.fullName;
    document.getElementById('edit-mod-email').value = m.email || '';
    document.getElementById('edit-mod-phone').value = m.phoneNumber || '';
    document.getElementById('edit-mod-gender').value = m.gender ? m.gender.toLowerCase() : '';
    document.getElementById('edit-mod-dob').value = m.dateOfBirth ? String(m.dateOfBirth).substring(0, 10) : '';
    document.getElementById('edit-mod-modal').classList.remove('hidden');
}

async function saveModeratorInfo() {
    const email = document.getElementById('edit-mod-email').value.trim();
    const phoneNumber = document.getElementById('edit-mod-phone').value.trim();
    const gender = document.getElementById('edit-mod-gender').value;
    const dateOfBirth = document.getElementById('edit-mod-dob').value;

    if (!email) { showToast('Email không được để trống.', 'error'); return; }

    try {
        const res = await fetch(`/api/admin/moderators/${editModeratorId}`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, phoneNumber, gender, dateOfBirth })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            showToast('Đã cập nhật thông tin thành công.', 'success');
            closeModal('edit-mod-modal');
            loadModerators();
        } else {
            showToast(data.message || data || 'Có lỗi xảy ra.', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối.', 'error');
    }
}

// ===== KHOÁ / KÍCH HOẠT / XOÁ KIỂM DUYỆT VIÊN =====
async function lockModerator(id, name) {
    if (!confirm(`Khoá tài khoản kiểm duyệt viên "${name}"?`)) return;
    try {
        const res = await fetch(`/api/admin/moderators/${id}/lock`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) { showToast(`Đã khoá tài khoản ${name}.`, 'success'); loadModerators(); }
        else showToast(data.message || data || 'Có lỗi xảy ra.', 'error');
    } catch (e) { showToast('Lỗi kết nối.', 'error'); }
}

async function activateModerator(id, name) {
    if (!confirm(`Kích hoạt lại tài khoản kiểm duyệt viên "${name}"?`)) return;
    try {
        const res = await fetch(`/api/admin/moderators/${id}/activate`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) { showToast(`Đã kích hoạt lại tài khoản ${name}.`, 'success'); loadModerators(); }
        else showToast(data.message || data || 'Có lỗi xảy ra.', 'error');
    } catch (e) { showToast('Lỗi kết nối.', 'error'); }
}

async function deleteModerator(id, name) {
    if (!confirm(`Xoá vĩnh viễn tài khoản kiểm duyệt viên "${name}"? Hành động này không thể hoàn tác!`)) return;
    try {
        const res = await fetch(`/api/admin/moderators/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) { showToast(`Đã xoá tài khoản ${name}.`, 'success'); loadModerators(); }
        else showToast(data.message || data || 'Có lỗi xảy ra.', 'error');
    } catch (e) { showToast('Lỗi kết nối.', 'error'); }
}
