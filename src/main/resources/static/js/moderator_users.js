// Khai báo các biến dùng chung từ window
var cache = window.cache || { users: [], posts: [] };
var dashboardState = window.dashboardState || { banned: 0, pending: 0 };

async function loadFlaggedUsers() {
    const list = document.getElementById('users-list');
    if (!list) return;

    try {
        const res = await fetch('/api/moderator/users', {
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
        });
        if (res.ok) {
            const users = await res.json();
            // Lọc bỏ ADMIN vì moderator không có quyền xem/thao tác admin
            cache.users = (Array.isArray(users) ? users : [])
                .filter(u => u.role !== 'ADMIN')
                .sort((a, b) => (b.score || 0) - (a.score || 0));
            filterAndRenderUsers();

            dashboardState.banned = cache.users.filter(u => String(u.status).toUpperCase() === 'BANNED').length;
            syncDashboardStats();
        }
    } catch (err) { console.error("Lỗi tải người dùng:", err); }
}

function filterAndRenderUsers() {
    const searchVal = document.getElementById('users-search-input')?.value.toLowerCase().trim() || '';
    const roleVal = document.getElementById('users-role-filter')?.value || 'ALL';

    const filtered = cache.users.filter(u => {
        const matchesSearch = !searchVal || 
            String(u.id).includes(searchVal) || 
            (u.fullName || '').toLowerCase().includes(searchVal) ||
            (u.email || '').toLowerCase().includes(searchVal);
        
        const matchesRole = roleVal === 'ALL' || u.role === roleVal;

        return matchesSearch && matchesRole;
    });

    renderUsersTable(filtered);
}

// Gắn sự kiện filter
document.getElementById('users-search-input')?.addEventListener('input', filterAndRenderUsers);
document.getElementById('users-role-filter')?.addEventListener('change', filterAndRenderUsers);

function renderUsersTable(users) {
    const tbody = document.getElementById('users-list');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 30px; color: #b0b3b8;">Không tìm thấy người dùng nào khớp với bộ lọc.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        let statusBadge = '';
        if (user.status === 'BANNED') {
            statusBadge = `<span class="status-badge danger"><i class="fa-solid fa-user-slash"></i> Đã khóa</span>`;
        } else if (user.status === 'WARNING') {
            statusBadge = `<span class="status-badge warning"><i class="fa-solid fa-triangle-exclamation"></i> Cảnh cáo</span>`;
        } else {
            statusBadge = `<span class="status-badge success"><i class="fa-solid fa-circle-check"></i> Hoạt động</span>`;
        }

        const scoreClass = user.score > 0 ? 'high' : 'low';
        const roleClass = (user.role === 'MODERATOR') ? 'role-moderator' : 'role-user';
        const roleIcon  = (user.role === 'MODERATOR') ? 'fa-user-shield' : 'fa-user';
        const roleLabel = `<span class="role-badge ${roleClass}"><i class="fa-solid ${roleIcon}"></i> ${escapeHtml(user.role || 'USER')}</span>`;

        return `
        <tr>
            <td>
                <div class="user-cell" style="display: flex; align-items: center; gap: 10px;">
                    <img src="${user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.fullName || 'User') + '&background=F6DE50&color=1a1a1a'}" width="38" height="38" style="border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);">
                    <div>
                        <div style="font-weight: 700; color: var(--text-primary); font-size: 13.5px;">${escapeHtml(user.fullName)}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">#UID-${user.id}</div>
                    </div>
                </div>
            </td>
            <td style="color: var(--text-secondary); font-size: 13px;">${escapeHtml(user.email || '(Trống)')}</td>
            <td>${statusBadge}</td>
            <td>${roleLabel}</td>
            <td class="text-center">
                <span class="user-score-badge ${scoreClass}">
                    ${user.score || 0}
                </span>
            </td>
            <td>
                <div class="action-group">
                    ${user.role === 'USER' ? `
                        <button class="btn-action warning" onclick="window.warnUser('${user.id}')" title="Cảnh cáo"><i class="fa-solid fa-triangle-exclamation"></i> Cảnh cáo</button>
                        ${user.status === 'BANNED' ?
                            `<button class="btn-action success" onclick="window.unlockUser('${user.id}')" title="Mở khóa"><i class="fa-solid fa-user-check"></i> Mở khóa</button>` :
                            `<button class="btn-action danger" onclick="window.openLockModal('${user.id}')" title="Khóa"><i class="fa-solid fa-user-slash"></i> Khóa</button>`
                        }
                        <button class="btn-action detail" onclick="window.viewUserDetails('${user.id}')" title="Xem chi tiết"><i class="fa-solid fa-eye"></i> Chi tiết</button>
                        <button class="btn-action danger-outline" onclick="window.deleteModUser(${user.id}, '${escapeHtml(user.fullName)}')" title="Xóa tài khoản"><i class="fa-solid fa-trash"></i> Xóa</button>
                    ` : `
                        <!-- Moderator: Thay Chi tiết bằng Nhắn tin -->
                        <button class="btn-action chat" onclick="openChatWith(${user.id})" title="Nhắn tin"><i class="fa-solid fa-comment"></i> Nhắn tin</button>
                        ${renderFriendButton(user)}
                    `}
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

function renderFriendButton(user) {
    if (user.friendStatus === 'SELF') return '';
    
    if (user.friendStatus === 'ACCEPTED') {
        return '';
    } else if (user.friendStatus === 'PENDING_RECEIVED') {
        return `<button class="btn-action success" onclick="acceptFriend(${user.id})" title="Đồng ý kết bạn"><i class="fa-solid fa-user-check"></i> Đồng ý</button>`;
    } else if (user.friendStatus === 'PENDING_SENT') {
        return `<button class="btn-action secondary" disabled><i class="fa-solid fa-user-clock"></i> Đã gửi</button>`;
    } else {
        return `<button class="btn-action add-friend" onclick="addFriend(${user.id})" title="Kết bạn"><i class="fa-solid fa-user-plus"></i> Kết bạn</button>`;
    }
}

window.addFriend = async function(id) {
    try {
        const res = await fetch(`/api/friends/request/${id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
        });
        if (res.ok) {
            showCustomAlert('Thành công', 'Đã gửi lời mời kết bạn.', 'success');
            loadFlaggedUsers();
        }
    } catch (e) { console.error(e); }
};

