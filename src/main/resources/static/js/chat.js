let stompClient = null;
let activeChats = []; // Mảng chứa các phiên chat đang mở (tối đa 2)
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
    
    // Inject Group Creation Button
    setTimeout(() => {
        // 1. Inject to Sidebar Title if present
        const sidebarTitle = document.querySelector('.chat-sidebar-title');
        if (sidebarTitle) {
            sidebarTitle.style.display = 'flex';
            sidebarTitle.style.alignItems = 'center';
            sidebarTitle.style.justifyContent = 'space-between';
            
            if (!document.getElementById('btn-create-group-chat')) {
                const btn = document.createElement('button');
                btn.id = 'btn-create-group-chat';
                btn.title = 'Tạo nhóm chat mới';
                btn.style.cssText = "background: none; border: none; color: #0084ff; cursor: pointer; font-size: 16px; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 50%; width: 28px; height: 28px; transition: 0.2s;";
                btn.onmouseover = () => btn.style.backgroundColor = '#f0f2f5';
                btn.onmouseout = () => btn.style.backgroundColor = 'transparent';
                btn.innerHTML = '<i class="fa-solid fa-plus"></i>';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    showCreateGroupModal();
                };
                sidebarTitle.appendChild(btn);
            }
        }

        // 2. Inject to Messenger Dropdown Header if present
        const messengerActions = document.querySelector('.messenger-header-actions');
        if (messengerActions) {
            if (!document.getElementById('btn-messenger-create-group')) {
                const btn = document.createElement('button');
                btn.id = 'btn-messenger-create-group';
                btn.className = 'icon-btn-small';
                btn.title = 'Tạo nhóm chat mới';
                btn.innerHTML = '<i class="fa-solid fa-plus"></i>';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    // Close the dropdown so it doesn't overlap with the modal
                    const dropdown = document.getElementById('inbox-dropdown');
                    if (dropdown) dropdown.style.display = 'none';
                    inboxDropdownOpen = false;
                    showCreateGroupModal();
                };
                messengerActions.appendChild(btn);
            }
        }
    }, 500);
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

let currentMessengerFilter = 'all';
let messengerSearchQuery = '';

function handleMessengerSearch(val) {
    messengerSearchQuery = val.toLowerCase().trim();
    loadInboxDropdown();
}

