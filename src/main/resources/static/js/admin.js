const token = localStorage.getItem('token');
// Mảng dùng để lưu trữ TOÀN BỘ dữ liệu người dùng/kiểm duyệt viên tải từ Server về.
// Giúp việc tìm kiếm (filter) diễn ra ngay trên máy khách mà không cần gọi lại Server.
let allUsers = [];
let allModerators = [];
let usersCurrentPage = 0;
const USERS_PAGE_SIZE = 10;
let filteredUsers = [];

let modsCurrentPage = 0;
const MODS_PAGE_SIZE = 10;
let filteredMods = [];
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
            if (page === 'users') loadUsers();
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
        { label: 'Email', value: u.email },
        { label: 'Tên đăng nhập', value: u.username ? '@' + u.username : null },
        { label: 'Giới tính', value: formatGender(u.gender) },
        { label: 'Ngày sinh', value: u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString('vi-VN') : null },
        { label: 'Số điện thoại', value: u.phoneNumber },
        { label: 'Đăng nhập qua', value: u.provider === 'GOOGLE' ? '🔵 Google' : '📧 Email/Mật khẩu' },
        { label: 'ID', value: '#' + u.id },
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
                    animation: false,
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
                    animation: false,
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
                    animation: false,
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
                    beforeDraw: function (chart) {
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
        filteredUsers = [...allUsers];
        usersCurrentPage = 0;

        // Đem dữ liệu đó đi vẽ lên giao diện
        renderUsersPage();
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
                <div class="action-btns">
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

function renderUsersPage() {
    const start = usersCurrentPage * USERS_PAGE_SIZE;
    const end = start + USERS_PAGE_SIZE;
    const pageUsers = filteredUsers.slice(start, end);

    const totalPages = Math.ceil(filteredUsers.length / USERS_PAGE_SIZE);
    const showing = pageUsers.length;
    document.getElementById('table-count').textContent =
        `Hiển thị ${showing} / ${filteredUsers.length} người dùng (trang ${usersCurrentPage + 1}/${Math.max(1, totalPages)})`;

    renderUsers(pageUsers);
    renderUsersPagination(totalPages);
}

function renderUsersPagination(totalPages) {
    let pagEl = document.getElementById('users-pagination');
    if (!pagEl) {
        pagEl = document.createElement('div');
        pagEl.id = 'users-pagination';
        pagEl.className = 'pagination-bar';
        const tableCard = document.getElementById('users-tbody').closest('.table-card');
        tableCard.appendChild(pagEl);
    }
    if (totalPages <= 1) { pagEl.innerHTML = ''; return; }
    let html = '';
    html += `<button class="page-btn" ${usersCurrentPage === 0 ? 'disabled' : ''} onclick="changeUsersPage(${usersCurrentPage - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;
    const maxBtns = 5;
    let start = Math.max(0, usersCurrentPage - Math.floor(maxBtns / 2));
    let end = Math.min(totalPages, start + maxBtns);
    if (end - start < maxBtns) start = Math.max(0, end - maxBtns);
    for (let i = start; i < end; i++) {
        html += `<button class="page-btn${i === usersCurrentPage ? ' active' : ''}" onclick="changeUsersPage(${i})">${i + 1}</button>`;
    }
    html += `<button class="page-btn" ${usersCurrentPage >= totalPages - 1 ? 'disabled' : ''} onclick="changeUsersPage(${usersCurrentPage + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;
    pagEl.innerHTML = html;
}

function changeUsersPage(page) {
    usersCurrentPage = page;
    renderUsersPage();
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
// Hàm này chạy mỗi khi bạn gõ chữ vào ô tìm kiếm hoặc chọn dropdown
function filterUsers() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const status = document.getElementById('filter-status').value;

    // Lọc trực tiếp từ mảng allUsers đang lưu sẵn trong bộ nhớ (Rất nhanh, không cần gọi Server)
    filteredUsers = allUsers.filter(u => {
        const matchName = (u.fullName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
        const matchStatus = !status || u.status === status;
        return matchName && matchStatus;
    });

    usersCurrentPage = 0;
    renderUsersPage();
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
            await adminAction(`/api/admin/users/${id}`, 'DELETE', `Đã xóa tài khoản ${name}`);
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
const POSTS_PAGE_SIZE = 10;
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
        ACTIVE: ['badge-active', 'fa-circle-check', 'Hoạt động'],
        PUBLISHED: ['badge-active', 'fa-circle-check', 'Đã duyệt'],
        PENDING_REVIEW: ['badge-warning', 'fa-clock', 'Chờ duyệt'],
        AUTO_REJECTED: ['badge-banned', 'fa-triangle-exclamation', 'Tự động ẩn'],
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
        PUBLIC: ['badge-active', 'fa-earth-asia', 'Công khai'],
        FRIENDS: ['badge-warning', 'fa-user-group', 'Bạn bè'],
        PRIVATE: ['badge-inactive', 'fa-lock', 'Riêng tư'],
    };
    const [cls, icon, label] = map[v] || ['badge-inactive', 'fa-circle', v];
    return `<span class="badge ${cls}"><i class="fa-solid ${icon}"></i> ${label}</span>`;
}

async function openPostDetail(id, highlightCommentId = null) {
    // Show modal immediately with loading state
    document.getElementById('post-detail-id').textContent = '#' + id;
    document.getElementById('post-detail-author').textContent = 'Đang tải...';
    document.getElementById('post-detail-meta').textContent = '';
    const aiScoresEl = document.getElementById('post-detail-ai-scores');
    if (aiScoresEl) {
        aiScoresEl.innerHTML = '';
        aiScoresEl.style.display = 'none';
    }
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

        // Parse decoupled Hate Speech scores & labels
        let contentHateScore = p.hateSpeechContentScore || 0;
        let videoHateScore = p.hateSpeechVideoScore || 0;
        let contentHateLabelVal = 0;
        let videoHateLabelVal = 0;

        if (p.speechLabels) {
            try {
                if (p.speechLabels.includes(';')) {
                    const parts = p.speechLabels.split(';');
                    const cPart = parts[0].split(':');
                    const vPart = parts[1].split(':');
                    contentHateLabelVal = parseInt(cPart[0]) || 0;
                    contentHateScore = parseFloat(cPart[1]) || contentHateScore;
                    videoHateLabelVal = parseInt(vPart[0]) || 0;
                    videoHateScore = parseFloat(vPart[1]) || videoHateScore;
                } else if (p.speechLabels.includes(':')) {
                    const part = p.speechLabels.split(':');
                    contentHateLabelVal = parseInt(part[0]) || 0;
                    contentHateScore = parseFloat(part[1]) || contentHateScore;
                }
            } catch (err) {
                console.error("Lỗi parse speechLabels:", err);
            }
        }

        // Fallback if labels are 0 but score is non-zero (for legacy posts without saved speechLabels)
        if (contentHateLabelVal === 0 && contentHateScore > 0) {
            if (contentHateScore > 0.8) contentHateLabelVal = 2;
            else if (contentHateScore > 0.4) contentHateLabelVal = 1;
        }
        if (videoHateLabelVal === 0 && videoHateScore > 0) {
            if (videoHateScore > 0.8) videoHateLabelVal = 2;
            else if (videoHateScore > 0.4) videoHateLabelVal = 1;
        }

        const labelNames = { 0: "CLEAN", 1: "OFFENSIVE", 2: "HATE" };
        const labelColors = { 0: "var(--green)", 1: "var(--yellow)", 2: "var(--red)" };

        const contentHateLabelText = labelNames[contentHateLabelVal] || "CLEAN";
        const contentLabelBg = labelColors[contentHateLabelVal] || "var(--green)";

        const videoHateLabelText = labelNames[videoHateLabelVal] || "CLEAN";
        const videoLabelBg = labelColors[videoHateLabelVal] || "var(--green)";

        // NSFW formatting
        const nsfwVal = p.nsfwScore || 0;
        let nsfwLabel = "CLEAN";
        let nsfwClass = "badge-active";
        if (nsfwVal > 0.8) {
            nsfwLabel = "HATE";
            nsfwClass = "badge-banned";
        } else if (nsfwVal > 0.4) {
            nsfwLabel = "OFFENSIVE";
            nsfwClass = "badge-warning";
        }

        // Violence formatting
        const violenceVal = p.violenceScore || 0;
        let violenceLabel = "CLEAN";
        let violenceClass = "badge-active";
        if (violenceVal > 0.8) {
            violenceLabel = "HATE";
            violenceClass = "badge-banned";
        } else if (violenceVal > 0.4) {
            violenceLabel = "OFFENSIVE";
            violenceClass = "badge-warning";
        }

        let scoresHtml = `
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-robot" style="color: var(--primary);"></i> Kết quả phân tích AI
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                <!-- NSFW -->
                <div style="flex: 1; min-width: 120px; background: var(--card-bg); padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; white-space: nowrap;">NSFW</span>
                    <div style="display: flex; align-items: center; gap: 8px; justify-content: space-between;">
                        <span style="font-size: 14px; font-weight: 700; color: var(--text-main);">${(nsfwVal * 100).toFixed(1)}%</span>
                        <span class="badge ${nsfwClass}" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; line-height: 1.2;">${nsfwLabel}</span>
                    </div>
                </div>
                <!-- Bạo lực -->
                <div style="flex: 1; min-width: 120px; background: var(--card-bg); padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; white-space: nowrap;">Bạo lực</span>
                    <div style="display: flex; align-items: center; gap: 8px; justify-content: space-between;">
                        <span style="font-size: 14px; font-weight: 700; color: var(--text-main);">${(violenceVal * 100).toFixed(1)}%</span>
                        <span class="badge ${violenceClass}" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; line-height: 1.2;">${violenceLabel}</span>
                    </div>
                </div>
                <!-- Hate Speech Bài viết -->
                <div style="flex: 1; min-width: 160px; background: var(--card-bg); padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; white-space: nowrap;">Hate Speech (Chữ)</span>
                    <div style="display: flex; align-items: center; gap: 8px; justify-content: space-between;">
                        <span style="font-size: 14px; font-weight: 700; color: var(--text-main);">${(contentHateScore * 100).toFixed(1)}%</span>
                        <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${contentLabelBg}; color: #fff; line-height: 1.2; white-space: nowrap;">${contentHateLabelText}</span>
                    </div>
                </div>
                <!-- Hate Speech Media -->
                <div style="flex: 1; min-width: 160px; background: var(--card-bg); padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; white-space: nowrap;">Hate Speech (Media)</span>
                    <div style="display: flex; align-items: center; gap: 8px; justify-content: space-between;">
                        <span style="font-size: 14px; font-weight: 700; color: var(--text-main);">${(videoHateScore * 100).toFixed(1)}%</span>
                        <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${videoLabelBg}; color: #fff; line-height: 1.2; white-space: nowrap;">${videoHateLabelText}</span>
                    </div>
                </div>
            </div>
        `;
        const aiScoresElVal = document.getElementById('post-detail-ai-scores');
        if (aiScoresElVal) {
            aiScoresElVal.innerHTML = scoresHtml;
            aiScoresElVal.style.display = 'block';
        }
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
function showUnifiedLogoutConfirm(title, message, onConfirm) {
    const oldPopup = document.getElementById('unified-confirm-popup');
    if (oldPopup) oldPopup.remove();

    const popupHtml = `
        <div id="unified-confirm-popup" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 999999;">
            <div style="background: var(--card-bg, var(--surface-bg, #ffffff)); border-radius: 8px; padding: 25px; min-width: 350px; max-width: 450px; text-align: center; box-shadow: var(--card-shadow, 0 10px 25px rgba(0,0,0,0.15)); color: var(--text-color, var(--text-primary, #212121)); border: 1px solid var(--border-color, #dbdbdb); border-top: 4px solid #10b981;">
                <i class="fa-solid fa-circle-question" style="font-size: 45px; color: #10b981; margin-bottom: 20px;"></i>
                <h3 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 700;">${title}</h3>
                <p style="margin: 0 0 25px 0; font-size: 15px; color: var(--text-muted, var(--text-secondary, #666)); line-height: 1.5;">${message}</p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="unified-confirm-no" style="background: var(--bg-color, var(--bg-main, #f5f5f5)); color: var(--text-color, var(--text-primary, #212121)); border: 1px solid var(--border-color, #dbdbdb); padding: 10px 25px; border-radius: 6px; font-weight: 600; cursor: pointer; flex: 1; transition: all 0.2s;">Hủy bỏ</button>
                    <button id="unified-confirm-yes" style="background: #10b981; color: #fff; border: none; padding: 10px 25px; border-radius: 6px; font-weight: 600; cursor: pointer; flex: 1; transition: all 0.2s;">Xác nhận</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', popupHtml);

    const yesBtn = document.getElementById('unified-confirm-yes');
    const noBtn = document.getElementById('unified-confirm-no');
    
    yesBtn.onmouseover = () => { yesBtn.style.opacity = '0.9'; };
    yesBtn.onmouseout = () => { yesBtn.style.opacity = '1'; };
    
    noBtn.onmouseover = () => { noBtn.style.background = '#e8e8e8'; };
    noBtn.onmouseout = () => { noBtn.style.background = 'var(--bg-color, var(--bg-main, #f5f5f5))'; };

    document.getElementById('unified-confirm-yes').onclick = () => {
        document.getElementById('unified-confirm-popup').remove();
        if (onConfirm) onConfirm();
    };
    document.getElementById('unified-confirm-no').onclick = () => {
        document.getElementById('unified-confirm-popup').remove();
    };
}

function logout() {
    showUnifiedLogoutConfirm(
        'Xác nhận đăng xuất',
        'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống quản trị không?',
        () => {
            localStorage.removeItem('token');
            window.location.href = '/index.html';
        }
    );
}

function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast' + (type ? ' ' + type : '');
    setTimeout(() => { toast.className = 'toast hidden'; }, 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
            { label: 'Email', value: u.email },
            { label: 'Tên đăng nhập', value: u.username ? '@' + u.username : null },
            { label: 'Giới tính', value: formatGender(u.gender) },
            { label: 'Ngày sinh', value: u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString('vi-VN') : null },
            { label: 'Số điện thoại', value: u.phoneNumber },
            { label: 'Tình trạng', value: u.relationshipStatus },
            { label: 'Đăng nhập qua', value: u.provider === 'GOOGLE' ? '🔵 Google' : '📧 Email/Mật khẩu' },
            { label: 'ID', value: '#' + u.id },
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
        filteredMods = [...allModerators];
        modsCurrentPage = 0;
        renderModsPage();
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

function renderModsPage() {
    const start = modsCurrentPage * MODS_PAGE_SIZE;
    const end = start + MODS_PAGE_SIZE;
    const pageMods = filteredMods.slice(start, end);

    const totalPages = Math.ceil(filteredMods.length / MODS_PAGE_SIZE);
    const showing = pageMods.length;
    document.getElementById('mod-table-count').textContent =
        `Hiển thị ${showing} / ${filteredMods.length} kiểm duyệt viên (trang ${modsCurrentPage + 1}/${Math.max(1, totalPages)})`;

    renderModerators(pageMods);
    renderModsPagination(totalPages);
}

function renderModsPagination(totalPages) {
    let pagEl = document.getElementById('mods-pagination');
    if (!pagEl) {
        pagEl = document.createElement('div');
        pagEl.id = 'mods-pagination';
        pagEl.className = 'pagination-bar';
        const tableCard = document.getElementById('moderators-tbody').closest('.table-card');
        tableCard.appendChild(pagEl);
    }
    if (totalPages <= 1) { pagEl.innerHTML = ''; return; }
    let html = '';
    html += `<button class="page-btn" ${modsCurrentPage === 0 ? 'disabled' : ''} onclick="changeModsPage(${modsCurrentPage - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;
    const maxBtns = 5;
    let start = Math.max(0, modsCurrentPage - Math.floor(maxBtns / 2));
    let end = Math.min(totalPages, start + maxBtns);
    if (end - start < maxBtns) start = Math.max(0, end - maxBtns);
    for (let i = start; i < end; i++) {
        html += `<button class="page-btn${i === modsCurrentPage ? ' active' : ''}" onclick="changeModsPage(${i})">${i + 1}</button>`;
    }
    html += `<button class="page-btn" ${modsCurrentPage >= totalPages - 1 ? 'disabled' : ''} onclick="changeModsPage(${modsCurrentPage + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;
    pagEl.innerHTML = html;
}

function changeModsPage(page) {
    modsCurrentPage = page;
    renderModsPage();
}

function filterModerators() {
    const q = document.getElementById('mod-search-input').value.toLowerCase();
    const status = document.getElementById('mod-filter-status').value;

    filteredMods = allModerators.filter(m => {
        const matchName = (m.fullName || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
        const matchStatus = !status || m.status === status;
        return matchName && matchStatus;
    });
    modsCurrentPage = 0;
    renderModsPage();
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
            { label: 'Email', value: u.email },
            { label: 'Tên đăng nhập', value: u.username ? '@' + u.username : null },
            { label: 'Giới tính', value: formatGender(u.gender) },
            { label: 'Ngày sinh', value: u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString('vi-VN') : null },
            { label: 'Số điện thoại', value: u.phoneNumber },
            { label: 'Đăng nhập qua', value: u.provider === 'GOOGLE' ? '🔵 Google' : '📧 Email/Mật khẩu' },
            { label: 'ID', value: '#' + u.id },
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
let postReportsCurrentPage = 0;
let commentReportsCurrentPage = 0;
const REPORTS_PAGE_SIZE = 10;
let filteredPostReports = [];
let filteredCommentReports = [];

async function loadReports() {
    const postTbody = document.getElementById('reports-post-list');
    const commentTbody = document.getElementById('reports-comment-list');

    if (postTbody) postTbody.innerHTML = '<tr><td colspan="7" class="loading-cell"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    if (commentTbody) commentTbody.innerHTML = '<tr><td colspan="7" class="loading-cell"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';

    try {
        const res = await fetch('/api/admin/reports', { headers: { 'Authorization': 'Bearer ' + token } });
        if (!res.ok) { showToast('Không thể tải danh sách báo cáo.', 'error'); return; }
        allReports = await res.json();

        filteredPostReports = allReports.filter(r => r.targetType === 'POST' || r.post != null);
        filteredCommentReports = allReports.filter(r => r.targetType === 'COMMENT' || r.comment != null);
        postReportsCurrentPage = 0;
        commentReportsCurrentPage = 0;

        updateReportStatCards(allReports);
        renderReportsPage();
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

function renderReportsPage() {
    const postStart = postReportsCurrentPage * REPORTS_PAGE_SIZE;
    const postEnd = postStart + REPORTS_PAGE_SIZE;
    const pagePostReports = filteredPostReports.slice(postStart, postEnd);

    const commentStart = commentReportsCurrentPage * REPORTS_PAGE_SIZE;
    const commentEnd = commentStart + REPORTS_PAGE_SIZE;
    const pageCommentReports = filteredCommentReports.slice(commentStart, commentEnd);

    const postTotalPages = Math.ceil(filteredPostReports.length / REPORTS_PAGE_SIZE);
    const postShowing = pagePostReports.length;
    document.getElementById('report-table-count').textContent =
        `Hiển thị ${postShowing} / ${filteredPostReports.length} báo cáo bài viết (trang ${postReportsCurrentPage + 1}/${Math.max(1, postTotalPages)})`;

    const commentTotalPages = Math.ceil(filteredCommentReports.length / REPORTS_PAGE_SIZE);
    const commentShowing = pageCommentReports.length;
    const commentCountEl = document.getElementById('report-comment-table-count');
    if (commentCountEl) {
        commentCountEl.textContent =
            `Hiển thị ${commentShowing} / ${filteredCommentReports.length} báo cáo bình luận (trang ${commentReportsCurrentPage + 1}/${Math.max(1, commentTotalPages)})`;
    }

    const pageReports = pagePostReports.concat(pageCommentReports);
    renderReports(pageReports);

    renderPostReportsPagination(postTotalPages);
    renderCommentReportsPagination(commentTotalPages);
}

function renderPostReportsPagination(totalPages) {
    let pagEl = document.getElementById('post-reports-pagination');
    if (!pagEl) {
        pagEl = document.createElement('div');
        pagEl.id = 'post-reports-pagination';
        pagEl.className = 'pagination-bar';
        const tableCard = document.getElementById('admin-report-post-container');
        if (tableCard) tableCard.appendChild(pagEl);
    }
    if (totalPages <= 1) { if (pagEl) pagEl.innerHTML = ''; return; }
    let html = '';
    html += `<button class="page-btn" ${postReportsCurrentPage === 0 ? 'disabled' : ''} onclick="changePostReportsPage(${postReportsCurrentPage - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;
    const maxBtns = 5;
    let start = Math.max(0, postReportsCurrentPage - Math.floor(maxBtns / 2));
    let end = Math.min(totalPages, start + maxBtns);
    if (end - start < maxBtns) start = Math.max(0, end - maxBtns);
    for (let i = start; i < end; i++) {
        html += `<button class="page-btn${i === postReportsCurrentPage ? ' active' : ''}" onclick="changePostReportsPage(${i})">${i + 1}</button>`;
    }
    html += `<button class="page-btn" ${postReportsCurrentPage >= totalPages - 1 ? 'disabled' : ''} onclick="changePostReportsPage(${postReportsCurrentPage + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;
    pagEl.innerHTML = html;
}

function changePostReportsPage(page) {
    postReportsCurrentPage = page;
    renderReportsPage();
}

function renderCommentReportsPagination(totalPages) {
    let pagEl = document.getElementById('comment-reports-pagination');
    if (!pagEl) {
        pagEl = document.createElement('div');
        pagEl.id = 'comment-reports-pagination';
        pagEl.className = 'pagination-bar';
        const tableCard = document.getElementById('admin-report-comment-container');
        if (tableCard) tableCard.appendChild(pagEl);
    }
    if (totalPages <= 1) { if (pagEl) pagEl.innerHTML = ''; return; }
    let html = '';
    html += `<button class="page-btn" ${commentReportsCurrentPage === 0 ? 'disabled' : ''} onclick="changeCommentReportsPage(${commentReportsCurrentPage - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;
    const maxBtns = 5;
    let start = Math.max(0, commentReportsCurrentPage - Math.floor(maxBtns / 2));
    let end = Math.min(totalPages, start + maxBtns);
    if (end - start < maxBtns) start = Math.max(0, end - maxBtns);
    for (let i = start; i < end; i++) {
        html += `<button class="page-btn${i === commentReportsCurrentPage ? ' active' : ''}" onclick="changeCommentReportsPage(${i})">${i + 1}</button>`;
    }
    html += `<button class="page-btn" ${commentReportsCurrentPage >= totalPages - 1 ? 'disabled' : ''} onclick="changeCommentReportsPage(${commentReportsCurrentPage + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;
    pagEl.innerHTML = html;
}

function changeCommentReportsPage(page) {
    commentReportsCurrentPage = page;
    renderReportsPage();
}

function renderReports(reports) {
    const postTbody = document.getElementById('reports-post-list');
    const commentTbody = document.getElementById('reports-comment-list');

    const postReports = reports.filter(r => r.targetType === 'POST' || r.post != null);
    const commentReports = reports.filter(r => r.targetType === 'COMMENT' || r.comment != null);

    // Render Post Reports
    if (postReports.length === 0) {
        postTbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Không có báo cáo bài viết nào.</td></tr>';
    } else {
        postTbody.innerHTML = postReports.map(r => `
            <tr>
                <td style="color:var(--text-muted);font-size:13px;">#${r.id}</td>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar-sm">
                            ${r.reporter?.avatar ? `<img src="${r.reporter.avatar}" alt="">` : (r.reporter?.fullName?.charAt(0).toUpperCase() || '?')}
                        </div>
                        <div class="user-fullname">${escapeHtml(r.reporter?.fullName || 'Ẩn danh')}</div>
                    </div>
                </td>
                <td>
                    <div class="post-preview-cell" onclick="openReportedPostDetail(${r.post?.id})" style="cursor:pointer;" title="Nhấn để xem chi tiết bài viết">
                        <div class="post-id-tag">#${r.post?.id || '--'}</div>
                        <div class="post-preview-text">${escapeHtml(r.post?.content || '(Không có nội dung)')}</div>
                        <div class="post-author-name">Tác giả: ${escapeHtml(r.post?.authorName || '--')}</div>
                    </div>
                </td>
                <td class="report-reason-cell">${escapeHtml(r.reason)} <br> <small style="color:var(--text-muted);">${escapeHtml(r.category || '')}</small></td>
                <td style="font-size:12px;color:var(--text-muted);white-space:nowrap;">${formatDate(r.createdAt)}</td>
                <td>${reportStatusBadge(r.status)}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn" style="background:var(--bg-hover);color:var(--primary);" title="Xem chi tiết" onclick="openReportedPostDetail(${r.post?.id})">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        ${r.status === 'PENDING' ? `
                            <button class="action-btn success" title="Giải quyết" onclick="updateReportStatus(${r.id}, 'RESOLVED')">
                                <i class="fa-solid fa-check"></i>
                            </button>
                            <button class="action-btn warning" title="Bỏ qua" onclick="updateReportStatus(${r.id}, 'DISMISSED')">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        ` : ''}
                        <button class="action-btn danger" title="Xoá báo cáo" onclick="deleteReport(${r.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Render Comment Reports
    if (commentReports.length === 0) {
        if (commentTbody) commentTbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Không có báo cáo bình luận nào.</td></tr>';
    } else {
        if (commentTbody) {
            commentTbody.innerHTML = commentReports.map(r => `
                <tr>
                    <td style="color:var(--text-muted);font-size:13px;">#${r.id}</td>
                    <td>
                        <div class="user-cell">
                            <div class="user-avatar-sm">
                                ${r.reporter?.avatar ? `<img src="${r.reporter.avatar}" alt="">` : (r.reporter?.fullName?.charAt(0).toUpperCase() || '?')}
                            </div>
                            <div class="user-fullname">${escapeHtml(r.reporter?.fullName || 'Ẩn danh')}</div>
                        </div>
                    </td>
                    <td>
                        <div class="post-preview-cell" onclick="openReportedPostDetail(${r.comment?.postId}, ${r.comment?.id})" style="cursor:pointer;" title="Nhấn để xem bài viết gốc">
                            <div class="post-id-tag">Bình luận #${r.comment?.id || '--'}</div>
                            <div class="post-preview-text">${escapeHtml(r.comment?.content || '(Không có nội dung)')}</div>
                            <div class="post-author-name">Tác giả: ${escapeHtml(r.comment?.authorName || '--')}</div>
                        </div>
                    </td>
                    <td class="report-reason-cell">${escapeHtml(r.reason)} <br> <small style="color:var(--text-muted);">${escapeHtml(r.category || '')}</small></td>
                    <td style="font-size:12px;color:var(--text-muted);white-space:nowrap;">${formatDate(r.createdAt)}</td>
                    <td>${reportStatusBadge(r.status)}</td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn" style="background:var(--bg-hover);color:var(--primary);" title="Xem chi tiết gốc" onclick="openReportedPostDetail(${r.comment?.postId}, ${r.comment?.id})">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            ${r.status === 'PENDING' ? `
                                <button class="action-btn success" title="Giải quyết" onclick="updateReportStatus(${r.id}, 'RESOLVED')">
                                    <i class="fa-solid fa-check"></i>
                                </button>
                                <button class="action-btn warning" title="Bỏ qua" onclick="updateReportStatus(${r.id}, 'DISMISSED')">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            ` : ''}
                            <button class="action-btn danger" title="Xoá báo cáo" onclick="deleteReport(${r.id})">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    }
}

// Logic chuyển tab báo cáo
document.addEventListener('DOMContentLoaded', () => {
    const reportTabs = document.querySelectorAll('.report-tab-btn');
    reportTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            reportTabs.forEach(t => {
                t.classList.remove('active');
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--text-muted)';
            });
            tab.classList.add('active');
            tab.style.borderBottomColor = 'var(--primary)';
            tab.style.color = 'var(--primary)';

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
        PENDING: ['badge-warning', 'fa-clock', 'Chờ xử lý'],
        RESOLVED: ['badge-active', 'fa-circle-check', 'Đã giải quyết'],
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

    filteredPostReports = filtered.filter(r => r.targetType === 'POST' || r.post != null);
    filteredCommentReports = filtered.filter(r => r.targetType === 'COMMENT' || r.comment != null);
    postReportsCurrentPage = 0;
    commentReportsCurrentPage = 0;
    renderReportsPage();
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
                if (res.ok) { showToast(`Đã xoá tài khoản ${name}.`, 'success'); loadModerators(); }
                else showToast(data.message || data || 'Có lỗi xảy ra.', 'error');
            } catch (e) { showToast('Lỗi kết nối.', 'error'); }
        },
        'danger'
    );
}
