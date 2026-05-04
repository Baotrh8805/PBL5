// Interceptor: tự động logout nếu tài khoản bị khóa (status BANNED)
(function() {
    const _fetch = window.fetch;
    window.fetch = async function(...args) {
        const res = await _fetch(...args);
        if (res.status === 401) {
            const clone = res.clone();
            try {
                const data = await clone.json();
                if (data.reason === 'BANNED') {
                    localStorage.removeItem('token');
                    window.location.href = '/?banned=1';
                    return res;
                }
            } catch (_) {}
        }
        return res;
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }
    
    // Quick fetch user avatar for header
    fetch('/api/users/profile', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
            let avatarUrl = data.avatar;
            if (!avatarUrl && data.fullName) {
                avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.fullName)}&background=00d1b2&color=fff`;
            }
            if(avatarUrl) document.getElementById('header-avatar').src = avatarUrl;
        });

    loadData();
});

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
                <button class="friend-btn btn-add" style="margin-bottom: 5px;" onclick="actionFriend(${u.id}, 'request')">Thêm bạn bè</button>
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
        else if (action === 'delete') {
            url += `/${id}`;
            method = 'DELETE';
            if(!confirm("Bạn có chắc chắn muốn thực hiện thay đổi này?")) return;
        }

        const res = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            loadData(); // Tự động reload lại bảng
            if (typeof loadChatSidebar === 'function') {
                loadChatSidebar();
            }
        } else {
            const err = await res.text();
            alert("Lỗi: " + err);
        }
    } catch(e) {
        console.error(e);
    }
}
