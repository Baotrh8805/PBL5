const token = localStorage.getItem('token');
// Mảng dùng để lưu trữ TOÀN BỘ dữ liệu người dùng/kiểm duyệt viên tải từ Server về.
// Giúp việc tìm kiếm (filter) diễn ra ngay trên máy khách mà không cần gọi lại Server.
let allUsers = [];
let allModerators = [];
let selectedUserId = null;
let adminProfile = null;
let usersChartInstance = null;
let activityChartInstance = null;
let aiAccuracyChartInstance = null;

function showConfirm(title, message, onConfirm, type = 'info') {
    const modal = document.getElementById('custom-confirm-modal');
    const titleEl = document.getElementById('custom-confirm-title');
    const msgEl = document.getElementById('custom-confirm-message');
    const okBtn = document.getElementById('custom-confirm-ok-btn');
    const cancelBtn = document.getElementById('custom-confirm-cancel-btn');
    const closeBtn = document.getElementById('custom-confirm-close');

    titleEl.innerHTML = title;
    msgEl.innerHTML = message;

    if (type === 'danger') {
        okBtn.style.background = 'var(--red)';
    } else if (type === 'warning') {
        okBtn.style.background = 'var(--yellow)';
    } else {
        okBtn.style.background = 'var(--primary)';
    }

    const hide = () => modal.classList.add('hidden');

    okBtn.onclick = () => {
        hide();
        if (onConfirm) onConfirm();
    };
    cancelBtn.onclick = hide;
    closeBtn.onclick = hide;

    modal.classList.remove('hidden');
}

function showAlert(title, message, type = 'info', onClose = null) {
    const modal = document.getElementById('custom-alert-modal');
    const titleEl = document.getElementById('custom-alert-title');
    const msgEl = document.getElementById('custom-alert-message');
    const okBtn = document.getElementById('custom-alert-ok-btn');
    const closeBtn = document.getElementById('custom-alert-close');

    titleEl.innerHTML = title;
    msgEl.innerHTML = message;

    if (type === 'danger') {
        okBtn.style.background = 'var(--red)';
    } else if (type === 'warning') {
        okBtn.style.background = 'var(--yellow)';
    } else {
        okBtn.style.background = 'var(--primary)';
    }

    const hide = () => {
        modal.classList.add('hidden');
        if (onClose) onClose();
    };

    okBtn.onclick = hide;
    closeBtn.onclick = hide;

    modal.classList.remove('hidden');
}

// ===== KHỞI TẠO =====
// Sự kiện DOMContentLoaded chạy ngay khi khung HTML vừa load xong
document.addEventListener('DOMContentLoaded', () => {
    if (!token) { window.location.href = '/index.html'; return; }
    loadAdminInfo();
    loadUsers(); // Tự động gọi hàm lấy dữ liệu người dùng từ server ngay lập tức
    loadStats();
    setupNavigation();

    // Đóng modal khi click ra ngoài overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
            }
        });
    });
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
            if (page === 'reports') loadReports();
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
            showAlert('Lỗi', 'Bạn không có quyền truy cập trang này.', 'danger', () => {
                window.location.href = '/html/home.html';
            });
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
        { label: 'Đăng nhập qua',   value: u.provider === 'GOOGLE' ? 'Google' : 'Local' },
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
        document.getElementById('big-pending-reports').textContent = data.pendingReports ?? '--';

        // Load charts dynamically
        if (typeof Chart !== 'undefined') {
            if (usersChartInstance) { usersChartInstance.destroy(); }
            if (activityChartInstance) { activityChartInstance.destroy(); }
            if (aiAccuracyChartInstance) { aiAccuracyChartInstance.destroy(); }

            const activeUsers = Math.max(0, (data.totalUsers || 0) - (data.bannedUsers || 0) - (data.moderators || 0));

            const ctxUsers = document.getElementById('usersChart').getContext('2d');
            usersChartInstance = new Chart(ctxUsers, {
                type: 'doughnut',
                data: {
                    labels: ['Hoạt động', 'Bị khóa', 'Moderators'],
                    datasets: [{
                        data: [activeUsers, data.bannedUsers || 0, data.moderators || 0],
                        backgroundColor: ['#10b981', '#ef4444', '#8b5cf6'],
                        borderWidth: 2,
                        borderColor: 'var(--card-bg)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: 'var(--text-main)',
                                font: { family: 'Inter', size: 12 }
                            }
                        }
                    }
                }
            });

            const ctxActivity = document.getElementById('postsReportsChart').getContext('2d');
            activityChartInstance = new Chart(ctxActivity, {
                type: 'bar',
                data: {
                    labels: ['Tổng bài viết', 'Báo cáo chưa xử lý'],
                    datasets: [{
                        label: 'Số lượng',
                        data: [data.totalPosts || 0, data.pendingReports || 0],
                        backgroundColor: ['#3b82f6', '#f59e0b'],
                        borderRadius: 8,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'var(--border)' },
                            ticks: { color: 'var(--text-muted)' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: 'var(--text-muted)' }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });

            // Biểu đồ tỉ lệ AI duyệt chính xác (Gauge-Doughnut với text center)
            const ctxAi = document.getElementById('aiAccuracyChart').getContext('2d');
            aiAccuracyChartInstance = new Chart(ctxAi, {
                type: 'doughnut',
                data: {
                    labels: ['Chính xác', 'Cần điều chỉnh'],
                    datasets: [{
                        data: [96.8, 3.2],
                        backgroundColor: ['#10b981', '#f59e0b'],
                        borderWidth: 2,
                        borderColor: 'var(--card-bg)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: 'var(--text-main)',
                                font: { family: 'Inter', size: 12 }
                            }
                        }
                    }
                },
                plugins: [{
                    id: 'textCenter',
                    beforeDraw: function(chart) {
                        const width = chart.width;
                        const height = chart.height;
                        const ctx = chart.ctx;
                        ctx.restore();
                        const fontSize = (height / 180).toFixed(2);
                        ctx.font = "bold " + fontSize + "em Inter";
                        ctx.textBaseline = "middle";
                        ctx.fillStyle = "#10b981";
                        const text = "96.8%";
                        const textX = Math.round((width - ctx.measureText(text).width) / 2);
                        const textY = height / 2 - 12;
                        ctx.fillText(text, textX, textY);
                        ctx.save();
                    }
                }]
            });
        }
    } catch (e) {
        console.error("Error loading charts:", e);
    }
}

