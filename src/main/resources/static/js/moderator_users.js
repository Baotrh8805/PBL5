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

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="user-cell">
                    <img src="${user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.fullName || 'User')}" width="35" style="border-radius: 50%;">
                    <div>
                        <div style="font-weight: 600;">${escapeHtml(user.fullName)}</div>
                        <div style="font-size: 11px; color: #b0b3b8;">#UID-${user.id}</div>
                    </div>
                </div>
            </td>
            <td>${escapeHtml(user.email || '(Trống)')}</td>
            <td>
                ${user.status === 'BANNED' ? '<span class="badge bg-danger">Đã khóa</span>' : 
                  user.status === 'WARNING' ? '<span class="badge bg-warning text-dark">Cảnh cáo</span>' : 
                  '<span class="badge bg-success">Bình thường</span>'}
            </td>
            <td><span style="font-size: 12px; font-weight: 700; color: #b0b3b8;">${escapeHtml(user.role || 'USER')}</span></td>
            <td class="text-center">
                <span class="badge ${user.score > 0 ? 'bg-danger text-white' : 'bg-light text-muted'}" style="padding: 5px 10px; border-radius: 10px; font-weight: bold; min-width: 30px;">
                    ${user.score || 0}
                </span>
            <td>
                <div class="action-group">
                    ${user.role === 'USER' ? `
                        <button class="btn-action warning" onclick="window.warnUser('${user.id}')" title="Cảnh cáo"><i class="fa-solid fa-triangle-exclamation"></i> Cảnh cáo</button>
                        ${user.status === 'BANNED' ? 
                            `<button class="btn-action success" onclick="window.unlockUser('${user.id}')" title="Mở khóa" style="background: #2ecc71;"><i class="fa-solid fa-user-check"></i> Mở khóa</button>` : 
                            `<button class="btn-action danger" onclick="window.openLockModal('${user.id}')" title="Khóa"><i class="fa-solid fa-user-slash"></i> Khóa</button>`
                        }
                        <button class="btn-action info" onclick="window.viewUserDetails('${user.id}')" title="Xem chi tiết" style="background: #3a3b3c; color: #e4e6eb; border: none; padding: 5px 10px; border-radius: 5px;"><i class="fa-solid fa-eye"></i> Chi tiết</button>
                    ` : `
                        <!-- Moderator: Thay Chi tiết bằng Nhắn tin -->
                        <button class="btn-action info" onclick="openChatWith(${user.id})" title="Nhắn tin" style="background: #00d1b2; color: #fff; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;"><i class="fa-solid fa-comment"></i> Nhắn tin</button>
                        ${renderFriendButton(user)}
                    `}
                </div>
            </td>
        </tr>
    `).join('');
}

function renderFriendButton(user) {
    if (user.friendStatus === 'SELF') return '';
    
    if (user.friendStatus === 'ACCEPTED') {
        return '';
    } else if (user.friendStatus === 'PENDING_RECEIVED') {
        return `<button class="btn-action success" onclick="acceptFriend(${user.id})" title="Đồng ý kết bạn" style="background: #2ecc71; color: #fff;"><i class="fa-solid fa-user-check"></i> Đồng ý</button>`;
    } else if (user.friendStatus === 'PENDING_SENT') {
        return `<button class="btn-action secondary" disabled style="background: #3e4042; color: #b0b3b8; cursor: default;"><i class="fa-solid fa-user-clock"></i> Đã gửi</button>`;
    } else {
        return `<button class="btn-action primary" onclick="addFriend(${user.id})" title="Kết bạn" style="background: #3498db; color: #fff;"><i class="fa-solid fa-user-plus"></i> Kết bạn</button>`;
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

window.warnUser = function(userId) {
    const message = prompt("Nhập nội dung cảnh cáo gửi tới người dùng:");
    if (!message || message.trim() === "") return;
    
    fetch(`/api/moderator/users/${userId}/warn`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${window.token || localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: message })
    })
    .then(res => res.json())
    .then(data => {
        showCustomAlert("Thành công", data.message, "success");
    })
    .catch(err => {
        console.error(err);
        showCustomAlert("Lỗi", "Không thể gửi cảnh cáo.", "error");
    });
};

window.banUser = async function(id) {
    showCustomConfirm('Khóa tài khoản', 'Bạn có chắc chắn muốn KHÓA tài khoản người dùng này?', async () => {
        try {
            const res = await fetch(`/api/moderator/users/${id}/ban`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
            });
            if (res.ok) {
                showCustomAlert('Thành công', 'Đã khóa tài khoản thành công.', 'success');
                loadFlaggedUsers();
            }
        } catch (e) { console.error(e); }
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
            header.style.cssText = 'border-bottom: 1px solid #3e4042; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; background: #242526;';
            title.style.cssText = 'font-size: 17px; margin: 0; color: #e4e6eb; flex: 1; text-align: left; display: flex; align-items: center; gap: 10px;';
            title.innerHTML = `<i class="fa-solid fa-user-shield" style="color: #00d1b2;"></i> Hồ sơ người dùng <span style="background: #3a3b3c; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #b0b3b8; font-weight: 400;">#UID-${userId}</span>`;

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
                <div style="position: sticky; top: -20px; z-index: 100; background: #1c1e21; padding-bottom: 20px; margin-bottom: 25px;">
                    <div style="display: flex; align-items: center; gap: 20px; padding: 20px; background: #18191a; border-radius: 12px; border: 1px solid ${isDanger ? '#f02849' : '#3e4042'}; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                        <img src="${user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.fullName)}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid ${isDanger ? '#f02849' : '#3e4042'}; object-fit: cover;">
                        <div style="flex: 1;">
                            <div style="font-size: 24px; font-weight: 800; color: #e4e6eb; margin-bottom: 6px; display: flex; align-items: center; gap: 10px;">
                                ${user.fullName}
                                <span style="font-size: 12px; font-weight: 700; color: #00d1b2; background: rgba(0,209,178,0.1); padding: 2px 10px; border-radius: 4px; border: 1px solid rgba(0,209,178,0.3);">${user.role}</span>
                                ${isDanger ? '<span style="font-size: 11px; font-weight: 800; color: #fff; background: #f02849; padding: 2px 10px; border-radius: 4px; animation: pulse 2s infinite;"><i class="fa-solid fa-triangle-exclamation"></i> VI PHẠM NHIỀU LẦN</span>' : ''}
                            </div>
                            <div style="font-size: 14px; color: #b0b3b8; line-height: 1.8;">
                                <div style="display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-envelope" style="width: 16px;"></i> ${user.email}</div>
                                <div style="display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-calendar-check" style="width: 16px;"></i> Tham gia: ${joinDateStr}</div>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px; width: 280px;">
                            <div style="display: flex; gap: 8px;">
                                <button onclick="window.showUserFullInfo(${userId})" style="flex: 1; padding: 8px; font-size: 13px; font-weight: 600; background: #3a3b3c; border: 1px solid #4e4f50; border-radius: 6px; color: #e4e6eb; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;"><i class="fa-solid fa-info-circle"></i> Thông tin</button>
                                <button onclick="window.warnUser(${userId})" style="flex: 1; padding: 8px; font-size: 13px; font-weight: 600; background: #e67e22; border: none; border-radius: 6px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;"><i class="fa-solid fa-triangle-exclamation"></i> Cảnh cáo</button>
                            </div>
                            ${user.status === 'BANNED' ? 
                                `<button onclick="unlockUser(${userId});" style="width: 100%; padding: 10px; font-size: 13px; font-weight: 600; background: #2ecc71; border: none; border-radius: 6px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="fa-solid fa-unlock"></i> Mở khóa tài khoản</button>` :
                                `<button onclick="openLockModal(${userId});" style="width: 100%; padding: 10px; font-size: 13px; font-weight: 600; background: #f02849; border: none; border-radius: 6px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="fa-solid fa-user-slash"></i> Khóa tài khoản</button>`
                            }
                        </div>
                    </div>
                    
                    ${user.status === 'BANNED' ? `
                    <div style="margin-top: 15px; background: rgba(240, 40, 73, 0.1); border: 1px solid #f02849; border-radius: 8px; padding: 12px 20px; color: #f02849; font-weight: 600; display: flex; align-items: center; gap: 15px;">
                        <i class="fa-solid fa-circle-exclamation" style="font-size: 20px;"></i>
                        <span>Tài khoản này đang trong thời gian chấp hành kỷ luật. Vui lòng kiểm tra kỹ các nội dung trước khi phê duyệt bài viết mới.</span>
                    </div>
                    ` : ''}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 35px;">
                    <div style="background: linear-gradient(145deg, #18191a, #242526); padding: 20px; border-radius: 15px; border: 1px solid #3e4042; text-align: center;">
                        <div style="font-size: 11px; color: #b0b3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Điểm Vi phạm</div>
                        <div style="font-size: 32px; font-weight: 900; color: #f02849;">${user.score || 0}</div>
                    </div>
                    <div style="background: linear-gradient(145deg, #18191a, #242526); padding: 20px; border-radius: 15px; border: 1px solid #3e4042; text-align: center;">
                        <div style="font-size: 11px; color: #b0b3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Tổng bài viết</div>
                        <div style="font-size: 32px; font-weight: 900; color: #2e89ff;">${posts.length}</div>
                    </div>
                    <div style="background: linear-gradient(145deg, #18191a, #242526); padding: 20px; border-radius: 15px; border: 1px solid #3e4042; text-align: center;">
                        <div style="font-size: 11px; color: #b0b3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Trạng thái</div>
                        <div style="margin-top: 10px;">${user.status === 'BANNED' ? 
                            '<span style="color: #f02849; background: rgba(240,40,73,0.1); padding: 6px 15px; border-radius: 6px; font-weight: 700; border: 1px solid #f02849; font-size: 13px;">ĐÃ KHÓA</span>' : 
                            '<span style="color: #2ecc71; background: rgba(46,204,113,0.1); padding: 6px 15px; border-radius: 6px; font-weight: 700; border: 1px solid #2ecc71; font-size: 13px;">HOẠT ĐỘNG</span>'}
                        </div>
                    </div>
                </div>

                <div style="border-top: 2px solid #3e4042; padding-top: 25px;">
                    <h5 style="margin: 0 0 20px 0; font-size: 17px; font-weight: 800; color: #e4e6eb; display: flex; align-items: center; gap: 12px;">
                        <i class="fa-solid fa-layer-group" style="color: #00d1b2;"></i> QUẢN LÝ BÀI VIẾT CỦA NGƯỜI DÙNG
                    </h5>
                    
                    <div style="display: flex; flex-direction: column; gap: 20px;">
                        ${posts.length === 0 ? `
                            <div style="text-align: center; padding: 60px; background: #18191a; border-radius: 15px; color: #b0b3b8; border: 2px dashed #3e4042;">
                                <i class="fa-solid fa-folder-open" style="font-size: 50px; margin-bottom: 15px; display: block; opacity: 0.2;"></i>
                                <span style="font-size: 15px;">Người dùng này chưa có bài viết nào trong hệ thống.</span>
                            </div>
                        ` : posts.map(post => {
                            const authorAvatar = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'User')}&background=00d1b2&color=fff`;
                            const postTime = typeof timeSince === 'function' ? timeSince(post.createdAt) : new Date(post.createdAt).toLocaleString('vi-VN');
                            
                            let mediaHtml = '';
                            if (post.imageUrl) mediaHtml += `<div class="post-media-container" style="margin-bottom: 12px; text-align: center; background: #000; border-radius: 8px; overflow: hidden;"><img src="${escapeHtml(post.imageUrl)}" style="max-height: 400px; width: 100%; object-fit: contain; display: block; margin: 0 auto;"></div>`;
                            if (post.videoUrl) mediaHtml += `<div class="post-media-container" style="margin-bottom: 12px; text-align: center; background: #000; border-radius: 8px; overflow: hidden;"><video src="${escapeHtml(post.videoUrl)}" controls style="max-height: 400px; width: 100%; object-fit: contain; display: block; margin: 0 auto;"></video></div>`;

                            const status = String(post.status || '').toUpperCase();
                            const isRejected = status === 'REJECTED' || status === 'AUTO_REJECTED' || status === 'DELETED';
                            const isPending = status === 'PENDING_REVIEW';
                            
                            let statusLabel = '';
                            let auditHtml = '';

                            if (isRejected) {
                                statusLabel = `<span style="font-size: 11px; color: #ff4d4f; font-weight: 800; background: rgba(255, 77, 79, 0.1); padding: 2px 8px; border-radius: 4px; margin-left: 10px; border: 1px solid #ff4d4f;">ĐÃ GỠ</span>`;
                                if (status === 'AUTO_REJECTED') {
                                    auditHtml = `<div style="margin-bottom: 15px; font-size: 13px; color: #ff4d4f; font-weight: 600; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-robot"></i> Bị gỡ bởi AI (Vi phạm tiêu chuẩn)</div>`;
                                } else if (post.reviewerName) {
                                    auditHtml = `<div style="margin-bottom: 15px; font-size: 13px; color: #ff4d4f; font-weight: 600; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-user-shield"></i> Bị gỡ bởi Moderator ${escapeHtml(post.reviewerName)}</div>`;
                                } else if (status === 'DELETED') {
                                    auditHtml = `<div style="margin-bottom: 15px; font-size: 13px; color: #65676b; font-weight: 600; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-user-xmark"></i> Đã gỡ bởi Người dùng</div>`;
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
                            if (isRejected) {
                                actionButtons = `<button class="btn-action success" onclick="restorePost('${post.id}')" style="padding: 7px 14px; font-size: 13px; font-weight: 600; background: #2ecc71; border: none; border-radius: 6px; color: white; cursor: pointer;"><i class="fa-solid fa-rotate-left"></i> Khôi phục</button>`;
                            } else {
                                actionButtons = `
                                    ${isPending ? `<button class="btn-action success" onclick="approvePost('${post.id}')" style="padding: 7px 14px; font-size: 13px; font-weight: 600; background: #2ecc71; border: none; border-radius: 6px; color: white; cursor: pointer;">Duyệt</button>` : ''}
                                    <button class="btn-action warning" onclick="hidePostAdmin('${post.id}')" style="padding: 7px 14px; font-size: 13px; font-weight: 600; background: #faad14; border: none; border-radius: 6px; color: white; cursor: pointer;">Ẩn</button>
                                    <button class="btn-action danger" onclick="deletePost('${post.id}')" style="padding: 7px 14px; font-size: 13px; font-weight: 600; background: #f02849; border: none; border-radius: 6px; color: white; cursor: pointer;">Xóa bài</button>
                                `;
                            }

                            return `
                                <article class="card post" style="margin-bottom: 25px; padding: 20px; border-radius: 12px; background: #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.1); color: #1c1e21;">
                                    <div class="post-header" style="display: flex; align-items: center; gap: 15px; margin-bottom: 18px;">
                                        <img src="${authorAvatar}" alt="Avatar" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid #e4e6eb;">
                                        <div style="flex: 1;">
                                            <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 5px;">
                                                <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #1c1e21;">${escapeHtml(user.fullName)} <span style="font-weight: 400; color: #65676b; font-size: 13px;">(ID: ${user.id})</span></h4>
                                                ${statusLabel}
                                            </div>
                                            <div style="font-size: 12px; color: #65676b; margin-top: 4px; display: flex; align-items: center; gap: 10px;">
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

                                    <div class="post-content" style="margin-bottom: 15px; font-size: 15px; line-height: 1.6; color: #1c1e21; white-space: pre-wrap;">${escapeHtml(post.content || '(Nội dung trống)')}</div>
                                    
                                    ${mediaHtml}
                                    
                                    ${auditHtml}

                                    <div class="post-footer" style="padding-top: 15px; border-top: 1px solid #e4e6eb; display: flex; gap: 25px; color: #65676b; font-size: 13px; align-items: center;">
                                        <span title="Lượt thích"><i class="fa-solid fa-thumbs-up" style="color: #3498db;"></i> <strong>${post.likeCount || 0}</strong></span>
                                        <span title="Bình luận"><i class="fa-solid fa-comment" style="color: #00d1b2;"></i> <strong>${post.commentCount || 0}</strong></span>
                                        <button class="btn-action info" style="margin-left: auto; background: #3498db; border: none; color: #fff; cursor: pointer; font-weight: 600; padding: 6px 15px; border-radius: 6px; display: flex; align-items: center; gap: 6px;" onclick="viewPostDetail('${post.id}')">
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
            <div style="margin-bottom: 12px; border-bottom: 1px solid #3e4042; padding-bottom: 8px;">
                <label style="color: #b0b3b8; font-size: 12px; display: block; margin-bottom: 2px;">Họ và tên</label>
                <div style="color: #e4e6eb; font-weight: 600;">${user.fullName}</div>
            </div>
            <div style="margin-bottom: 12px; border-bottom: 1px solid #3e4042; padding-bottom: 8px;">
                <label style="color: #b0b3b8; font-size: 12px; display: block; margin-bottom: 2px;">Email</label>
                <div style="color: #e4e6eb;">${user.email}</div>
            </div>
            <div style="margin-bottom: 12px; border-bottom: 1px solid #3e4042; padding-bottom: 8px;">
                <label style="color: #b0b3b8; font-size: 12px; display: block; margin-bottom: 2px;">Số điện thoại</label>
                <div style="color: #e4e6eb;">${user.phoneNumber || '(Chưa cập nhật)'}</div>
            </div>
            <div style="margin-bottom: 12px; border-bottom: 1px solid #3e4042; padding-bottom: 8px;">
                <label style="color: #b0b3b8; font-size: 12px; display: block; margin-bottom: 2px;">Ngày sinh</label>
                <div style="color: #e4e6eb;">${user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('vi-VN') : '(Chưa cập nhật)'}</div>
            </div>
            <div style="margin-bottom: 12px; border-bottom: 1px solid #3e4042; padding-bottom: 8px;">
                <label style="color: #b0b3b8; font-size: 12px; display: block; margin-bottom: 2px;">Giới tính</label>
                <div style="color: #e4e6eb;">${user.gender === 'MALE' ? 'Nam' : user.gender === 'FEMALE' ? 'Nữ' : 'Khác'}</div>
            </div>
            <div style="margin-bottom: 0;">
                <label style="color: #b0b3b8; font-size: 12px; display: block; margin-bottom: 2px;">Ngày tham gia</label>
                <div style="color: #e4e6eb;">${new Date(user.createdAt).toLocaleDateString('vi-VN')}</div>
            </div>
        </div>
    `;

    showCustomAlert(`Thông tin chi tiết #UID-${userId}`, infoHtml, 'info');
};
