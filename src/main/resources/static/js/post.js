// post.js

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');

    if (!postId) {
        alert('Không tìm thấy ID bài viết!');
        window.location.href = '/html/home.html';
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    fetchPostDetail(postId, token);
    fetchMyProfile(token);

    // Media Upload for Comments
    const mediaInput = document.getElementById('comment-media-input');
    if (mediaInput) {
        mediaInput.addEventListener('change', previewCommentMedia);
    }

    // Event Listeners
    document.getElementById('send-comment-btn').addEventListener('click', () => submitComment(postId, token));
    document.getElementById('comment-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitComment(postId, token);
    });
    document.getElementById('like-button').addEventListener('click', () => toggleLike(postId, token));
});

let selectedMediaFile = null;
let selectedMediaType = null;

function previewCommentMedia(event) {
    const file = event.target.files[0];
    if (file) {
        selectedMediaFile = file;
        const fileName = (file.name || '').toLowerCase();
        const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/.test(fileName);
        selectedMediaType = isVideo ? 'video' : 'image';

        const reader = new FileReader();
        reader.onload = function (e) {
            const imgPreview = document.getElementById('comment-image-preview');
            const videoPreview = document.getElementById('comment-video-preview');
            const container = document.getElementById('comment-media-preview-container');

            if (isVideo) {
                imgPreview.style.display = 'none';
                videoPreview.style.display = 'block';
                videoPreview.src = e.target.result;
            } else {
                imgPreview.style.display = 'block';
                videoPreview.style.display = 'none';
                imgPreview.src = e.target.result;
            }
            container.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
}

function removeCommentMedia() {
    selectedMediaFile = null;
    selectedMediaType = null;
    document.getElementById('comment-media-input').value = '';
    document.getElementById('comment-media-preview-container').style.display = 'none';
    document.getElementById('comment-image-preview').src = '';
    document.getElementById('comment-video-preview').src = '';
}

async function fetchPostDetail(postId, token) {
    try {
        const res = await fetch(`/api/posts/${postId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const post = await res.json();
            renderPostDetail(post);
            fetchComments(postId, token);
        } else {
            console.error("Lỗi khi tải chi tiết bài viết");
        }
    } catch (err) {
        console.error(err);
    }
}

function renderPostDetail(post) {
    // Media
    const mediaContainer = document.getElementById('media-content');
    mediaContainer.innerHTML = '';

    if (post.videoUrl) {
        const video = document.createElement('video');
        video.src = post.videoUrl;
        video.controls = true;
        video.autoplay = true;
        video.setAttribute('loading', 'lazy');
        mediaContainer.appendChild(video);
    } else if (post.imageUrl) {
        const img = document.createElement('img');
        img.src = post.imageUrl;
        img.alt = "Post media";
        img.setAttribute('loading', 'lazy');
        mediaContainer.appendChild(img);
    } else {
        // No media, show text in the center
        mediaContainer.innerHTML = `<div style="color:white; font-size: 20px; padding: 40px; text-align:center; white-space: pre-wrap;">${post.content}</div>`;
        document.querySelector('.post-media-viewer').style.backgroundColor = '#1c1e21';
    }

    // Author
    document.getElementById('post-author-name').innerText = post.authorName;
    const authorAvatar = post.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName)}&background=00d1b2&color=fff`;
    document.getElementById('post-author-avatar').src = authorAvatar;

    // Time
    document.getElementById('post-time').innerText = timeSince(post.createdAt);

    // Content
    document.getElementById('post-text').innerText = post.content || '';

    // Stats
    document.getElementById('like-count').innerText = post.likeCount || 0;
    document.getElementById('comment-count').innerText = post.commentCount || 0;

    // Like Button State
    const likeBtn = document.getElementById('like-button');
    if (post.likedByCurrentUser) {
        likeBtn.classList.add('active');
        likeBtn.innerHTML = '<i class="fa-solid fa-heart" style="color: #f02849;"></i> Thích';
    } else {
        likeBtn.classList.remove('active');
        likeBtn.innerHTML = '<i class="fa-regular fa-heart"></i> Thích';
    }
}

async function toggleLike(postId, token) {
    const likeBtn = document.getElementById('like-button');
    const likeCountSpan = document.getElementById('like-count');

    // Optimistic UI
    const isActive = likeBtn.classList.contains('active');
    let currentCount = parseInt(likeCountSpan.innerText) || 0;

    if (isActive) {
        likeBtn.classList.remove('active');
        likeBtn.innerHTML = '<i class="fa-regular fa-heart"></i> Thích';
        likeCountSpan.innerText = Math.max(0, currentCount - 1);
    } else {
        likeBtn.classList.add('active');
        likeBtn.innerHTML = '<i class="fa-solid fa-heart" style="color: #f02849;"></i> Thích';
        likeCountSpan.innerText = currentCount + 1;
    }

    try {
        await fetch(`/api/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (err) {
        console.error("Lỗi khi like:", err);
    }
}

async function fetchComments(postId, token) {
    try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const comments = await res.json();
        renderComments(comments);
    } catch (err) {
        console.error("Lỗi lấy bình luận:", err);
    }
}

function renderComments(comments) {
    const list = document.getElementById('comments-list-detail');
    if (comments.length === 0) {
        list.innerHTML = '<div style="color: #65676b; font-size: 14px; text-align:center; padding: 20px;">Chưa có bình luận nào.</div>';
        return;
    }

    list.innerHTML = comments.map(c => renderCommentItem(c)).join('');
}

function renderCommentItem(c, isReply = false) {
    const avatar = c.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.authorName)}&background=00d1b2&color=fff`;
    let mediaHtml = '';
    if (c.imageUrl) {
        mediaHtml = `<img src="${c.imageUrl}" loading="lazy" style="max-width: 100%; border-radius: 8px; margin-top: 8px; display: block;">`;
    } else if (c.videoUrl) {
        mediaHtml = `<video src="${c.videoUrl}" loading="lazy" controls style="max-width: 100%; border-radius: 8px; margin-top: 8px; display: block;"></video>`;
    }

    const createdAtDate = new Date(c.createdAt);
    const now = new Date();
    const diffMinutes = (now - createdAtDate) / (1000 * 60);

    let actionsHtml = `
        <div class="comment-actions" style="margin-left: ${isReply ? '35px' : '42px'}; font-size: 11px; display: flex; gap: 12px; margin-top: 5px; align-items: center;">
            <span onclick="toggleCommentLike(${c.id})" id="comment-like-btn-${c.id}" style="color: ${c.liked ? 'var(--primary-color)' : '#65676b'}; cursor: pointer; font-weight: 600;">
                ${c.liked ? 'Đã thích' : 'Thích'} ${c.likeCount > 0 ? `(${c.likeCount})` : ''}
            </span>
            ${!isReply ? `<span onclick="showReplyInput(${c.id}, '${c.authorName}')" style="color: #65676b; cursor: pointer; font-weight: 600;">Phản hồi</span>` : ''}
            <span style="color: #65676b; font-size: 11px;">${timeSince(c.createdAt)}</span>
        </div>
    `;

    let menuHtml = '';
    if (c.isMine) {
        menuHtml = `
            <div class="comment-menu-container">
                <div class="comment-menu-btn" onclick="toggleCommentMenu(event, ${c.id})">
                    <i class="fa-solid fa-ellipsis"></i>
                </div>
                <div class="comment-dropdown" id="comment-dropdown-${c.id}">
                    ${diffMinutes < 30 ? `
                        <div class="comment-dropdown-item" onclick="startEditComment(${c.id}, '${c.content ? c.content.replace(/'/g, "\\'").replace(/"/g, "&quot;") : ''}')">
                            <i class="fa-solid fa-pen"></i> Chỉnh sửa
                        </div>
                    ` : ''}
                    <div class="comment-dropdown-item" onclick="deleteComment(${c.id})" style="color: #f02849;">
                        <i class="fa-solid fa-trash"></i> Xóa bình luận
                    </div>
                </div>
            </div>
        `;
    }

    let repliesHtml = '';
    if (c.replies && c.replies.length > 0) {
        repliesHtml = `<div class="replies-container" style="margin-left: 35px; border-left: 2px solid #e4e6eb; padding-left: 10px; margin-top: 10px;">
            ${c.replies.map(r => renderCommentItem(r, true)).join('')}
        </div>`;
    }

    return `
        <div class="comment-item-container" id="comment-container-${c.id}" style="margin-bottom: 15px;">
            <div class="comment-item" style="display: flex; gap: 10px;">
                <img src="${avatar}" class="avatar-small" loading="lazy" style="width: ${isReply ? '24px' : '32px'}; height: ${isReply ? '24px' : '32px'}; border-radius: 50%; object-fit: cover;">
                <div class="comment-bubble" style="background: #f0f2f5; padding: 6px 12px; border-radius: 18px; max-width: 85%; position: relative;">
                    <a href="/html/profile.html?userId=${c.authorId}" class="comment-user" style="font-weight: bold; color: inherit; text-decoration: none; font-size: 13px;">${c.authorName}</a>
                    <div class="comment-text" id="comment-content-${c.id}" style="font-size: 14px; margin-top: 2px; white-space: pre-wrap;">${c.content || ''}</div>
                    ${mediaHtml}
                </div>
                ${menuHtml}
            </div>
            ${actionsHtml}
            <div id="reply-input-container-${c.id}" style="margin-left: 42px; margin-top: 10px;"></div>
            ${repliesHtml}
        </div>
    `;
}

async function toggleCommentLike(commentId) {
    const token = localStorage.getItem('token');
    const postId = new URLSearchParams(window.location.search).get('id');
    try {
        const res = await fetch(`/api/posts/comments/${commentId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            fetchComments(postId, token);
        }
    } catch (err) {
        console.error(err);
    }
}

function showReplyInput(commentId, authorName) {
    const container = document.getElementById(`reply-input-container-${commentId}`);
    if (container.innerHTML !== '') {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: center; background: #f0f2f5; border-radius: 20px; padding: 4px 12px;">
            <input type="text" id="reply-field-${commentId}" placeholder="Trả lời ${authorName}..." 
                style="flex: 1; border: none; background: transparent; outline: none; padding: 6px 0; font-size: 13px;"
                onkeypress="if(event.key==='Enter') submitReply(${commentId})">
            <i class="fas fa-paper-plane" onclick="submitReply(${commentId})" style="color: var(--primary-color); cursor: pointer;"></i>
        </div>
    `;
    document.getElementById(`reply-field-${commentId}`).focus();
}

async function submitReply(parentId) {
    const field = document.getElementById(`reply-field-${parentId}`);
    const content = field.value.trim();
    if (!content) return;

    const token = localStorage.getItem('token');
    const postId = new URLSearchParams(window.location.search).get('id');
    try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content, parentId })
        });
        if (res.ok) {
            fetchComments(postId, token);
        }
    } catch (err) {
        console.error(err);
    }
}

async function submitComment(postId, token) {
    const input = document.getElementById('comment-input');
    const content = input.value.trim();

    let imageUrl = null;
    let videoUrl = null;

    if (!content && !selectedMediaFile) return;

    try {
        if (selectedMediaFile) {
            const formData = new FormData();
            formData.append('file', selectedMediaFile);
            const endpoint = selectedMediaType === 'video' ? '/api/upload/video' : '/api/upload/image';
            const uploadRes = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                if (selectedMediaType === 'video') videoUrl = uploadData.videoUrl || uploadData.url;
                else imageUrl = uploadData.imageUrl || uploadData.url;
            } else {
                alert('Lỗi upload media');
                return;
            }
        }

        const res = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                content: content,
                imageUrl: imageUrl,
                videoUrl: videoUrl
            })
        });

        if (res.ok) {
            input.value = '';
            removeCommentMedia();

            // Update count locally for immediate feedback
            const commentCountSpan = document.getElementById('comment-count');
            let currentCount = parseInt(commentCountSpan.innerText) || 0;
            commentCountSpan.innerText = currentCount + 1;

            fetchComments(postId, token); // Refresh list
        }
    } catch (err) {
        console.error(err);
    }
}

