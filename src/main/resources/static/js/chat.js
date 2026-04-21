let stompClient = null;
let currentChatUserId = null;
let myUserId = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Get current user id from token or profile API
    fetch('/api/users/profile', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
            myUserId = data.id;
            connectWebSocket(token);
        });

    loadChatSidebar();
    fetchUnreadNotificationCount();
});

function connectWebSocket(token) {
    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    // Disable stomp debug logs for clean console
    stompClient.debug = null;
    
    stompClient.connect({}, function (frame) {
        console.log('Connected to WS: ' + frame);
        stompClient.subscribe(`/topic/messages/${myUserId}`, function (message) {
            handleIncomingMessage(JSON.parse(message.body));
        });
        stompClient.subscribe(`/topic/notifications/${myUserId}`, function (notification) {
            handleNotification(JSON.parse(notification.body));
        });
    });
}

function handleNotification(notification) {
    // Refresh unread count
    fetchUnreadNotificationCount();
    fetchNotifications(); // reload dropdown

    // Small toast (optional, replacing alert)
    const toast = document.createElement('div');
    toast.style.cssText = "position:fixed; bottom:20px; left:20px; background:#00d1b2; color:#fff; padding:12px 20px; border-radius:8px; z-index:9999; font-size:14px; box-shadow:0 4px 6px rgba(0,0,0,0.1); cursor:pointer;";
    toast.innerText = notification.message;
    if(notification.link) {
        toast.onclick = () => window.location.href = notification.link;
    }
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
    
    // If the friend functions exist (like `loadData` inside friends.js)
    if (typeof loadData === 'function') {
        loadData();
    }
}

let notificationDropdownOpen = false;
let inboxDropdownOpen = false;

function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    if(!dropdown) return;
    notificationDropdownOpen = !notificationDropdownOpen;
    dropdown.style.display = notificationDropdownOpen ? 'block' : 'none';
    if(notificationDropdownOpen) {
        fetchNotifications();
        if(inboxDropdownOpen) toggleInboxDropdown(); // close inbox if open
    }
}

function toggleInboxDropdown() {
    const dropdown = document.getElementById('inbox-dropdown');
    if(!dropdown) return;
    inboxDropdownOpen = !inboxDropdownOpen;
    dropdown.style.display = inboxDropdownOpen ? 'flex' : 'none'; // Flex because of messenger layout
    if(inboxDropdownOpen) {
        if(notificationDropdownOpen) toggleNotificationDropdown();
        loadInboxDropdown(); // Fetch and render conversations here!
    }
}

