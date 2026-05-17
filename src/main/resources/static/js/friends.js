document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }
    
    fetchUserProfile(token);
    loadData();
    fetchSidebarSuggestions(token);
});

// Fetch User Profile and Populate Sidebar
async function fetchUserProfile(token) {
    try {
        const res = await fetch('/api/users/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            
            document.querySelectorAll('.user-name').forEach(el => {
                el.textContent = data.fullName || 'Người dùng';
            });
            
            let avatarUrl = data.avatar;
            if (!avatarUrl && data.fullName) {
                avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.fullName)}&background=00d1b2&color=fff`;
            }

            document.querySelectorAll('#header-avatar, .avatar-large, .avatar-small, #modal-avatar').forEach(img => {
                img.src = avatarUrl;
            });

            // Admin/Moderator Menu
            if (data.role === 'ADMIN' || data.role === 'MODERATOR') {
                const adminContainer = document.getElementById('admin-menu-container');
                if (adminContainer) {
                    adminContainer.innerHTML = `
                        <a href="/html/admin.html" id="admin-menu-item" class="menu-item admin-menu-item">
                            <i class="fa-solid ${data.role === 'ADMIN' ? 'fa-shield-halved' : 'fa-user-shield'}"></i>
                            <span>${data.role === 'ADMIN' ? 'Quản trị hệ thống' : 'Kiểm duyệt'}</span>
                        </a>
                    `;
                }
            }
        }
    } catch (err) {
        console.error("Error fetching profile", err);
    }
}

function switchTab(tab) {
    document.querySelectorAll('.nav-links-friends div').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');

    document.querySelectorAll('.friend-section').forEach(el => el.style.display = 'none');
    document.getElementById('section-' + tab).style.display = 'block';
}

async function loadData() {
    const token = localStorage.getItem('token');
    
    // 1. Suggestions
    try {
        const res = await fetch('/api/friends/suggestions', { headers: { 'Authorization': `Bearer ${token}` } });
        const suggestions = await res.json();
        renderList('suggestions-list', suggestions, 'suggestions');
    } catch(e) {}

    // 2. Requests
    try {
        const res = await fetch('/api/friends/requests', { headers: { 'Authorization': `Bearer ${token}` } });
        const requests = await res.json();
        renderList('requests-list', requests, 'requests');
    } catch(e) {}

    // 3. Friends
    try {
        const res = await fetch('/api/friends', { headers: { 'Authorization': `Bearer ${token}` } });
        const friends = await res.json();
        renderList('my-friends-list', friends, 'friends');
    } catch(e) {}
}

function renderList(elementId, list, type) {
    const el = document.getElementById(elementId);
    if (!list || list.length === 0) {
        let msg = "Không có người dùng hợp lệ.";
        if (type === 'suggestions') msg = "Bạn đã kết bạn với tất cả mọi người trên mạng lưới này!";
        else if (type === 'requests') msg = "Bạn Không có lời mời kết bạn nào đang chờ.";
        else if (type === 'friends') msg = "Danh sách bạn bè của bạn đang trống.";
        
        el.innerHTML = `<div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: #65676B; font-size: 16px;">${msg}</div>`;
        return;
    }

    el.innerHTML = '';
    list.forEach(u => {
        let buttons = '';
        
        let avatarUrl = u.avatar;
        if (!avatarUrl || avatarUrl.trim() === '') {
            avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.fullName)}&background=00d1b2&color=fff`;
        }

        if (type === 'suggestions') {
            buttons = `
                <button id="friend-btn-${u.id}" class="friend-btn btn-add" style="margin-bottom: 5px;" onclick="actionFriend(${u.id}, 'request')">Thêm bạn bè</button>
                <button class="friend-btn btn-secondary" onclick="openChatBox(${u.id}, '${u.fullName}', '${avatarUrl}')">Nhắn tin</button>
            `;
        } else if(type === 'requests') {
            buttons = `
                <button class="friend-btn btn-confirm" style="margin-bottom: 5px;" onclick="actionFriend(${u.id}, 'accept')">Chấp nhận</button>
                <button class="friend-btn btn-secondary" style="margin-bottom: 5px;" onclick="openChatBox(${u.id}, '${u.fullName}', '${avatarUrl}')">Nhắn tin</button>
                <button class="friend-btn btn-delete" onclick="actionFriend(${u.id}, 'delete')">Xóa</button>
            `;
        } else if(type === 'friends') {
            buttons = `
                <button class="friend-btn btn-secondary" style="margin-bottom: 5px;" onclick="openChatBox(${u.id}, '${u.fullName}', '${avatarUrl}')">Nhắn tin</button>
                <button class="friend-btn btn-delete" onclick="actionFriend(${u.id}, 'delete')">Hủy kết bạn</button>
            `;
        }

        el.innerHTML += `
            <div class="friend-card">
                <img src="${avatarUrl}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(u.fullName)}&background=00d1b2&color=fff'">
                <div class="friend-card-content">
                    <div class="friend-card-name"><a href="/html/profile.html?userId=${u.id}" style="text-decoration:none; color:inherit;">${u.fullName}</a></div>
                    <div>${buttons}</div>
                </div>
            </div>
        `;
    });
}

window.actionFriend = async function(id, action) {
    const token = localStorage.getItem('token');
    try {
        let url = `/api/friends`;
        let method = 'POST';
        
        if (action === 'request') url += `/request/${id}`;
        else if (action === 'accept') url += `/accept/${id}`;
        else if (action === 'delete' || action === 'cancel') {
            url += `/${id}`;
            method = 'DELETE';
            if(action === 'delete' && !confirm("Bạn có chắc chắn muốn thực hiện thay đổi này?")) return;
        }

        const res = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const btn = document.getElementById(`friend-btn-${id}`);
            if (btn) {
                if (action === 'request') {
                    btn.innerText = 'Hủy lời mời';
                    btn.classList.remove('btn-add');
                    btn.classList.add('btn-delete');
                    btn.onclick = () => actionFriend(id, 'cancel');
                } else if (action === 'cancel') {
                    btn.innerText = 'Thêm bạn bè';
                    btn.classList.remove('btn-delete');
                    btn.classList.add('btn-add');
                    btn.onclick = () => actionFriend(id, 'request');
                }
            } else {
                loadData(); // Tự động reload lại bảng cho các tab khác
            }
            
            if (typeof loadChatSidebar === 'function') {
                loadChatSidebar();
            }
        } else {
            const err = await res.text();
            showToast(err, 'error');
        }
    } catch(e) {
        console.error(e);
    }
}

// ======================= SIDEBAR SUGGESTIONS =======================
async function fetchSidebarSuggestions(token) {
    const container = document.getElementById('sidebar-suggestions');
    if (!container) return;

    try {
        const res = await fetch('/api/friends/suggestions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const suggestions = await res.json();
            renderSidebarSuggestions(suggestions.slice(0, 5)); // Show top 5
        }
    } catch (err) {
        console.error("Lỗi lấy gợi ý sidebar:", err);
    }
}

function renderSidebarSuggestions(users) {
    const container = document.getElementById('sidebar-suggestions');
    if (!container) return;
    
    if (users.length === 0) {
        container.innerHTML = '<div class="empty-state">Không có gợi ý mới</div>';
        return;
    }

    container.innerHTML = users.map(user => {
        const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=00d1b2&color=fff`;
        return `
            <div class="suggestion-item" id="suggestion-item-sidebar-${user.id}">
                <img src="${avatarUrl}" alt="Avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=00d1b2&color=fff'">
                <div class="suggestion-info">
                    <a href="/html/profile.html?userId=${user.id}" class="suggestion-name">${user.fullName}</a>
                    <span class="suggestion-mutual">Gợi ý cho bạn</span>
                </div>
                <button class="add-friend-sidebar-btn" onclick="addFriendFromSidebar(${user.id})">Thêm</button>
            </div>
        `;
    }).join('');
}

window.addFriendFromSidebar = async function(userId) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/friends/request/${userId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const item = document.getElementById(`suggestion-item-sidebar-${userId}`);
            if (item) {
                const btn = item.querySelector('button');
                btn.innerText = 'Hủy';
                btn.classList.add('cancel-btn');
                btn.onclick = () => cancelRequestFromSidebar(userId);
            }
        }
    } catch (err) {
        console.error("Lỗi gửi lời mời kết bạn:", err);
    }
};

window.cancelRequestFromSidebar = async function(userId) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/friends/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const item = document.getElementById(`suggestion-item-sidebar-${userId}`);
            if (item) {
                const btn = item.querySelector('button');
                btn.innerText = 'Thêm';
                btn.classList.remove('cancel-btn');
                btn.onclick = () => addFriendFromSidebar(userId);
            }
        }
    } catch (err) {
        console.error("Lỗi hủy lời mời:", err);
    }
};

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.innerText = message;
    toast.className = 'toast ' + type;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