// ===== DANH SÁCH NGƯỜI DÙNG =====
// Hàm này gọi API để lấy cục dữ liệu khổng lồ từ Java Backend
async function loadUsers() {
    document.getElementById('users-tbody').innerHTML =
        '<tr><td colspan="5" class="loading-cell"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    try {
        // Gửi request Fetch đến backend
        const res = await fetch('/api/admin/users', { headers: { 'Authorization': 'Bearer ' + token } });
        if (res.status === 403) { showToast('Bạn không có quyền xem danh sách người dùng.', 'error'); return; }
        
        // Gán toàn bộ dữ liệu trả về vào mảng allUsers (lưu vào RAM)
        allUsers = await res.json();
        
        // Đem dữ liệu đó đi vẽ lên giao diện
        renderUsers(allUsers);
        updateStatCards(allUsers);
    } catch (e) {
        document.getElementById('users-tbody').innerHTML =
            '<tr><td colspan="5" class="loading-cell">Lỗi khi tải dữ liệu.</td></tr>';
    }
}

function updateStatCards(users) {
    document.getElementById('stat-total').textContent = users.length;
    document.getElementById('stat-active').textContent = users.filter(u => u.status === 'ACTIVE').length;
    document.getElementById('stat-banned').textContent = users.filter(u => u.status === 'BANNED').length;
}

// Hàm này làm nhiệm vụ "nhặt" thông tin từ mảng dữ liệu và tạo ra các thẻ HTML <td>
function renderUsers(users) {
    const tbody = document.getElementById('users-tbody');
    document.getElementById('table-count').textContent = users.length + ' người dùng';

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">Không tìm thấy người dùng nào.</td></tr>';
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
            <td>${statusBadge(u.status)}</td>
            <td>
                <div class="admin-action-group">
                    ${u.status !== 'BANNED'
                        ? `<button class="btn-action danger" title="Khoá tài khoản" onclick="banUser(${u.id}, '${escapeHtml(u.fullName)}')"><i class="fa-solid fa-ban"></i> Khoá</button>`
                        : `<button class="btn-action success" title="Mở khoá" onclick="unbanUser(${u.id}, '${escapeHtml(u.fullName)}')"><i class="fa-solid fa-lock-open"></i> Mở khoá</button>`
                    }
                    <button class="btn-action warning" title="Cảnh báo" onclick="warnUser(${u.id}, '${escapeHtml(u.fullName)}')"><i class="fa-solid fa-triangle-exclamation"></i> Cảnh báo</button>
                    <button class="btn-action info" title="Lịch sử đăng nhập" onclick="openLoginHistory(${u.id}, '${escapeHtml(u.fullName)}')"><i class="fa-solid fa-clock-rotate-left"></i> Lịch sử</button>
                    <button class="btn-action danger-outline" title="Xoá tài khoản" onclick="deleteUser(${u.id}, '${escapeHtml(u.fullName)}')"><i class="fa-solid fa-trash"></i> Xoá</button>
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
    return `<span class="provider-local"><i class="fa-solid fa-key"></i> Local</span>`;
}

// ===== LỌC =====
// Hàm này chạy mỗi khi bạn gõ chữ vào ô tìm kiếm hoặc chọn dropdown
function filterUsers() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const status = document.getElementById('filter-status').value;

    // Lọc trực tiếp từ mảng allUsers đang lưu sẵn trong bộ nhớ (Rất nhanh, không cần gọi Server)
    const filtered = allUsers.filter(u => {
        const matchName = u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
        const matchStatus = !status || u.status === status;
        return matchName && matchStatus;
    });
    
    // Đem danh sách đã lọc đi vẽ lại lên bảng
    renderUsers(filtered);
}

// ===== CÁC THAO TÁC =====
function banUser(id, name) {
    showConfirm(
        '<i class="fa-solid fa-ban" style="color:var(--red);"></i> Khóa tài khoản',
        `Bạn có chắc chắn muốn khóa tài khoản của <strong>"${escapeHtml(name)}"</strong>?`,
        async () => {
            await adminAction(`/api/admin/users/${id}/ban`, 'PUT', `Đã khóa tài khoản ${name}`);
        },
        'danger'
    );
}

function unbanUser(id, name) {
    showConfirm(
        '<i class="fa-solid fa-lock-open" style="color:var(--green);"></i> Mở khóa tài khoản',
        `Bạn có chắc chắn muốn mở khóa tài khoản của <strong>"${escapeHtml(name)}"</strong>?`,
        async () => {
            await adminAction(`/api/admin/users/${id}/unban`, 'PUT', `Đã mở khóa tài khoản ${name}`);
        },
        'success'
    );
}

function warnUser(id, name) {
    const modal = document.getElementById('warn-user-modal');
    const idInput = document.getElementById('warn-user-id');
    if (modal && idInput) {
        idInput.value = id;
        
        // Reset form
        document.getElementById('warn-duration').value = '3';
        document.getElementById('custom-duration-container').style.display = 'none';
        document.getElementById('warn-custom-days').value = '';
        document.querySelector('input[name="warn-type"][value="POST"]').checked = true;
        
        modal.classList.remove('hidden');
    }
}

function toggleCustomDuration() {
    const durationSelect = document.getElementById('warn-duration');
    const customContainer = document.getElementById('custom-duration-container');
    if (durationSelect && customContainer) {
        if (durationSelect.value === 'custom') {
            customContainer.style.display = 'block';
        } else {
            customContainer.style.display = 'none';
        }
    }
}

