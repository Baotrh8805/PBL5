import sys

with open('src/main/resources/static/js/chat.js', 'r') as f:
    chat_js = f.read()

old_code = """    document.getElementById('chat-target-name').innerText = name;
    document.getElementById('chat-target-avatar').src = targetAvatar;
    document.getElementById('chat-target-avatar').onerror = function() {
        this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00d1b2&color=fff`;
    };"""

new_code = """    document.getElementById('chat-target-name').innerHTML = `<a href="/html/profile.html?userId=${userId}" style="text-decoration:none; color:inherit;">${name}</a>`;
    document.getElementById('chat-target-avatar').src = targetAvatar;
    document.getElementById('chat-target-avatar').onclick = () => { window.location.href = `/html/profile.html?userId=${userId}`; };
    document.getElementById('chat-target-avatar').style.cursor = 'pointer';
    document.getElementById('chat-target-avatar').onerror = function() {
        this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00d1b2&color=fff`;
    };
    
    // Lưu lại targetAvatar để dùng trong appendMessageToUI nếu cần
    window.chatTargetAvatarUrl = targetAvatar;
"""

chat_js = chat_js.replace(old_code, new_code)

old_append = """    div.innerHTML = `
        <div class="chat-message ${isSent ? 'sent' : 'received'}">${msg.content}</div>
        <div class="chat-message-time">${timeStr}</div>
    `;"""

new_append = """    const targetAvatarHtml = !isSent ? `<img src="${window.chatTargetAvatarUrl || '/uploads/default-avatar.png'}" class="chat-msg-avatar" style="width:28px; height:28px; border-radius:50%; object-fit:cover; margin-right:8px;" onerror="this.style.display='none'">` : '';

    div.style.display = 'flex';
    div.style.flexDirection = isSent ? 'row-reverse' : 'row';
    div.style.alignItems = 'flex-end';

    div.innerHTML = `
        ${targetAvatarHtml}
        <div style="display:flex; flex-direction:column; align-items: ${isSent ? 'flex-end' : 'flex-start'};">
            <div class="chat-message ${isSent ? 'sent' : 'received'}" style="margin: 0;">${msg.content}</div>
            <div class="chat-message-time">${timeStr}</div>
        </div>
    `;"""

chat_js = chat_js.replace(old_append, new_append)

with open('src/main/resources/static/js/chat.js', 'w') as f:
    f.write(chat_js)