function setMessengerFilter(filter, btn) {
    currentMessengerFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    loadInboxDropdown();
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
        conversations.forEach(c => {
            const key = c.isGroup ? `group_${c.id}` : `user_${c.id}`;
            mergedMap.set(key, c);
        });
        friends.forEach(u => {
            const key = `user_${u.id}`;
            if (!mergedMap.has(key)) {
                mergedMap.set(key, { ...u, isGroup: false, isFriend: true, lastMessage: 'Các bạn đã trở thành bạn bè', lastMessageTime: null, unreadCount: 0 });
            }
        });
        let contacts = Array.from(mergedMap.values());

        // Apply filters
        if (currentMessengerFilter === 'unread') {
            contacts = contacts.filter(c => c.unreadCount > 0);
        } else if (currentMessengerFilter === 'group') {
            contacts = contacts.filter(c => c.isGroup === true);
        }
        
        if (messengerSearchQuery) {
            contacts = contacts.filter(c => c.fullName.toLowerCase().includes(messengerSearchQuery));
        }

        inboxList.innerHTML = '';
        if(contacts.length === 0) {
            let emptyMsg = 'Chưa có đoạn chat nào.';
            if (currentMessengerFilter === 'unread') emptyMsg = 'Không có tin nhắn chưa đọc.';
            if (messengerSearchQuery) emptyMsg = 'Không tìm thấy kết quả phù hợp.';
            
            inboxList.innerHTML = `<div style="padding: 15px; color:#65676B; font-size:14px; text-align:center;">${emptyMsg}</div>`;
            return;
        }

        contacts.forEach(f => {
            let avatarUrl = f.avatar;
            if (!avatarUrl || avatarUrl.trim() === '') {
                 avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(f.fullName || 'User')}&background=F6DE50&color=1a1a1a`;
            }
            let msgStr = f.lastMessage || 'Bạn bè';
            let isUnread = f.unreadCount > 0;

            const item = document.createElement('div');
            item.className = 'notification-item' + (isUnread ? ' unread' : '');
            item.style.cursor = 'pointer';
            item.style.position = 'relative';
            item.onclick = () => {
                const dropdown = document.getElementById('inbox-dropdown');
                if (dropdown) dropdown.style.display = 'none'; // hide dropdown
                inboxDropdownOpen = false;
                openChatBox(f.id, f.fullName, avatarUrl, !!f.isGroup);
            };

            item.innerHTML = `
                <img src="${avatarUrl}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(f.fullName || 'User')}&background=F6DE50&color=1a1a1a'">
                <div class="notification-content">
                    <div style="font-weight: ${isUnread ? '700' : '600'}; font-size: 15px; color: var(--text-main);">${f.fullName} ${f.isGroup ? '<span style="font-size: 11px; background: #e4e6eb; padding: 2px 6px; border-radius: 10px; color: #65676b; margin-left: 5px;"><i class="fa-solid fa-users"></i> Nhóm</span>' : ''}</div>
                    <div class="notification-msg" style="color: ${isUnread ? 'var(--text-main)' : 'var(--text-muted)'}; font-weight: ${isUnread ? '600' : '400'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px;">${msgStr}</div>
                </div>
                ${isUnread ? '<div class="notification-dot" style="background-color: #00d1b2; width: 10px; height: 10px; border-radius: 50%; margin-left: auto;"></div>' : ''}
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
            avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(n.senderName || 'User')}&background=F6DE50&color=1a1a1a`;
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

            if (n.type === 'WARNING' || n.type === 'REPORT_WARNING') {
                e.preventDefault();
                showWarningModal(n.message);
            }
        };
        
        item.innerHTML = `
            <img src="${avatarUrl}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(n.senderName || 'User')}&background=F6DE50&color=1a1a1a'">
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
        const notiDropdown = document.getElementById('notification-dropdown');
        const inboxDropdown = document.getElementById('inbox-dropdown');
        
        if (notiDropdown && notificationDropdownOpen) {
            if (!e.target.closest('.notification-container')) {
                notiDropdown.style.display = 'none';
                notificationDropdownOpen = false;
            }
        }
        if (inboxDropdown && inboxDropdownOpen) {
            if (!e.target.closest('.notification-container') && !e.target.closest('#nav-message-btn') && !e.target.closest('#inbox-dropdown')) {
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
    conversations.forEach(c => {
        const key = c.isGroup ? `group_${c.id}` : `user_${c.id}`;
        mergedMap.set(key, c);
    });
    friends.forEach(u => {
        const key = `user_${u.id}`;
        if (!mergedMap.has(key)) {
            mergedMap.set(key, { ...u, isGroup: false, isFriend: true, unreadCount: 0 });
        }
    });
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
            avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(f.fullName)}&background=F6DE50&color=1a1a1a`;
        }

        const div = document.createElement('div');
        div.className = 'chat-contact';
        const elementId = f.isGroup ? `group_${f.id}` : `user_${f.id}`;
        div.id = `chat-contact-${elementId}`;
        div.onclick = () => openChatBox(f.id, f.fullName, avatarUrl, !!f.isGroup);
        div.innerHTML = `
            <img src="${avatarUrl}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(f.fullName)}&background=F6DE50&color=1a1a1a'">
            <div class="chat-contact-name">${f.fullName}</div>
            <div id="unread-badge-${elementId}" class="chat-unread-badge" style="display:none;"></div>
        `;
        chatList.appendChild(div);

        // Show unread badge
        const unreadBadge = document.getElementById(`unread-badge-${elementId}`);
        if (unreadBadge && f.unreadCount > 0) {
            unreadBadge.style.display = 'block';
        }
    });
}

function openChatBox(userId, name, avatar, isGroup = false) {
    const chatId = isGroup ? `group_${userId}` : `user_${userId}`;
    
    // Nếu chat box đã mở, không làm gì cả
    if (activeChats.find(chat => chat.chatId === chatId)) {
        return;
    }

    // Nếu đã mở 2 khung chat, đóng khung cũ nhất
    if (activeChats.length >= 2) {
        const oldestChat = activeChats.shift();
        const oldChatBox = document.getElementById(`chat-box-${oldestChat.chatId}`);
        if (oldChatBox) oldChatBox.remove();
    }

    let targetAvatar = avatar;
    if (!targetAvatar || targetAvatar.trim() === '') {
        targetAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=F6DE50&color=1a1a1a`;
    }

    // Thêm vào mảng activeChats
    activeChats.push({
        chatId: chatId,
        userId: userId,
        isGroup: isGroup,
        name: name,
        avatar: targetAvatar
    });

    const container = document.getElementById('chat-boxes-container');
    if (!container) return;

    const chatBox = document.createElement('div');
    chatBox.id = `chat-box-${chatId}`;
    chatBox.className = 'chat-box';
    
    const targetNameHtml = isGroup ? 
        `<span>${name}</span>` : 
        `<a href="/html/profile.html?userId=${userId}" style="text-decoration:none; color:inherit;">${name}</a>`;

    chatBox.innerHTML = `
        <div class="chat-header">
            <div class="chat-target-info">
                <img id="chat-target-avatar-${chatId}" src="${targetAvatar}" style="cursor: ${isGroup ? 'default' : 'pointer'}">
                <span id="chat-target-name-${chatId}">${targetNameHtml}</span>
            </div>
            <div class="chat-header-actions" onclick="closeChatBox('${chatId}')">
                <i class="fa-solid fa-xmark"></i>
            </div>
        </div>
        <div id="chat-messages-container-${chatId}" class="chat-messages">
            <div style="text-align:center;color:#65676B;font-size:12px;margin-top:10px;">Đang tải...</div>
        </div>
        <div class="chat-input-area" style="flex-wrap: wrap; padding: 10px;">
            <div id="chat-image-preview-container-${chatId}" style="display: none; width: 100%; margin-bottom: 5px; position: relative;">
                <img id="chat-image-preview-${chatId}" src="" style="max-height: 80px; border-radius: 8px; border: 1px solid var(--border-color);">
                <button onclick="removeChatImage('${chatId}')" class="chat-remove-img-btn"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="chat-input-row">
                <label for="chat-image-input-${chatId}" class="chat-attach-btn" title="Đính kèm ảnh">
                    <i class="fa-solid fa-image"></i>
                </label>
                <input type="file" id="chat-image-input-${chatId}" accept="image/*" style="display: none;" onchange="previewChatImage(event, '${chatId}')">
                <input type="text" id="chat-input-text-${chatId}" class="chat-input-field" placeholder="Nhập tin nhắn..." onkeypress="handleKeyPress(event, '${chatId}')">
                <button onclick="sendChatMessage('${chatId}')" class="chat-send-btn"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
        </div>
    `;

    container.appendChild(chatBox);
    
    // Assign click for profile redirect if not group
    if (!isGroup) {
        document.getElementById(`chat-target-avatar-${chatId}`).onclick = () => { window.location.href = `/html/profile.html?userId=${userId}`; };
    }

    const unreadBadge = document.getElementById(`unread-badge-${chatId}`);
    if(unreadBadge) unreadBadge.style.display = 'none';

    // Load History
    const messagesDiv = document.getElementById(`chat-messages-container-${chatId}`);
    const historyUrl = isGroup ? `/api/groups/${userId}/messages` : `/api/messages/${userId}`;
    fetch(historyUrl, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => res.json())
    .then(messages => {
        messagesDiv.innerHTML = '';
        chatBox.lastMessageTimestamp = null; // Reset tracker specific to chat box
        messages.forEach(msg => {
            appendMessageToUI(msg, chatId);
        });
        scrollToBottom(chatId);
    })
    .catch(err => {
        messagesDiv.innerHTML = '<div style="text-align:center;color:red;font-size:12px;margin-top:10px;">Lỗi tải tin nhắn.</div>';
    });
}

function closeChatBox(chatId) {
    const chatBox = document.getElementById(`chat-box-${chatId}`);
    if (chatBox) chatBox.remove();
    activeChats = activeChats.filter(chat => chat.chatId !== chatId);
}

function handleIncomingMessage(msg) {
    if (msg.type === 'REVOKE') {
        const targetElementId = `chat-msg-${msg.id}`;
        const msgDiv = document.getElementById(targetElementId);
        if (msgDiv) {
            msgDiv.remove();
        }
        return; // Dừng lại ở đây vì đây là tin nhắn thu hồi
    }

    const isGroupMsg = !!msg.groupId;
    const targetId = isGroupMsg ? msg.groupId : (msg.senderId == myUserId ? msg.receiverId : msg.senderId);
    const targetElementId = isGroupMsg ? `group_${targetId}` : `user_${targetId}`;
    
    const activeChat = activeChats.find(chat => chat.chatId === targetElementId);

    // If the message belongs to an open chat window
    if (activeChat) {
        appendMessageToUI(msg, targetElementId);
        scrollToBottom(targetElementId);
    } else {
        if (msg.senderId != myUserId) {
            // Auto open chat box if less than 2 are open, or replace oldest
            if (isGroupMsg) {
                openChatBox(msg.groupId, msg.groupName, '', true);
            } else {
                // Fetch real avatar and name from API
                fetch(`/api/users/${msg.senderId}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                })
                .then(res => res.ok ? res.json() : null)
                .then(userData => {
                    let avatar = '';
                    let name = msg.senderName || 'Người dùng';
                    
                    if (userData) {
                        avatar = userData.avatar || '';
                        name = userData.fullName || name;
                    }
                    openChatBox(msg.senderId, name, avatar, false);
                })
                .catch(err => {
                    openChatBox(msg.senderId, msg.senderName || 'Người dùng', '', false);
                });
            }
        }
    }
}

async function revokeMessage(messageId, chatId) {
    if (!confirm('Bạn có chắc chắn muốn thu hồi tin nhắn này?')) return;
    
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/messages/${messageId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            // Phản hồi ok thì xoá DOM luôn
            const targetElementId = `chat-msg-${messageId}`;
            const msgDiv = document.getElementById(targetElementId);
            if (msgDiv) {
                msgDiv.remove();
            }
        } else {
            showWarningModal('Không thể thu hồi tin nhắn. Vui lòng thử lại.');
        }
    } catch(e) { console.error(e); }
}

function formatDateSeparator(date) {
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    const day = date.getDate();
    const monthNames = [
        'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
        'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${hours}:${minutes} ${day} ${month}, ${year}`;
}

function appendMessageToUI(msg, chatId) {
    const messagesDiv = document.getElementById(`chat-messages-container-${chatId}`);
    if (!messagesDiv) return;
    
    const chatBox = document.getElementById(`chat-box-${chatId}`);
    
    // Check if we need a date separator (different calendar day or first message)
    const currentMsgDate = msg.timestamp ? new Date(msg.timestamp) : new Date();
    let needsSeparator = false;
    
    if (!chatBox.lastMessageTimestamp) {
        needsSeparator = true;
    } else {
        if (currentMsgDate.toDateString() !== chatBox.lastMessageTimestamp.toDateString()) {
            needsSeparator = true;
        }
    }
    
    if (needsSeparator) {
        const separator = document.createElement('div');
        separator.className = 'chat-date-separator';
        separator.innerHTML = `<span>${formatDateSeparator(currentMsgDate)}</span>`;
        messagesDiv.appendChild(separator);
    }
    chatBox.lastMessageTimestamp = currentMsgDate;
    
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
    if (msg.id) {
        div.id = `chat-msg-${msg.id}`;
    }
    
    let avatarUrl = msg.senderAvatar;
    if (!avatarUrl || avatarUrl.trim() === '') {
        avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.senderName || 'User')}&background=F6DE50&color=1a1a1a`;
    }

    const targetAvatarHtml = !isSent ? `<a href="/html/profile.html?userId=${msg.senderId}"><img src="${avatarUrl}" class="chat-msg-avatar" style="width:28px; height:28px; border-radius:50%; object-fit:cover; flex-shrink:0;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(msg.senderName || 'User')}&background=F6DE50&color=1a1a1a'"></a>` : '';
    
    const chatInfo = activeChats.find(c => c.chatId === chatId);
    const isGroup = chatInfo ? chatInfo.isGroup : false;
    const nameHtml = (isGroup && !isSent) ? `<div style="font-size: 11px; color: #8a8d91; margin-bottom: 2px; margin-left: 2px; font-weight: 500;">${msg.senderName}</div>` : '';

    div.innerHTML = `
        ${targetAvatarHtml}
        <div class="chat-msg-content" style="position: relative; width: 100%;">
            ${nameHtml}
            <div class="chat-message-row" style="display: flex; align-items: center; justify-content: ${isSent ? 'flex-end' : 'flex-start'}; gap: 8px;">
                ${isSent && msg.id ? `<button onclick="revokeMessage(${msg.id}, '${chatId}')" class="revoke-msg-btn" title="Thu hồi tin nhắn" style="background: none; border: none; color: #ff4d4f; cursor: pointer; padding: 5px; border-radius: 50%;"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                
                <div class="chat-message ${isSent ? 'sent' : 'received'}" style="display: flex; flex-direction: column;">
                    ${msg.imageUrl ? `<img src="${msg.imageUrl}" style="max-width: 200px; border-radius: 8px; margin-bottom: ${msg.content ? '8px' : '0'}; display: block; cursor: pointer;" onclick="window.open(this.src)">` : ''}
                    ${msg.content ? `<span>${msg.content}</span>` : ''}
                </div>
                
                ${!isSent && msg.id ? `<!-- placeholders for receiver actions if needed -->` : ''}
            </div>
            <div class="chat-message-time">${timeStr}</div>
        </div>
    `;
    
    messagesDiv.appendChild(div);
}

function scrollToBottom(chatId) {
    const messagesDiv = document.getElementById(`chat-messages-container-${chatId}`);
    if (messagesDiv) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

async function sendChatMessage(chatId) {
    const input = document.getElementById(`chat-input-text-${chatId}`);
    const imageInput = document.getElementById(`chat-image-input-${chatId}`);
    if (!input) return;
    
    const content = input.value.trim();
    const chatInfo = activeChats.find(c => c.chatId === chatId);
    const file = imageInput && imageInput.files && imageInput.files[0] ? imageInput.files[0] : null;

    if (!chatInfo || !stompClient || !stompClient.connected) return;
    if (!content && !file) return;

    let imageUrl = null;

    // Upload image if present
    if (file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const uploadRes = await fetch('/api/upload/image', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });
            if (uploadRes.ok) {
                const data = await uploadRes.json();
                imageUrl = data.url || data.imageUrl;
            } else {
                showWarningModal('Không thể tải ảnh lên. Vui lòng thử lại.');
                return;
            }
        } catch (e) {
            console.error('Lỗi upload ảnh:', e);
            showWarningModal('Lỗi tải ảnh lên.');
            return;
        }
    }

    const chatMsg = {
        senderId: myUserId,
        content: content,
        imageUrl: imageUrl
    };

    if (chatInfo.isGroup) {
        chatMsg.groupId = chatInfo.userId;
    } else {
        chatMsg.receiverId = chatInfo.userId;
    }

    // Send to controller
    stompClient.send("/app/chat", {}, JSON.stringify(chatMsg));
    
    // Clear inputs
    input.value = '';
    removeChatImage(chatId);
}

function previewChatImage(event, chatId) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById(`chat-image-preview-${chatId}`).src = e.target.result;
        document.getElementById(`chat-image-preview-container-${chatId}`).style.display = 'block';
    }
    reader.readAsDataURL(file);
}

function removeChatImage(chatId) {
    const input = document.getElementById(`chat-image-input-${chatId}`);
    if (input) input.value = '';
    const container = document.getElementById(`chat-image-preview-container-${chatId}`);
    if (container) container.style.display = 'none';
    const preview = document.getElementById(`chat-image-preview-${chatId}`);
    if (preview) preview.src = '';
}

function handleKeyPress(e, chatId) {
    if (e.key === 'Enter') {
        sendChatMessage(chatId);
    }
}

function toggleChatSidebar() {
    const sidebar = document.getElementById('chat-sidebar');
    if (!sidebar) return;
    
    if (sidebar.style.display === 'none' || sidebar.style.display === '') {
        sidebar.style.display = 'block';
    } else {
        sidebar.style.display = 'none';
    }
}

function showWarningModal(message) {
    const existing = document.getElementById('system-warning-modal');
    if (existing) {
        existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'system-warning-modal';
    modal.className = 'system-warning-modal-overlay';
    
    modal.innerHTML = `
        <div class="system-warning-modal-card">
            <div class="system-warning-modal-icon">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div class="system-warning-modal-title">Thông Báo Cảnh Cáo</div>
            <div class="system-warning-modal-message">${message}</div>
            <div class="system-warning-modal-notice">
                Vui lòng tuân thủ Tiêu chuẩn cộng đồng để xây dựng mạng xã hội lành mạnh, văn minh và an toàn.
            </div>
            <button class="system-warning-modal-btn" onclick="closeWarningModal()">Đã hiểu</button>
        </div>
    `;

    modal.onclick = (e) => {
        if (e.target === modal) {
            closeWarningModal();
        }
    };

    document.body.appendChild(modal);

    modal.offsetHeight; // force reflow
    modal.classList.add('show');
}

window.closeWarningModal = function() {
    const modal = document.getElementById('system-warning-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
};

function showCreateGroupModal() {
    const existing = document.getElementById('create-group-modal');
    if (existing) existing.remove();

    const token = localStorage.getItem('token');

    const modal = document.createElement('div');
    modal.id = 'create-group-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = "display: flex; justify-content: center; align-items: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;";

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; padding: 20px; background: var(--bg-card, #fff); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 90%; color: var(--text-main, #050505);">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color, #ddd); padding-bottom: 10px; margin-bottom: 15px;">
                <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: var(--text-main);">Tạo nhóm chat mới</h3>
                <button type="button" class="close-modal" id="close-create-group-modal"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 5px; color: var(--text-main);">Tên nhóm <span style="color: red;">*</span></label>
                    <input type="text" id="new-group-name" placeholder="Nhập tên nhóm..." style="width: 100%; padding: 8px 12px; border: 1px solid var(--border-color, #ced0d4); border-radius: 6px; outline: none; background: var(--bg-input, #fff); color: var(--text-main); box-sizing: border-box;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 5px; color: var(--text-main);">Chọn thành viên</label>
                    <div id="friends-checkbox-list" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color, #ced0d4); border-radius: 6px; padding: 10px; background: var(--bg-input, #fff);">
                        <div style="text-align: center; color: var(--text-muted); font-size: 14px;">Đang tải danh sách bạn bè...</div>
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-secondary" id="cancel-create-group-btn" style="padding: 8px 16px; border-radius: 6px; border: 1px solid var(--border-color, #ddd); background: var(--bg-card, #fff); color: var(--text-main); cursor: pointer;">Hủy</button>
                    <button class="btn btn-primary" id="confirm-create-group-btn" style="padding: 8px 16px; border-radius: 6px; border: none; background: #00d1b2; color: #fff; cursor: pointer; font-weight: 600;">Tạo nhóm</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    fetch('/api/friends', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(friends => {
            const listDiv = document.getElementById('friends-checkbox-list');
            if (friends.length === 0) {
                listDiv.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 14px; padding: 10px;">Chưa có bạn bè để thêm vào nhóm</div>';
                return;
            }
            listDiv.innerHTML = '';
            friends.forEach(f => {
                const item = document.createElement('div');
                item.style.cssText = "display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border-color, #f0f2f5);";
                item.innerHTML = `
                    <input type="checkbox" value="${f.id}" class="group-member-checkbox" id="checkbox-friend-${f.id}">
                    <img src="${f.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(f.fullName) + '&background=F6DE50&color=1a1a1a'}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
                    <label for="checkbox-friend-${f.id}" style="color: var(--text-main); cursor: pointer; flex-grow: 1; font-size: 14px;">${f.fullName}</label>
                `;
                listDiv.appendChild(item);
            });
        });

    const closeModal = () => modal.remove();
    document.getElementById('close-create-group-modal').onclick = closeModal;
    document.getElementById('cancel-create-group-btn').onclick = closeModal;

    document.getElementById('confirm-create-group-btn').onclick = () => {
        const nameInput = document.getElementById('new-group-name');
        const groupName = nameInput.value.trim();
        if (!groupName) {
            alert('Vui lòng nhập tên nhóm!');
            return;
        }

        const checkboxes = document.querySelectorAll('.group-member-checkbox:checked');
        const memberIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

        if (memberIds.length < 2) {
            alert('Vui lòng chọn ít nhất 2 người bạn để tạo nhóm!');
            return;
        }

        fetch('/api/groups', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: groupName, memberIds: memberIds })
        })
        .then(res => {
            if (!res.ok) throw new Error('Không thể tạo nhóm');
            return res.json();
        })
        .then(group => {
            closeModal();
            loadChatSidebar();
            openChatBox(group.id, group.name, group.avatar, true);
        })
        .catch(err => {
            console.error(err);
            alert('Lỗi khi tạo nhóm!');
        });
    };
}