async function submitUserWarning() {
    const id = document.getElementById('warn-user-id').value;
    const type = document.querySelector('input[name="warn-type"]:checked').value;
    const durationSelect = document.getElementById('warn-duration');
    let days = parseInt(durationSelect.value);

    if (durationSelect.value === 'custom') {
        days = parseInt(document.getElementById('warn-custom-days').value);
        if (isNaN(days) || days <= 0) {
            showAlert('Lỗi', 'Vui lòng nhập số ngày hợp lệ.', 'error');
            return;
        }
    }

    const user = allUsers.find(u => u.id == id);
    let existingExpiry = null;
    if (user) {
        existingExpiry = (type === 'POST') ? user.postWarningExpiresAt : user.commentWarningExpiresAt;
    }

    const now = new Date();
    let expiryDateObj = null;
    if (existingExpiry) {
        expiryDateObj = new Date(existingExpiry);
    }

    if (expiryDateObj && expiryDateObj > now) {
        const expiryStr = expiryDateObj.toLocaleString('vi-VN');
        const typeText = (type === 'POST') ? 'đăng bài' : 'bình luận';
        
        showConfirm(
            '<i class="fa-solid fa-triangle-exclamation" style="color:var(--yellow);"></i> Cảnh báo đang hoạt động',
            `Người dùng hiện đang bị cấm ${typeText} đến <b>${expiryStr}</b>. Bạn có chắc chắn muốn <b>CỘNG THÊM</b> ${days} ngày vào thời hạn này không?`,
            async () => {
                closeModal('warn-user-modal');
                await adminAction(`/api/admin/users/${id}/warn`, 'PUT', `Đã cảnh báo cộng thêm ${days} ngày thành công.`, { type, days });
            },
            'warning'
        );
    } else {
        closeModal('warn-user-modal');
        await adminAction(`/api/admin/users/${id}/warn`, 'PUT', `Đã thiết lập cảnh cáo thành công.`, { type, days });
    }
}