async function loadInboxDropdown() {
    const token = localStorage.getItem('token');
    const inboxList = document.getElementById('inbox-list');
    if (!inboxList) return;
    inboxList.innerHTML = '<div style="padding: 15px; color:#65676B; font-size:14px; text-align:center;">Đang tải...</div>';

    try {
        const [friendsRes, convRes] = await Promise.all([
            fetch('/api/friends', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/messages/conversations', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const friends = friendsRes.ok ? await friendsRes.json() : [];
        const conversations = convRes.ok ? await convRes.json() : [];

        // Merge logic
        const mergedMap = new Map();
        conversations.forEach(u => mergedMap.set(u.id, u));
        friends.forEach(u => {
            if (!mergedMap.has(u.id)) {
                mergedMap.set(u.id, { ...u, isFriend: true, lastMessage: 'Các bạn đã trở thành bạn bè', lastMessageTime: null });
            }
        });
        const contacts = Array.from(mergedMap.values());

        inboxList.innerHTML = '';
        if(contacts.length === 0) {
            inboxList.innerHTML = '<div style="padding: 15px; color:#65676B; font-size:14px; text-align:center;">Chưa có đoạn chat nào.</div>';
            return;
        }

        contacts.forEach(f => {
            let avatarUrl = f.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.fullName)}&background=00d1b2&color=fff`;
            let msgStr = f.lastMessage || 'Bạn bè';

            const item = document.createElement('div');
            item.className = 'notification-item';
            item.style.cursor = 'pointer';
            item.onclick = () => {
                const dropdown = document.getElementById('inbox-dropdown');
                if (dropdown) dropdown.style.display = 'none'; // hide dropdown
                inboxDropdownOpen = false;
                openChatBox(f.id, f.fullName, avatarUrl);
            };

            item.innerHTML = `
                <img src="${avatarUrl}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(f.fullName)}&background=00d1b2&color=fff'">
                <div class="notification-content">
                    <div style="font-weight: 600; font-size: 15px; color: #050505;">${f.fullName}</div>
                    <div class="notification-msg" style="color: #65676b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px;">${msgStr}</div>
                </div>
                <!-- Optional unread dot here -->
            `;
            inboxList.appendChild(item);
        });

    } catch (e) { console.error(e); }
}

async function fetchUnreadNotificationCount() {
    try {
        const token = localStorage.getItem('token');
        if(!token) return;
        const res = await fetch('/api/notifications/unread-count', { headers: { 'Authorization': `Bearer ${token}` } });
        if(res.ok) {
            const data = await res.json();
            const badge = document.getElementById('notification-badge');
            if(badge) {
                if(data.unreadCount > 0) {
                    badge.innerText = data.unreadCount;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    } catch(e) { console.error(e); }
}

async function fetchNotifications() {
    try {
        const token = localStorage.getItem('token');
        if(!token) return;
        const res = await fetch('/api/notifications', { headers: { 'Authorization': `Bearer ${token}` } });
        if(res.ok) {
            const notifications = await res.json();
            renderNotifications(notifications);
        }
    } catch(e) { console.error(e); }
}

function renderNotifications(notifications) {
    const list = document.getElementById('notification-list');
    if(!list) return;
    list.innerHTML = '';
    
    if(notifications.length === 0) {
        list.innerHTML = '<div style="padding:15px;text-align:center;color:#65676B;font-size:14px;">Không có thông báo nào</div>';
        return;
    }
    
    notifications.forEach(n => {
        let avatarUrl = n.senderAvatar;
        if (!avatarUrl || avatarUrl.trim() === '') {
            avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(n.senderName || 'User')}&background=00d1b2&color=fff`;
        }
        
        let dateStr = "";
        if(n.createdAt) {
            const d = new Date(n.createdAt);
            dateStr = d.toLocaleString('vi-VN', {hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'});
        }

        const item = document.createElement('a');
        item.href = n.link || '#';
        item.className = 'notification-item ' + (n.isRead ? '' : 'unread');
        item.onclick = async (e) => {
            // mark as read
            if(!n.isRead) {
                await fetch(`/api/notifications/${n.id}/read`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
            }
        };
        
        item.innerHTML = `
            <img src="${avatarUrl}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(n.senderName || 'User')}&background=00d1b2&color=fff'">
            <div class="notification-content">
                <div class="notification-msg">${n.message || ''}</div>
                <div class="notification-time">${dateStr}</div>
            </div>
            ${!n.isRead ? '<div class="notification-dot"></div>' : ''}
        `;
        list.appendChild(item);
    });
}

async function markAllNotificationsAsRead() {
    try {
        const token = localStorage.getItem('token');
        await fetch('/api/notifications/read-all', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchUnreadNotificationCount();
        fetchNotifications();
    } catch(e) { console.error(e); }
}

// Call on startup
document.addEventListener('DOMContentLoaded', () => {
    // Close dropdowns when clicking outside.
    document.addEventListener('click', (e) => {
        const notiContainer = document.querySelector('.notification-container:last-child'); // approx
        const inboxBtnDropdownContainer = document.querySelector('.notification-container:first-child');
        
        const notiDropdown = document.getElementById('notification-dropdown');
        const inboxDropdown = document.getElementById('inbox-dropdown');
        
        if (notiDropdown && notificationDropdownOpen) {
            // Very brute force check if click is outside any notification container
            if (!e.target.closest('.notification-container')) {
                notiDropdown.style.display = 'none';
                notificationDropdownOpen = false;
            }
        }
        if (inboxDropdown && inboxDropdownOpen) {
            if (!e.target.closest('.notification-container')) {
                inboxDropdown.style.display = 'none';
                inboxDropdownOpen = false;
            }
        }
    });
});

async function loadChatSidebar() {
    const token = localStorage.getItem('token');
    const [friendsRes, convRes] = await Promise.all([
        fetch('/api/friends', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/messages/conversations', { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    if (!friendsRes.ok && !convRes.ok) return;

    const friends = friendsRes.ok ? await friendsRes.json() : [];
    const conversations = convRes.ok ? await convRes.json() : [];

    const mergedMap = new Map();
    conversations.forEach(u => mergedMap.set(u.id, u));
    friends.forEach(u => mergedMap.set(u.id, { ...u, isFriend: true }));
    const contacts = Array.from(mergedMap.values());

    renderChatContacts(contacts, 'Chưa có bạn bè để trò chuyện');
}

let chatSearchTimeout = null;
window.searchChatUsers = function(query) {
    clearTimeout(chatSearchTimeout);
    if (!query || query.trim() === '') {
        loadChatSidebar();
        return;
    }
    chatSearchTimeout = setTimeout(async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                renderChatContacts(data, 'Không tìm thấy người dùng nào.');
            }
        } catch(e) { console.error(e); }
    }, 500);
};

function renderChatContacts(contacts, emptyMessage = 'Chưa có người liên hệ') {
    const chatList = document.getElementById('chat-contact-list');
    if (!chatList) return;

    chatList.innerHTML = '';
    if (contacts.length === 0) {
        chatList.innerHTML = `<div style="padding: 15px; color:#65676B; font-size:14px;">${emptyMessage}</div>`;
        return;
    }

    contacts.forEach(f => {
        let avatarUrl = f.avatar;
        if (!avatarUrl || avatarUrl.trim() === '') {
            avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(f.fullName)}&background=00d1b2&color=fff`;
        }

        const div = document.createElement('div');
        div.className = 'chat-contact';
        div.id = `chat-contact-${f.id}`;
        div.onclick = () => openChatBox(f.id, f.fullName, avatarUrl);
        div.innerHTML = `
            <img src="${avatarUrl}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(f.fullName)}&background=00d1b2&color=fff'">
            <div class="chat-contact-name">${f.fullName}</div>
            <div id="unread-badge-${f.id}" class="chat-unread-badge" style="display:none;"></div>
        `;
        chatList.appendChild(div);
    });
}

function openChatBox(userId, name, avatar) {
    currentChatUserId = userId;
    const chatBox = document.getElementById('chat-box');
    chatBox.style.display = 'flex';
    
    let targetAvatar = avatar;
    if (!targetAvatar || targetAvatar.trim() === '') {
        targetAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00d1b2&color=fff`;
    }

    document.getElementById('chat-target-name').innerHTML = `<a href="/html/profile.html?userId=${userId}" style="text-decoration:none; color:inherit;">${name}</a>`;
    document.getElementById('chat-target-avatar').src = targetAvatar;
    document.getElementById('chat-target-avatar').onclick = () => { window.location.href = `/html/profile.html?userId=${userId}`; };
    document.getElementById('chat-target-avatar').style.cursor = 'pointer';
    document.getElementById('chat-target-avatar').onerror = function() {
        this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00d1b2&color=fff`;
    };
    
    // Lưu lại targetAvatar để dùng trong appendMessageToUI nếu cần
    window.chatTargetAvatarUrl = targetAvatar;

    const messagesDiv = document.getElementById('chat-messages-container');
    messagesDiv.innerHTML = '<div style="text-align:center;color:#65676B;font-size:12px;margin-top:10px;">Đang tải...</div>';

    const unreadBadge = document.getElementById(`unread-badge-${userId}`);
    if(unreadBadge) unreadBadge.style.display = 'none';

    // Load History
    fetch(`/api/messages/${userId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => res.json())
    .then(messages => {
        messagesDiv.innerHTML = '';
        messages.forEach(msg => {
            appendMessageToUI(msg);
        });
        scrollToBottom();
    })
    .catch(err => {
        messagesDiv.innerHTML = '<div style="text-align:center;color:red;font-size:12px;margin-top:10px;">Lỗi tải tin nhắn.</div>';
    });
}

function closeChatBox() {
    document.getElementById('chat-box').style.display = 'none';
    currentChatUserId = null;
}

function handleIncomingMessage(msg) {
    // If the message belongs to the current open chat window
    if ((msg.senderId == currentChatUserId && msg.receiverId == myUserId) || 
        (msg.senderId == myUserId && msg.receiverId == currentChatUserId)) {
        appendMessageToUI(msg);
        scrollToBottom();
    } else {
        // Maybe show an indicator on the sidebar for unread msgs?
        const unreadBadge = document.getElementById(`unread-badge-${msg.senderId}`);
        if (unreadBadge) {
            unreadBadge.style.display = 'block';
        } else {
            // Sender may not be in current friend list (e.g. unfriended old conversation).
            loadChatSidebar();
        }
    }
}

function appendMessageToUI(msg) {
    const messagesDiv = document.getElementById('chat-messages-container');
    const div = document.createElement('div');
    const isSent = (msg.senderId == myUserId);
    
    // format time HH:mm
    let timeStr = "";
    if (msg.timestamp) {
        const d = new Date(msg.timestamp);
        timeStr = ('0' + d.getHours()).slice(-2) + ":" + ('0' + d.getMinutes()).slice(-2);
    } else {
        const d = new Date();
        timeStr = ('0' + d.getHours()).slice(-2) + ":" + ('0' + d.getMinutes()).slice(-2);
    }
    
    div.className = `chat-message-wrapper ${isSent ? 'sent' : 'received'}`;
    const targetAvatarHtml = !isSent ? `<img src="${window.chatTargetAvatarUrl || '/uploads/default-avatar.png'}" class="chat-msg-avatar" style="width:28px; height:28px; border-radius:50%; object-fit:cover; margin-right:8px;" onerror="this.style.display='none'">` : '';

    div.style.display = 'flex';
    div.style.flexDirection = isSent ? 'row-reverse' : 'row';
    div.style.alignItems = 'flex-end';

    div.innerHTML = `
        ${targetAvatarHtml}
        <div style="display:flex; flex-direction:column; align-items: ${isSent ? 'flex-end' : 'flex-start'};">
            <div class="chat-message ${isSent ? 'sent' : 'received'}" style="margin: 0;">${msg.content}</div>
            <div class="chat-message-time">${timeStr}</div>
        </div>
    `;
    messagesDiv.appendChild(div);
}

function scrollToBottom() {
    const messagesDiv = document.getElementById('chat-messages-container');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function sendChatMessage() {
    const input = document.getElementById('chat-input-text');
    const content = input.value.trim();
    
    if (content && stompClient && stompClient.connected && currentChatUserId) {
        const chatMsg = {
            senderId: myUserId,
            receiverId: currentChatUserId,
            content: content
        };
        // Send to controller
        stompClient.send("/app/chat", {}, JSON.stringify(chatMsg));
        input.value = '';
    }
}

// Enter key to send
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input-text');
    if (chatInput) {
        chatInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
});

function toggleChatSidebar() {
    const sidebar = document.getElementById('chat-sidebar');
    if (!sidebar) return;
    
    if (sidebar.style.display === 'none' || sidebar.style.display === '') {
        sidebar.style.display = 'block';
    } else {
        sidebar.style.display = 'none';
    }
}