window.acceptFriend = async function(id) {
    try {
        const res = await fetch(`/api/friends/accept/${id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
        });
        if (res.ok) {
            showCustomAlert('Thành công', 'Đã trở thành bạn bè.', 'success');
            loadFlaggedUsers();
        }
    } catch (e) { console.error(e); }
};

window.openChatWith = function(id) {
    // 1. Mở thanh bên nếu đang đóng
    const rightRail = document.querySelector('.mod-chat-sidebar');
    if (rightRail && rightRail.classList.contains('collapsed')) {
        rightRail.classList.remove('collapsed');
        const toggleBtn = document.getElementById('toggle-right-rail');
        if (toggleBtn) toggleBtn.classList.remove('active');
    }

    // 2. Chuyển sang tab tin nhắn
    const msgTab = document.querySelector('.right-rail-tab[data-rail-tab="messages"]');
    if (msgTab) msgTab.click();
    
    // 3. Gọi hàm selectPartner để mở chat window và load tin nhắn
    if (typeof selectPartner === 'function') {
        selectPartner(id);
    }
};

// Các modal xử lý warn và lock đã được định nghĩa và quản lý tập trung ở moderator_core.js

window.unlockUser = async function(id) {
    showCustomConfirm('Mở khóa tài khoản', 'Bạn có chắc chắn muốn MỞ KHÓA tài khoản người dùng này?', async () => {
        try {
            const res = await fetch(`/api/moderator/users/${id}/unlock`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${window.token || localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            if (res.ok) {
                showCustomAlert('Thành công', 'Đã mở khóa tài khoản thành công.', 'success');
                if (typeof loadFlaggedUsers === 'function') loadFlaggedUsers();
                // Nếu đang mở modal chi tiết thì tải lại thông tin chi tiết
                const modal = document.getElementById('user-profile-modal');
                if (modal && !modal.classList.contains('profile-modal-hidden')) {
                    viewUserDetails(id);
                }
            } else {
                const msg = await res.text();
                showCustomAlert('Lỗi', msg || 'Không thể mở khóa tài khoản.', 'error');
            }
        } catch (e) { 
            console.error(e);
            showCustomAlert('Lỗi kết nối', 'Không thể kết nối đến máy chủ.', 'error');
        }
    });
};

window.closeUserProfileModal = function() {
    const modal = document.getElementById('user-profile-modal');
    if (modal) modal.classList.add('profile-modal-hidden');
};

window.viewUserDetails = async function(userId) {
    try {
        const res = await fetch(`/api/moderator/users/${userId}/posts`, {
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
        });
        if (res.ok) {
            const posts = await res.json();
            const user = cache.users.find(u => u.id == userId);
            
            const modal = document.getElementById('user-profile-modal');
            const modalBody = modal.querySelector('.modal-body');
            const header = modal.querySelector('.modal-header');
            const title = document.getElementById('user-profile-modal-title');

            // 1. Reset Header (Dọn dẹp sạch sẽ, không nút thừa)
            header.style.cssText = 'border-bottom: 1px solid var(--border-color); padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; background: var(--surface-bg);';
            title.style.cssText = 'font-size: 17px; margin: 0; color: var(--text-primary); flex: 1; text-align: left; display: flex; align-items: center; gap: 10px;';
            title.innerHTML = `<i class="fa-solid fa-user-shield" style="color: var(--mod-primary);"></i> Hồ sơ người dùng <span style="background: var(--bg-main); padding: 2px 8px; border-radius: 4px; font-size: 12px; color: var(--text-secondary); font-weight: 400; border: 1px solid var(--border-color);">#UID-${userId}</span>`;

            let oldExtra = header.querySelector('.mod-user-extra-actions');
            if (oldExtra) oldExtra.remove();
            
            // LƯU Ý QUAN TRỌNG: Lưu các bài viết này vào cache chung để viewPostDetail có thể tìm thấy
            if (!window.cache) window.cache = { posts: [], users: [] };
            posts.forEach(p => {
                if (!window.cache.posts.find(cp => cp.id == p.id)) {
                    window.cache.posts.push(p);
                }
            });

            // 2. Rebuild Modal Body hoàn toàn mới
            // Format ngày tham gia an toàn
            const joinDate = user.createdAt || user.created_at;
            const joinDateStr = joinDate ? new Date(joinDate).toLocaleDateString('vi-VN') : 'N/A';
            const isDanger = (user.score || 0) >= 3;

            modalBody.innerHTML = `
                <!-- Tóm tắt người dùng - Sticky Header -->
                <div style="position: sticky; top: -20px; z-index: 100; background: var(--bg-main); padding-bottom: 20px; margin-bottom: 25px;">
                    <div style="display: flex; align-items: center; gap: 20px; padding: 20px; background: var(--surface-bg); border-radius: 12px; border: 1px solid ${isDanger ? 'var(--danger-color)' : 'var(--border-color)'}; box-shadow: var(--card-shadow);">
                        <img src="${user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.fullName) + '&background=F6DE50&color=1a1a1a'}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid ${isDanger ? 'var(--danger-color)' : 'var(--border-color)'}; object-fit: cover;">
                        <div style="flex: 1;">
                            <div style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin-bottom: 6px; display: flex; align-items: center; gap: 10px;">
                                ${user.fullName}
                                <span class="role-badge ${user.role === 'MODERATOR' ? 'role-moderator' : 'role-user'}"><i class="fa-solid ${user.role === 'MODERATOR' ? 'fa-user-shield' : 'fa-user'}"></i> ${user.role}</span>
                                ${isDanger ? '<span style="font-size: 10px; font-weight: 800; color: #fff; background: var(--danger-color); padding: 2px 10px; border-radius: 4px; animation: pulse 2s infinite;"><i class="fa-solid fa-triangle-exclamation"></i> VI PHẠM NHIỀU LẦN</span>' : ''}
                            </div>
                            <div style="font-size: 13.5px; color: var(--text-secondary); line-height: 1.8;">
                                <div style="display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-envelope" style="width: 16px; color: var(--mod-primary);"></i> ${user.email}</div>
                                <div style="display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-calendar-check" style="width: 16px; color: var(--mod-primary);"></i> Tham gia: ${joinDateStr}</div>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px; width: 280px;">
                            <div style="display: flex; gap: 8px;">
                                <button class="btn-action detail" onclick="window.showUserFullInfo(${userId})" style="flex: 1; justify-content: center;"><i class="fa-solid fa-info-circle"></i> Thông tin</button>
                                <button class="btn-action warning" onclick="window.warnUser(${userId})" style="flex: 1; justify-content: center;"><i class="fa-solid fa-triangle-exclamation"></i> Cảnh cáo</button>
                            </div>
                            ${user.status === 'BANNED' ? 
                                `<button class="btn-action success" onclick="unlockUser(${userId});" style="width: 100%; justify-content: center; height: 36px; font-size: 13px;"><i class="fa-solid fa-unlock"></i> Mở khóa tài khoản</button>` :
                                `<button class="btn-action danger" onclick="openLockModal(${userId});" style="width: 100%; justify-content: center; height: 36px; font-size: 13px;"><i class="fa-solid fa-user-slash"></i> Khóa tài khoản</button>`
                            }
                        </div>
                    </div>
                    
                    ${user.status === 'BANNED' ? `
                    <div style="margin-top: 15px; background: rgba(240, 40, 73, 0.08); border: 1px solid var(--danger-color); border-radius: 10px; padding: 12px 20px; color: var(--danger-color); font-weight: 600; display: flex; align-items: center; gap: 15px;">
                        <i class="fa-solid fa-circle-exclamation" style="font-size: 20px;"></i>
                        <span>Tài khoản này đang trong thời gian chấp hành kỷ luật. Vui lòng kiểm tra kỹ các nội dung trước khi phê duyệt bài viết mới.</span>
                    </div>
                    ` : ''}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 35px;">
                    <div style="background: var(--surface-bg); padding: 16px; border-radius: 12px; border: 1px solid var(--border-color); text-align: center;">
                        <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 700;">Điểm Vi phạm</div>
                        <div style="font-size: 28px; font-weight: 800; color: var(--danger-color);">${user.score || 0}</div>
                    </div>
                    <div style="background: var(--surface-bg); padding: 16px; border-radius: 12px; border: 1px solid var(--border-color); text-align: center;">
                        <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 700;">Tổng bài viết</div>
                        <div style="font-size: 28px; font-weight: 800; color: var(--mod-primary);">${posts.length}</div>
                    </div>
                    <div style="background: var(--surface-bg); padding: 16px; border-radius: 12px; border: 1px solid var(--border-color); text-align: center;">
                        <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 700;">Trạng thái</div>
                        <div style="margin-top: 6px;">${user.status === 'BANNED' ? 
                            '<span class="status-badge danger"><i class="fa-solid fa-user-slash"></i> ĐÃ KHÓA</span>' : 
                            '<span class="status-badge success"><i class="fa-solid fa-circle-check"></i> HOẠT ĐỘNG</span>'}
                        </div>
                    </div>
                </div>

                <div style="border-top: 2px solid var(--border-color); padding-top: 25px;">
                    <h5 style="margin: 0 0 20px 0; font-size: 17px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 12px;">
                        <i class="fa-solid fa-layer-group" style="color: #00d1b2;"></i> QUẢN LÝ BÀI VIẾT CỦA NGƯỜI DÙNG
                    </h5>
                    
                    <div style="display: flex; flex-direction: column; gap: 20px;">
                        ${posts.length === 0 ? `
                            <div style="text-align: center; padding: 60px; background: var(--bg-main); border-radius: 15px; color: var(--text-secondary); border: 2px dashed var(--border-color);">
                                <i class="fa-solid fa-folder-open" style="font-size: 50px; margin-bottom: 15px; display: block; opacity: 0.2;"></i>
                                <span style="font-size: 15px;">Người dùng này chưa có bài viết nào trong hệ thống.</span>
                            </div>
                        ` : posts.map(post => {
                            const authorAvatar = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'User')}&background=F6DE50&color=1a1a1a&size=52`;
                            const postTime = typeof timeSince === 'function' ? timeSince(post.createdAt) : new Date(post.createdAt).toLocaleString('vi-VN');
                            
                            let mediaHtml = '';
                            if (post.imageUrl) mediaHtml += `<div class="post-media-container" style="margin-bottom: 12px; text-align: center; background: #000; border-radius: 8px; overflow: hidden;"><img src="${escapeHtml(post.imageUrl)}" style="max-height: 400px; width: 100%; object-fit: contain; display: block; margin: 0 auto;"></div>`;
                            if (post.videoUrl) mediaHtml += `<div class="post-media-container" style="margin-bottom: 12px; text-align: center; background: #000; border-radius: 8px; overflow: hidden;"><video src="${escapeHtml(post.videoUrl)}" controls style="max-height: 400px; width: 100%; object-fit: contain; display: block; margin: 0 auto;"></video></div>`;

                            const status = String(post.status || '').toUpperCase();
                            const isRejected = status === 'REJECTED' || status === 'AUTO_REJECTED';
                            const isDeleted = status === 'DELETED';
                            const isPending = status === 'PENDING_REVIEW';
                            
                            let statusLabel = '';
                            let auditHtml = '';

                            if (isDeleted) {
                                statusLabel = `<span style="font-size: 11px; color: #8c8c8c; font-weight: 800; background: rgba(140, 140, 140, 0.1); padding: 2px 8px; border-radius: 4px; margin-left: 10px; border: 1px solid #8c8c8c;">NGƯỜI DÙNG XÓA</span>`;
                                auditHtml = `<div style="margin-bottom: 15px; font-size: 13px; color: var(--text-secondary); font-weight: 600; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-user-xmark"></i> Đã gỡ bởi Người dùng</div>`;
                            } else if (isRejected) {
                                statusLabel = `<span style="font-size: 11px; color: #ff4d4f; font-weight: 800; background: rgba(255, 77, 79, 0.1); padding: 2px 8px; border-radius: 4px; margin-left: 10px; border: 1px solid #ff4d4f;">ĐÃ GỠ</span>`;
                                if (status === 'AUTO_REJECTED') {
                                    auditHtml = `<div style="margin-bottom: 15px; font-size: 13px; color: #ff4d4f; font-weight: 600; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-robot"></i> Bị gỡ bởi AI (Vi phạm tiêu chuẩn)</div>`;
                                } else if (post.reviewerName) {
                                    auditHtml = `<div style="margin-bottom: 15px; font-size: 13px; color: #ff4d4f; font-weight: 600; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-user-shield"></i> Bị gỡ bởi Moderator ${escapeHtml(post.reviewerName)}</div>`;
                                }
                            } else if (isPending) {
                                statusLabel = `<span style="font-size: 11px; color: #faad14; font-weight: 800; background: rgba(250, 173, 20, 0.1); padding: 2px 8px; border-radius: 4px; margin-left: 10px; border: 1px solid #faad14;">CHỜ DUYỆT</span>`;
                            } else {
                                statusLabel = `<span style="font-size: 11px; color: #00d1b2; font-weight: 800; background: rgba(0, 209, 178, 0.1); padding: 2px 8px; border-radius: 4px; margin-left: 10px; border: 1px solid #00d1b2;">ĐÃ DUYỆT</span>`;
                                if (post.reviewerName) {
                                    auditHtml = `<div style="margin-bottom: 15px; font-size: 13px; color: #00d1b2; font-weight: 600; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-user-check"></i> Được duyệt bởi Moderator ${escapeHtml(post.reviewerName)}</div>`;
                                } else {
                                    auditHtml = `<div style="margin-bottom: 15px; font-size: 13px; color: #00d1b2; font-weight: 600; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-robot"></i> Được duyệt bởi AI (Tự động)</div>`;
                                }
                            }

                            let actionButtons = '';
                            if (isDeleted) {
                                actionButtons = '';
                            } else if (isRejected) {
                                actionButtons = `<button class="btn-action success" onclick="restorePost('${post.id}')"><i class="fa-solid fa-rotate-left"></i> Khôi phục</button>`;
                            } else {
                                actionButtons = `
                                    ${isPending ? `<button class="btn-action success" onclick="approvePost('${post.id}')"><i class="fa-solid fa-check"></i> Duyệt</button>` : ''}
                                    <button class="btn-action danger" onclick="deletePost('${post.id}')"><i class="fa-solid fa-trash-can"></i> Xóa bài</button>
                                `;
                            }

                            return `
                                <article class="card post" style="margin-bottom: 25px; padding: 20px; border-radius: 12px; background: var(--surface-bg); box-shadow: var(--card-shadow); color: var(--text-primary); border: 1px solid var(--border-color);">
                                    <div class="post-header" style="display: flex; align-items: center; gap: 15px; margin-bottom: 18px;">
                                        <img src="${authorAvatar}" alt="Avatar" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);">
                                        <div style="flex: 1;">
                                            <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 5px;">
                                                <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-primary);">${escapeHtml(user.fullName)} <span style="font-weight: 400; color: var(--text-secondary); font-size: 13px;">(ID: ${user.id})</span></h4>
                                                ${statusLabel}
                                            </div>
                                            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; display: flex; align-items: center; gap: 10px;">
                                                <span><i class="fa-solid fa-hashtag"></i> P-${post.id}</span>
                                                <span>•</span>
                                                <span><i class="fa-solid fa-clock"></i> ${postTime}</span>
                                                <span>•</span>
                                                <span>${post.visibility === 'PUBLIC' ? '<i class="fa-solid fa-earth-americas"></i>' : (post.visibility === 'FRIENDS' ? '<i class="fa-solid fa-user-group"></i>' : '<i class="fa-solid fa-lock"></i>')}</span>
                                            </div>
                                        </div>
                                        <div class="post-actions" style="display: flex; gap: 8px;">
                                            ${actionButtons}
                                        </div>
                                    </div>

                                    <div class="post-content" style="margin-bottom: 15px; font-size: 15px; line-height: 1.6; color: var(--text-primary); white-space: pre-wrap;">${escapeHtml(post.content || '(Nội dung trống)')}</div>
                                    
                                    ${mediaHtml}
                                    
                                    ${auditHtml}

                                    <div class="post-footer" style="padding-top: 15px; border-top: 1px solid var(--border-color); display: flex; gap: 25px; color: var(--text-secondary); font-size: 13px; align-items: center;">
                                        <span title="Lượt thích"><i class="fa-solid fa-thumbs-up" style="color: #3498db;"></i> <strong>${post.likeCount || 0}</strong></span>
                                        <span title="Bình luận"><i class="fa-solid fa-comment" style="color: #00d1b2;"></i> <strong>${post.commentCount || 0}</strong></span>
                                        <button class="btn-action primary" style="margin-left: auto;" onclick="viewPostDetail('${post.id}')">
                                            <i class="fa-solid fa-circle-info"></i> Xem chi tiết
                                        </button>
                                    </div>
                                </article>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;

            modal.classList.remove('profile-modal-hidden');
        }
    } catch (e) { console.error(e); }
};

window.showUserFullInfo = function(userId) {
    const user = cache.users.find(u => u.id == userId);
    if (!user) return;

    const infoHtml = `
        <div style="text-align: left; padding: 10px;">
            <div style="margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                <label style="color: var(--text-secondary); font-size: 12px; display: block; margin-bottom: 2px;">Họ và tên</label>
                <div style="color: var(--text-primary); font-weight: 600;">${user.fullName}</div>
            </div>
            <div style="margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                <label style="color: var(--text-secondary); font-size: 12px; display: block; margin-bottom: 2px;">Email</label>
                <div style="color: var(--text-primary);">${user.email}</div>
            </div>
            <div style="margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                <label style="color: var(--text-secondary); font-size: 12px; display: block; margin-bottom: 2px;">Số điện thoại</label>
                <div style="color: var(--text-primary);">${user.phoneNumber || '(Chưa cập nhật)'}</div>
            </div>
            <div style="margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                <label style="color: var(--text-secondary); font-size: 12px; display: block; margin-bottom: 2px;">Ngày sinh</label>
                <div style="color: var(--text-primary);">${user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('vi-VN') : '(Chưa cập nhật)'}</div>
            </div>
            <div style="margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                <label style="color: var(--text-secondary); font-size: 12px; display: block; margin-bottom: 2px;">Giới tính</label>
                <div style="color: var(--text-primary);">${user.gender === 'MALE' ? 'Nam' : user.gender === 'FEMALE' ? 'Nữ' : 'Khác'}</div>
            </div>
            <div style="margin-bottom: 0;">
                <label style="color: var(--text-secondary); font-size: 12px; display: block; margin-bottom: 2px;">Ngày tham gia</label>
                <div style="color: var(--text-primary);">${new Date(user.createdAt).toLocaleDateString('vi-VN')}</div>
            </div>
        </div>
    `;

    showCustomAlert(`Thông tin chi tiết #UID-${userId}`, infoHtml, 'info');
};

window.deleteModUser = function(id, name) {
    showCustomConfirm(
        '<i class="fa-solid fa-trash" style="color:var(--danger-color);"></i> Xóa vĩnh viễn người dùng',
        `Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản của <strong>"${escapeHtml(name)}"</strong>?<br><span style="color:var(--danger-color); font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Hành động này không thể hoàn tác!</span>`,
        async () => {
            try {
                const res = await fetch(`/api/moderator/users/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    cache.users = cache.users.filter(u => u.id !== id);
                    filterAndRenderUsers();
                    showCustomAlert('Thành công', `Đã xóa tài khoản ${escapeHtml(name)}.`, 'success');
                } else {
                    showCustomAlert('Lỗi', data.message || 'Có lỗi xảy ra khi xóa tài khoản.', 'error');
                }
            } catch (e) {
                showCustomAlert('Lỗi kết nối', 'Không thể kết nối đến máy chủ.', 'error');
            }
        }
    );
};