function deleteUser(id, name) {
    showConfirm(
        '<i class="fa-solid fa-trash" style="color:var(--red);"></i> Xóa vĩnh viễn người dùng',
        `Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản của <strong>"${escapeHtml(name)}"</strong>? <br><span style="color:var(--red); font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Hành động này không thể hoàn tác!</span>`,
        async () => {
            try {
                const res = await fetch(`/api/admin/users/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    // Xoá ngay khỏi mảng in-memory
                    allUsers = allUsers.filter(u => u.id !== id);
                    updateStatCards(allUsers);
                    // Tái áp dụng filter đang chọn thay vì reset về toàn bộ danh sách
                    filterUsers();
                    showToast(`Đã xóa tài khoản ${escapeHtml(name)}`, 'success');
                } else {
                    showToast(data.message || 'Có lỗi xảy ra khi xóa tài khoản.', 'error');
                }
            } catch (e) {
                showToast('Lỗi kết nối.', 'error');
            }
        },
        'danger'
    );
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

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// ===== DANH SÁCH BÀI VIẾT =====
let allPosts = [];
let postsCurrentPage = 0;
let postsTotalPages = 0;
let postsTotalElements = 0;
const POSTS_PAGE_SIZE = 30;
let _postSearchTimer = null;

async function loadPosts(page = 0) {
    document.getElementById('posts-tbody').innerHTML =
        '<tr><td colspan="9" class="loading-cell"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    try {
        const res = await fetch(`/api/admin/posts?page=${page}&size=${POSTS_PAGE_SIZE}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) { showToast('Không thể tải danh sách bài viết.', 'error'); return; }
        const data = await res.json();
        allPosts = data.content || [];
        postsTotalElements = data.totalElements || 0;
        postsTotalPages = data.totalPages || 0;
        postsCurrentPage = data.currentPage || 0;
        updatePostStatCards(allPosts, postsTotalElements);
        renderPosts(allPosts);
        renderPostsPagination();
    } catch (e) {
        document.getElementById('posts-tbody').innerHTML =
            '<tr><td colspan="9" class="loading-cell">Lỗi khi tải dữ liệu.</td></tr>';
    }
}

function updatePostStatCards(posts, total) {
    document.getElementById('post-stat-total').textContent = total ?? posts.length;
    document.getElementById('post-stat-public').textContent = posts.filter(p => p.visibility === 'PUBLIC').length;
    document.getElementById('post-stat-friends').textContent = posts.filter(p => p.visibility === 'FRIENDS').length;
    document.getElementById('post-stat-private').textContent = posts.filter(p => p.visibility === 'PRIVATE').length;
}

function renderPosts(posts) {
    const tbody = document.getElementById('posts-tbody');
    const showing = posts.length;
    document.getElementById('post-table-count').textContent =
        `Hiển thị ${showing} / ${postsTotalElements} bài viết (trang ${postsCurrentPage + 1}/${Math.max(1, postsTotalPages)})`;
    if (!posts.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading-cell">Không có bài viết nào.</td></tr>';
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
            <td>${postStatusBadge(p.status)}</td>
            <td>${violationScoreBadge(p.bestScore)}</td>
            <td>${visibilityBadge(p.visibility)}</td>
            <td style="text-align:center;">
                <span style="color:var(--red);font-weight:600;"><i class="fa-solid fa-heart"></i> ${p.likeCount ?? 0}</span>
            </td>
            <td style="text-align:center;">
                <span style="color:var(--blue);font-weight:600;"><i class="fa-solid fa-comment"></i> ${p.commentCount ?? 0}</span>
            </td>
            <td style="font-size:12px;color:var(--text-muted);white-space:nowrap;">${formatDate(p.createdAt)}</td>
            <td>
                <div class="admin-action-group">
                    <button class="btn-action info" title="Xem chi tiết" onclick="openPostDetail(${p.id})"><i class="fa-solid fa-eye"></i> Chi tiết</button>
                    <button class="btn-action danger-outline" title="Xoá bài viết" onclick="deletePost(${p.id})"><i class="fa-solid fa-trash"></i> Xoá</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderPostsPagination() {
    let pagEl = document.getElementById('posts-pagination');
    if (!pagEl) {
        pagEl = document.createElement('div');
        pagEl.id = 'posts-pagination';
        pagEl.className = 'pagination-bar';
        const tableCard = document.getElementById('posts-tbody').closest('.table-card');
        tableCard.appendChild(pagEl);
    }
    if (postsTotalPages <= 1) { pagEl.innerHTML = ''; return; }
    let html = '';
    html += `<button class="page-btn" ${postsCurrentPage === 0 ? 'disabled' : ''} onclick="loadPosts(${postsCurrentPage - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;
    const maxBtns = 5;
    let start = Math.max(0, postsCurrentPage - Math.floor(maxBtns / 2));
    let end = Math.min(postsTotalPages, start + maxBtns);
    if (end - start < maxBtns) start = Math.max(0, end - maxBtns);
    for (let i = start; i < end; i++) {
        html += `<button class="page-btn${i === postsCurrentPage ? ' active' : ''}" onclick="loadPosts(${i})">${i + 1}</button>`;
    }
    html += `<button class="page-btn" ${postsCurrentPage >= postsTotalPages - 1 ? 'disabled' : ''} onclick="loadPosts(${postsCurrentPage + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;
    pagEl.innerHTML = html;
}

function postStatusBadge(s) {
    const map = {
        ACTIVE:         ['badge-active',   'fa-circle-check',           'Hoạt động'],
        PUBLISHED:      ['badge-active',   'fa-circle-check',           'Đã duyệt'],
        PENDING_REVIEW: ['badge-warning',  'fa-clock',                  'Chờ duyệt'],
        AUTO_REJECTED:  ['badge-banned',   'fa-triangle-exclamation',   'Tự động ẩn'],
    };
    const [cls, icon, label] = map[s] || ['badge-inactive', 'fa-circle', s || '--'];
    return `<span class="badge ${cls}"><i class="fa-solid ${icon}"></i> ${label}</span>`;
}

function filterPosts() {
    clearTimeout(_postSearchTimer);
    _postSearchTimer = setTimeout(() => {
        const q = document.getElementById('post-search-input').value.toLowerCase();
        const visibility = document.getElementById('post-filter-visibility').value;
        const filtered = allPosts.filter(p => {
            const matchText = (p.content || '').toLowerCase().includes(q) || (p.user?.fullName || '').toLowerCase().includes(q);
            const matchVis = !visibility || p.visibility === visibility;
            return matchText && matchVis;
        });
        renderPosts(filtered);
    }, 300);
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

async function openPostDetail(id, highlightCommentId = null) {
    // Show modal immediately with loading state
    document.getElementById('post-detail-id').textContent = '#' + id;
    document.getElementById('post-detail-author').textContent = 'Đang tải...';
    document.getElementById('post-detail-meta').textContent = '';
    document.getElementById('post-detail-content').textContent = '';
    document.getElementById('post-detail-image-wrap').innerHTML = '';
    document.getElementById('post-detail-likes').textContent = '-';
    document.getElementById('post-detail-comment-count').textContent = '-';
    document.getElementById('post-detail-comments').innerHTML = '';
    document.getElementById('post-detail-modal').classList.remove('hidden');

    try {
        const res = await fetch(`/api/admin/posts/${id}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) {
            showToast('Không thể tải bài viết', 'error');
            closeModal('post-detail-modal');
            return;
        }
        const p = await res.json();

        document.getElementById('post-detail-avatar').innerHTML = p.user?.avatar
            ? `<img src="${p.user.avatar}" alt="">`
            : (p.user?.fullName?.charAt(0).toUpperCase() || '?');
        
        document.getElementById('post-detail-author').textContent = p.user?.fullName || 'Ẩn danh';
        document.getElementById('post-detail-meta').innerHTML = 
            `@${p.user?.username || 'unknown'} • ${formatDate(p.createdAt)}`;
        
        document.getElementById('post-detail-visibility-badge').innerHTML = visibilityBadge(p.visibility);

        const contentEl = document.getElementById('post-detail-content');
        contentEl.textContent = p.content || '(không có nội dung)';
        contentEl.className = 'post-content-box' + (p.content ? '' : ' empty');

        const imgWrap = document.getElementById('post-detail-image-wrap');
        let mediaHtml = '';
        if (p.imageUrl) {
            mediaHtml += `<img src="${p.imageUrl}" class="post-detail-img" alt="Ảnh bài viết" style="max-height: 360px; width: 100%; object-fit: contain; margin-bottom: 10px; display: block;">`;
        }
        if (p.videoUrl) {
            mediaHtml += `<video src="${p.videoUrl}" controls class="post-detail-img" style="max-height: 360px; width: 100%; object-fit: contain; margin-bottom: 10px; display: block; background: #000;">Trình duyệt không hỗ trợ video.</video>`;
        }
        imgWrap.innerHTML = mediaHtml;

        document.getElementById('post-detail-likes').textContent = p.likeCount ?? 0;
        document.getElementById('post-detail-comment-count').textContent = p.commentCount ?? 0;

        const commentsEl = document.getElementById('post-detail-comments');
        if (p.comments && p.comments.length > 0) {
            commentsEl.innerHTML = `<div class="comments-title"><i class="fa-solid fa-comment"></i> Bình luận (${p.comments.length})</div>` +
                p.comments.map(c => {
                    const isHighlighted = (highlightCommentId && c.id == highlightCommentId);
                    return `
                    <div class="comment-item ${isHighlighted ? 'highlighted-comment' : ''}" style="${isHighlighted ? 'border: 1px solid var(--danger); background: rgba(220, 53, 69, 0.05);' : ''}">
                        <div class="comment-avatar">
                            ${c.user?.avatar ? `<img src="${c.user.avatar}" alt="">` : (c.user?.fullName?.charAt(0).toUpperCase() || '?')}
                        </div>
                        <div class="comment-body" style="flex: 1;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div>
                                    <span class="comment-author">${escapeHtml(c.user?.fullName || 'Ẩn danh')}</span>
                                    <span class="comment-time">${formatDate(c.createdAt)}</span>
                                    ${isHighlighted ? '<span class="badge badge-banned" style="margin-left: 8px; font-size: 10px;">Bị báo cáo</span>' : ''}
                                </div>
                                <button class="action-btn danger" style="padding: 4px 8px; font-size: 12px; height: auto;" title="Xóa bình luận" onclick="deleteComment(${c.id}, ${p.id})">
                                    <i class="fa-solid fa-trash"></i> Xóa
                                </button>
                            </div>
                            <div class="comment-text">${escapeHtml(c.content || '')}</div>
                        </div>
                    </div>
                `}).join('');
            
            // Scroll to highlighted comment after a short delay
            if (highlightCommentId) {
                setTimeout(() => {
                    const highlightedEl = commentsEl.querySelector('.highlighted-comment');
                    if (highlightedEl) {
                        highlightedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
        } else {
            commentsEl.innerHTML = '<div class="no-comments">Chưa có bình luận nào.</div>';
        }

        document.getElementById('post-detail-delete-btn').onclick = () => deletePost(p.id);

    } catch (e) {
        showToast('Lỗi kết nối.', 'error');
    }
}

function deletePost(id) {
    showConfirm(
        '<i class="fa-solid fa-trash" style="color:var(--red);"></i> Xóa bài viết',
        `Bạn có chắc chắn muốn xóa bài viết <strong>#${id}</strong>? <br><span style="color:var(--red); font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Hành động này không thể hoàn tác!</span>`,
        async () => {
            try {
                const res = await fetch(`/api/admin/posts/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    showToast(`Đã xóa bài viết #${id}.`, 'success');
                    closeModal('post-detail-modal');
                    loadPosts(postsCurrentPage);
                } else {
                    showToast(data.message || 'Có lỗi xảy ra.', 'error');
                }
            } catch (e) {
                showToast('Lỗi kết nối.', 'error');
            }
        },
        'danger'
    );
}

function deleteComment(commentId, postId) {
    showConfirm(
        '<i class="fa-solid fa-trash" style="color:var(--red);"></i> Xóa bình luận',
        `Bạn có chắc chắn muốn xóa bình luận <strong>#${commentId}</strong>? <br><span style="color:var(--red); font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Hành động này không thể hoàn tác!</span>`,
        async () => {
            try {
                const res = await fetch(`/api/admin/comments/${commentId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    showToast(`Đã xóa bình luận #${commentId}.`, 'success');
                    fetchPostAndOpenDetail(postId);
                } else {
                    showToast(data.message || 'Có lỗi xảy ra.', 'error');
                }
            } catch (e) {
                showToast('Lỗi kết nối.', 'error');
            }
        },
        'danger'
    );
}

function violationScoreBadge(score) {
    const s = score || 0;
    let cls = 'badge-active';
    let label = (s * 100).toFixed(1) + '%';
    
    if (s > 0.8) cls = 'badge-banned';
    else if (s > 0.4) cls = 'badge-warning';
    
    return `<span class="badge ${cls}">${label}</span>`;
}

// ===== UTILS =====
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
            { label: 'Đăng nhập qua', value: u.provider === 'GOOGLE' ? 'Google' : 'Local' },
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
                    : '<span class="provider-local"><i class="fa-solid fa-key"></i> Local</span>'
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
                <div class="admin-action-group">
                    <button class="btn-action info" title="Xem chi tiết" onclick="openModeratorDetail(${m.id})"><i class="fa-solid fa-eye"></i> Chi tiết</button>
                    <button class="btn-action warning" title="Cập nhật thông tin" onclick="openEditModerator(${m.id})"><i class="fa-solid fa-pen"></i> Sửa</button>
                    ${m.status !== 'BANNED'
                        ? `<button class="btn-action danger" title="Khoá tài khoản" onclick="lockModerator(${m.id}, '${escapeHtml(m.fullName)}')"><i class="fa-solid fa-ban"></i> Khoá</button>`
                        : `<button class="btn-action success" title="Kích hoạt lại" onclick="activateModerator(${m.id}, '${escapeHtml(m.fullName)}')"><i class="fa-solid fa-lock-open"></i> Mở khoá</button>`
                    }
                    <button class="btn-action danger-outline" title="Xoá tài khoản" onclick="deleteModerator(${m.id}, '${escapeHtml(m.fullName)}')"><i class="fa-solid fa-trash"></i> Xoá</button>
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
            { label: 'Đăng nhập qua',   value: u.provider === 'GOOGLE' ? 'Google' : 'Local' },
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

// ===== QUẢN LÝ BÁO CÁO =====
let allReports = [];

async function loadReports() {
    const postTbody = document.getElementById('reports-post-list');
    const commentTbody = document.getElementById('reports-comment-list');
    
    if (postTbody) postTbody.innerHTML = '<tr><td colspan="7" class="loading-cell"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    if (commentTbody) commentTbody.innerHTML = '<tr><td colspan="7" class="loading-cell"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';

    try {
        const res = await fetch('/api/admin/reports', { headers: { 'Authorization': 'Bearer ' + token } });
        if (!res.ok) { showToast('Không thể tải danh sách báo cáo.', 'error'); return; }
        allReports = await res.json();
        updateReportStatCards(allReports);
        renderReports(allReports);
    } catch (e) {
        if (postTbody) postTbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Lỗi khi tải dữ liệu.</td></tr>';
        if (commentTbody) commentTbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Lỗi khi tải dữ liệu.</td></tr>';
    }
}

function updateReportStatCards(reports) {
    document.getElementById('report-stat-total').textContent = reports.length;
    document.getElementById('report-stat-pending').textContent = reports.filter(r => r.status === 'PENDING').length;
    document.getElementById('report-stat-resolved').textContent = reports.filter(r => r.status === 'RESOLVED').length;
}

function renderReports(reports) {
    const postTbody = document.getElementById('reports-post-list');
    const commentTbody = document.getElementById('reports-comment-list');
    
    document.getElementById('report-table-count').textContent = reports.filter(r => r.targetType === 'POST' || !r.targetType).length + ' báo cáo bài viết';
    const commentCountEl = document.getElementById('report-comment-table-count');
    if (commentCountEl) {
        commentCountEl.textContent = reports.filter(r => r.targetType === 'COMMENT').length + ' báo cáo bình luận';
    }

    const postReports = reports.filter(r => r.targetType === 'POST' || r.post != null);
    const commentReports = reports.filter(r => r.targetType === 'COMMENT' || r.comment != null);

    const renderReportRow = (r) => {
        const isPost = r.targetType === 'POST' || r.post != null;
        const targetCell = isPost
            ? `<div class="post-id-tag">#${r.post?.id || '--'}</div>
               <div class="post-preview-text">${escapeHtml(r.post?.content || '(Không có nội dung)')}</div>
               <div class="post-author-name">Tác giả: ${escapeHtml(r.post?.authorName || '--')}</div>`
            : `<div class="post-id-tag">Bình luận #${r.comment?.id || '--'}</div>
               <div class="post-preview-text">${escapeHtml(r.comment?.content || '(Không có nội dung)')}</div>
               <div class="post-author-name">Tác giả: ${escapeHtml(r.comment?.authorName || '--')}</div>`;
        return `
            <tr>
                <td style="color:var(--text-muted);font-size:13px;"><strong>#T-${r.id}</strong><div style="font-size:11px;color:var(--text-muted);">${escapeHtml(r.category || 'Nội dung')}</div></td>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar-sm">
                            ${r.reporter?.avatar ? `<img src="${r.reporter.avatar}" alt="">` : (r.reporter?.fullName?.charAt(0).toUpperCase() || '?')}
                        </div>
                        <div class="user-fullname">${escapeHtml(r.reporter?.fullName || 'Ẩn danh')}</div>
                    </div>
                </td>
                <td><div class="post-preview-cell">${targetCell}</div></td>
                <td class="report-reason-cell">${escapeHtml(r.reason || '')} <br> <small style="color:var(--text-muted);">${escapeHtml(r.category || '')}</small></td>
                <td style="font-size:12px;color:var(--text-muted);white-space:nowrap;">${formatDate(r.createdAt)}</td>
                <td>${reportStatusBadge(r.status)}</td>
                <td>
                    <div class="admin-action-group">
                        <button class="btn-action detail" title="Xem chi tiết" onclick="openAdminReportDetailModal(${r.id})"><i class="fa-solid fa-circle-info"></i> Chi tiết</button>
                        <button class="btn-action danger-outline" title="Xoá báo cáo" onclick="deleteReport(${r.id})"><i class="fa-solid fa-trash"></i> Xoá</button>
                    </div>
                </td>
            </tr>
        `;
    };

    // Render Post Reports
    if (postReports.length === 0) {
        postTbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Không có báo cáo bài viết nào.</td></tr>';
    } else {
        postTbody.innerHTML = postReports.map(renderReportRow).join('');
    }

    // Render Comment Reports
    if (commentReports.length === 0) {
        if (commentTbody) commentTbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Không có báo cáo bình luận nào.</td></tr>';
    } else {
        if (commentTbody) commentTbody.innerHTML = commentReports.map(renderReportRow).join('');
    }
}

// Logic chuyển tab báo cáo
document.addEventListener('DOMContentLoaded', () => {
    const reportTabs = document.querySelectorAll('.report-tab-btn');
    reportTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            reportTabs.forEach(t => {
                t.classList.remove('active');
                t.style.removeProperty('border-bottom-color');
                t.style.removeProperty('color');
            });
            tab.classList.add('active');

            const type = tab.getAttribute('data-report-type');
            if (type === 'POST') {
                document.getElementById('admin-report-post-container').style.display = 'block';
                document.getElementById('admin-report-comment-container').style.display = 'none';
            } else {
                document.getElementById('admin-report-post-container').style.display = 'none';
                document.getElementById('admin-report-comment-container').style.display = 'block';
            }
        });
    });
});

function reportStatusBadge(s) {
    const map = {
        PENDING:   ['badge-warning', 'fa-clock',        'Chờ xử lý'],
        RESOLVED:  ['badge-active',  'fa-circle-check', 'Đã giải quyết'],
        DISMISSED: ['badge-inactive', 'fa-circle-xmark', 'Đã bỏ qua'],
    };
    const [cls, icon, label] = map[s] || ['badge-inactive', 'fa-circle', s];
    return `<span class="badge ${cls}"><i class="fa-solid ${icon}"></i> ${label}</span>`;
}

function updateReportStatus(id, status) {
    const title = status === 'RESOLVED' ? 'Giải quyết báo cáo' : 'Bỏ qua báo cáo';
    const msg = status === 'RESOLVED' 
        ? 'Bạn có muốn đánh dấu đã giải quyết báo cáo này không?' 
        : 'Bạn có muốn bỏ qua báo cáo này không?';
    showConfirm(
        title,
        msg,
        async () => {
            try {
                const res = await fetch(`/api/admin/reports/${id}/status`, {
                    method: 'PUT',
                    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status })
                });
                if (res.ok) {
                    showToast('Đã cập nhật trạng thái báo cáo.', 'success');
                    loadReports();
                    loadStats();
                } else {
                    showToast('Có lỗi xảy ra.', 'error');
                }
            } catch (e) {
                showToast('Lỗi kết nối.', 'error');
            }
        },
        status === 'RESOLVED' ? 'success' : 'warning'
    );
}