async function fetchMyProfile(token) {
    try {
        const res = await fetch('/api/users/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const user = await res.json();
            const avatar = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=00d1b2&color=fff`;
            document.getElementById('my-avatar').src = avatar;
        }
    } catch (err) {
        console.error(err);
    }
}

function timeSince(dateString) {
    const postDate = new Date(dateString);
    if (Number.isNaN(postDate.getTime())) return 'Vừa xong';
    const seconds = Math.floor((new Date() - postDate) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " năm trước";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " tháng trước";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " ngày trước";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " giờ trước";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " phút trước";
    return Math.floor(seconds) + " giây trước";
}

async function deleteComment(commentId) {
    if (!confirm('Bạn có chắc chắn muốn xóa bình luận này?')) return;
    const token = localStorage.getItem('token');
    const postId = new URLSearchParams(window.location.search).get('id');
    try {
        const res = await fetch(`/api/posts/comments/${commentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            // Update count locally
            const commentCountSpan = document.getElementById('comment-count');
            let currentCount = parseInt(commentCountSpan.innerText) || 0;
            if (currentCount > 0) commentCountSpan.innerText = currentCount - 1;

            fetchComments(postId, token);
        } else {
            const data = await res.json();
            alert(data.message || 'Lỗi khi xóa bình luận');
        }
    } catch (err) {
        console.error(err);
    }
}

window.startEditComment = function (commentId, currentContent) {
    const contentDiv = document.getElementById(`comment-content-${commentId}`);
    const originalHtml = contentDiv.innerHTML;

    contentDiv.innerHTML = `
        <div style="margin-top: 5px;">
            <textarea id="edit-input-${commentId}" style="width: 100%; border: 1px solid #ced4da; border-radius: 8px; padding: 5px; outline: none; font-size: 14px; font-family: inherit;">${currentContent}</textarea>
            <div style="display: flex; gap: 5px; margin-top: 5px; justify-content: flex-end;">
                <button onclick="cancelEditComment(${commentId}, \`${originalHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)" style="background: #e4e6eb; border: none; padding: 3px 8px; border-radius: 5px; font-size: 12px; cursor: pointer;">Hủy</button>
                <button onclick="saveEditComment(${commentId})" style="background: var(--primary-color); color: white; border: none; padding: 3px 8px; border-radius: 5px; font-size: 12px; cursor: pointer;">Lưu</button>
            </div>
        </div>
    `;
};

window.cancelEditComment = function (commentId, originalHtml) {
    const contentDiv = document.getElementById(`comment-content-${commentId}`);
    contentDiv.innerHTML = originalHtml;
};

async function saveEditComment(commentId) {
    const newContent = document.getElementById(`edit-input-${commentId}`).value.trim();
    if (!newContent) return;

    const token = localStorage.getItem('token');
    const postId = new URLSearchParams(window.location.search).get('id');
    try {
        const res = await fetch(`/api/posts/comments/${commentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content: newContent })
        });
        if (res.ok) {
            fetchComments(postId, token);
        } else {
            const data = await res.json();
            alert(data.message || 'Lỗi khi cập nhật bình luận');
        }
    } catch (err) {
        console.error(err);
    }
}

// Comment Menu Logic
window.toggleCommentMenu = function (event, commentId) {
    event.stopPropagation();
    const allDropdowns = document.querySelectorAll('.comment-dropdown');
    allDropdowns.forEach(d => {
        if (d.id !== `comment-dropdown-${commentId}`) {
            d.classList.remove('show');
        }
    });
    
    const dropdown = document.getElementById(`comment-dropdown-${commentId}`);
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
};

// Global click to close dropdowns
document.addEventListener('click', () => {
    const allDropdowns = document.querySelectorAll('.comment-dropdown');
    allDropdowns.forEach(d => d.classList.remove('show'));
});