function deleteReport(id) {
    showConfirm(
        '<i class="fa-solid fa-trash" style="color:var(--red);"></i> Xóa báo cáo',
        'Bạn có chắc chắn muốn xóa vĩnh viễn báo cáo này?',
        async () => {
            try {
                const res = await fetch(`/api/admin/reports/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    showToast('Đã xoá báo cáo.', 'success');
                    loadReports();
                    loadStats();
                } else {
                    showToast('Có lỗi xảy ra.', 'error');
                }
            } catch (e) {
                showToast('Lỗi kết nối.', 'error');
            }
        },
        'danger'
    );
}

function openReportedPostDetail(postId, highlightCommentId = null) {
    if (!postId) return;
    // Tận dụng modal chi tiết bài viết có sẵn
    // Ta cần fetch data bài viết vì allPosts có thể chưa load hoặc không chứa bài này
    fetchPostAndOpenDetail(postId, highlightCommentId);
}

async function fetchPostAndOpenDetail(postId, highlightCommentId = null) {
    openPostDetail(postId, highlightCommentId);
}

// ===== MODAL CHI TIẾT BÁO CÁO (ADMIN) =====

function openAdminReportDetailModal(reportId) {
    const report = allReports.find(r => r.id === reportId);
    if (!report) { showToast('Không tìm thấy dữ liệu báo cáo này.', 'error'); return; }

    const modal = document.getElementById('admin-report-detail-modal');
    if (!modal) return;
    modal.style.display = 'flex';

    // Reporter
    const reporter = report.reporter || { fullName: 'Ẩn danh', id: '?', avatar: '' };
    document.getElementById('ard-reporter-name').textContent = reporter.fullName;
    document.getElementById('ard-reporter-id').textContent = `ID: ${reporter.id}`;
    document.getElementById('ard-reporter-avatar').src = reporter.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reporter.fullName)}&background=F6DE50&color=1a1a1a`;

    // Report info
    document.getElementById('ard-category-badge').textContent = report.category || 'Nội dung';
    document.getElementById('ard-reason').textContent = report.reason || '(Không có lý do)';
    document.getElementById('ard-time').innerHTML = `<i class="fa-regular fa-clock"></i> Gửi lúc: ${report.createdAt ? new Date(report.createdAt).toLocaleString('vi-VN') : '---'}`;

    // Target
    const isPost = report.targetType === 'POST';
    const targetObj = isPost ? report.post : report.comment;
    const targetId = targetObj ? targetObj.id : '?';
    const postId = isPost ? (targetObj ? targetObj.id : null) : (report.comment?.postId || null);
    document.getElementById('ard-target-type').textContent = isPost ? 'Bài viết' : 'Bình luận';
    document.getElementById('ard-target-id').textContent = `#${targetId}`;

    // Reset AI scores
    ['ard-ai-nsfw', 'ard-ai-violence', 'ard-ai-hate'].forEach(id => {
        const el = document.getElementById(id);
        el.textContent = '0%';
        el.style.color = '#00d1b2';
    });

    // Load content
    adminFetchReportedContent(isPost, targetObj, postId);

    // Footer buttons
    const footer = document.getElementById('ard-modal-footer');
    if (footer) {
        if (report.status === 'PENDING') {
            footer.innerHTML = `
                <button type="button" class="btn btn-secondary" style="border-radius:8px; font-weight:600; padding:10px 25px; cursor:pointer; border:1px solid var(--border-color); background:var(--surface-bg); color:var(--text-main);"
                    onclick="adminResolveReport(${report.id}, 'DISMISSED')">
                    Bỏ qua
                </button>
                <button type="button" style="background:var(--red); color:#fff; border:none; padding:10px 30px; border-radius:8px; font-weight:800; box-shadow:0 4px 10px rgba(241,70,104,0.3); cursor:pointer;"
                    onclick="adminResolveReport(${report.id}, 'RESOLVED')">
                    ${isPost ? 'Xử lý vi phạm (ẩn bài)' : 'Xử lý vi phạm (xóa bình luận)'}
                </button>
            `;
        } else {
            const statusText = report.status === 'RESOLVED' ? 'Đã giải quyết' : 'Đã bỏ qua';
            const badgeClass = report.status === 'RESOLVED' ? 'badge-active' : 'badge-inactive';
            footer.innerHTML = `
                <div style="font-weight:600; color:var(--text-muted); display:flex; align-items:center; gap:8px;">
                    Trạng thái: <span class="badge ${badgeClass}">${statusText}</span>
                </div>
            `;
        }
    }
}

function closeAdminReportDetailModal() {
    const modal = document.getElementById('admin-report-detail-modal');
    if (modal) modal.style.display = 'none';
}

async function adminFetchReportedContent(isPost, targetObj, postId) {
    const bodyEl = document.getElementById('ard-content-body');
    const mediaEl = document.getElementById('ard-content-media');
    const ocrEl = document.getElementById('ard-ocr-content');

    if (!targetObj || !postId) {
        bodyEl.innerHTML = `<div style="color:#ef4444; font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Nội dung gốc đã bị xóa hoặc không tồn tại.</div>`;
        mediaEl.style.display = 'none';
        ocrEl.textContent = 'Không có bằng chứng do nội dung đã xóa.';
        return;
    }

    bodyEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải nội dung...`;
    mediaEl.style.display = 'none';
    mediaEl.innerHTML = '';
    ocrEl.textContent = 'Đang phân tích...';

    try {
        const res = await fetch(`/api/posts/${postId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) { bodyEl.innerHTML = `<div style="color:#ef4444; font-weight:600;">Nội dung bài viết gốc không khả dụng.</div>`; return; }

        const post = await res.json();
        document.getElementById('ard-target-id').textContent = `#${post.id}`;

        const author = post.user || { fullName: 'Ẩn danh', id: '?', avatar: '' };
        document.getElementById('ard-author-name').textContent = author.fullName;
        document.getElementById('ard-author-id-badge').textContent = `ID: ${author.id}`;
        document.getElementById('ard-author-avatar').src = author.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(author.fullName)}&background=F6DE50&color=1a1a1a`;

        const setScore = (elId, score) => {
            const el = document.getElementById(elId);
            const val = Math.round((score || 0) * 100);
            el.textContent = `${val}%`;
            el.style.color = val >= 50 ? '#f14668' : '#00d1b2';
        };
        setScore('ard-ai-nsfw', post.nsfwScore);
        setScore('ard-ai-violence', post.violenceScore);
        setScore('ard-ai-hate', post.hateSpeechScore);

        ocrEl.textContent = post.ocrContent || 'Không phát hiện vi phạm chữ viết trong hình ảnh/video.';
        if (post.ocrContent) ocrEl.style.color = '#c53030';

        if (isPost) {
            bodyEl.textContent = post.content || '(Không có nội dung văn bản)';
            if (post.imageUrl) {
                mediaEl.style.display = 'block';
                mediaEl.innerHTML = `<img src="${post.imageUrl}" style="max-width:100%; max-height:200px; object-fit:contain; margin-top:10px; border-radius:4px;">`;
            } else if (post.videoUrl) {
                mediaEl.style.display = 'block';
                mediaEl.innerHTML = `<video src="${post.videoUrl}" controls style="max-width:100%; max-height:200px; margin-top:10px; border-radius:4px;"></video>`;
            }
        } else {
            bodyEl.innerHTML = `
                <div style="margin-bottom:10px; padding:10px; background:#fffbeb; border-radius:6px; border-left:3px solid #f59e0b;">
                    <strong>Bình luận bị báo cáo:</strong><br>${escapeHtml(targetObj.content || '')}
                </div>
                <div style="font-size:12px; color:var(--text-muted);">
                    Nằm trong bài viết: <em>${escapeHtml(post.content ? post.content.substring(0, 50) : '')}...</em>
                </div>
            `;
        }
    } catch (err) {
        bodyEl.innerHTML = `<div style="color:#ef4444;">Lỗi khi tải nội dung.</div>`;
    }
}

function adminResolveReport(reportId, status) {
    const modal = document.getElementById('admin-action-note-modal');
    if (!modal) { executeAdminResolveReport(reportId, status, ''); return; }

    const titleEl = document.getElementById('admin-note-modal-title');
    const descEl = document.getElementById('admin-note-modal-desc');
    const confirmBtn = document.getElementById('admin-note-modal-confirm-btn');
    const inputEl = document.getElementById('admin-note-modal-input');

    inputEl.value = '';

    if (status === 'DISMISSED') {
        titleEl.innerHTML = '<i class="fa-solid fa-circle-minus" style="color:#6e7681;"></i> Bỏ qua báo cáo';
        descEl.textContent = 'Thao tác này sẽ bỏ qua khiếu nại. Nội dung bị báo cáo vẫn hoạt động bình thường.';
        confirmBtn.textContent = 'Xác nhận bỏ qua';
        confirmBtn.style.background = '#6e7681';
    } else {
        titleEl.innerHTML = '<i class="fa-solid fa-gavel" style="color:#ff4d4f;"></i> Xử lý vi phạm';
        descEl.textContent = 'Bài viết/bình luận vi phạm sẽ bị ẩn/xóa. Tác giả nhận cảnh báo và bị hạn chế đăng nội dung 3 ngày.';
        confirmBtn.textContent = 'Xác nhận xử lý';
        confirmBtn.style.background = '#ff4d4f';
    }

    confirmBtn.onclick = async () => {
        const note = inputEl.value.trim();
        closeAdminActionNoteModal();
        await executeAdminResolveReport(reportId, status, note);
    };

    modal.style.display = 'flex';
}

function closeAdminActionNoteModal() {
    const modal = document.getElementById('admin-action-note-modal');
    if (modal) { modal.style.display = 'none'; document.getElementById('admin-note-modal-input').value = ''; }
}

async function executeAdminResolveReport(reportId, status, note) {
    try {
        const res = await fetch(`/api/admin/reports/${reportId}/status`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, adminNote: note })
        });
        if (res.ok) {
            showToast('Đã xử lý báo cáo thành công.', 'success');
            closeAdminReportDetailModal();
            loadReports();
            loadStats();
        } else {
            showToast('Có lỗi xảy ra khi xử lý báo cáo.', 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối.', 'error');
    }
}

// ===========================

function filterReports() {
    const q = document.getElementById('report-search-input').value.toLowerCase();
    const status = document.getElementById('report-filter-status').value;

    const filtered = allReports.filter(r => {
        const matchText = (r.reason || '').toLowerCase().includes(q) || 
                         (r.post?.content || '').toLowerCase().includes(q) ||
                         (r.reporter?.fullName || '').toLowerCase().includes(q);
        const matchStatus = !status || r.status === status;
        return matchText && matchStatus;
    });
    renderReports(filtered);
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
function lockModerator(id, name) {
    showConfirm(
        '<i class="fa-solid fa-ban" style="color:var(--red);"></i> Khóa kiểm duyệt viên',
        `Bạn có chắc chắn muốn khóa tài khoản kiểm duyệt viên <strong>"${escapeHtml(name)}"</strong>?`,
        async () => {
            try {
                const res = await fetch(`/api/admin/moderators/${id}/lock`, {
                    method: 'PUT',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) { showToast(`Đã khoá tài khoản ${name}.`, 'success'); loadModerators(); }
                else showToast(data.message || data || 'Có lỗi xảy ra.', 'error');
            } catch (e) { showToast('Lỗi kết nối.', 'error'); }
        },
        'danger'
    );
}

function activateModerator(id, name) {
    showConfirm(
        '<i class="fa-solid fa-lock-open" style="color:var(--green);"></i> Kích hoạt kiểm duyệt viên',
        `Bạn có chắc chắn muốn kích hoạt lại tài khoản kiểm duyệt viên <strong>"${escapeHtml(name)}"</strong>?`,
        async () => {
            try {
                const res = await fetch(`/api/admin/moderators/${id}/activate`, {
                    method: 'PUT',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) { showToast(`Đã kích hoạt lại tài khoản ${name}.`, 'success'); loadModerators(); }
                else showToast(data.message || data || 'Có lỗi xảy ra.', 'error');
            } catch (e) { showToast('Lỗi kết nối.', 'error'); }
        },
        'success'
    );
}

function deleteModerator(id, name) {
    showConfirm(
        '<i class="fa-solid fa-trash" style="color:var(--red);"></i> Xóa kiểm duyệt viên',
        `Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản kiểm duyệt viên <strong>"${escapeHtml(name)}"</strong>? <br><span style="color:var(--red); font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Hành động này không thể hoàn tác!</span>`,
        async () => {
            try {
                const res = await fetch(`/api/admin/moderators/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    allModerators = allModerators.filter(m => m.id !== id);
                    updateModStatCards(allModerators);
                    filterModerators();
                    showToast(`Đã xóa tài khoản ${escapeHtml(name)}`, 'success');
                } else {
                    showToast(data.message || 'Có lỗi xảy ra khi xóa tài khoản.', 'error');
                }
            } catch (e) { showToast('Lỗi kết nối.', 'error'); }
        },
        'danger'
    );
}
