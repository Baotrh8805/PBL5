
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
    // Check if post is deleted/rejected and display warning banner for the author
    const warningBanner = document.getElementById('post-deleted-warning-banner');
    if (warningBanner) {
        warningBanner.remove();
    }
    
    if (post.status === 'REJECTED' || post.status === 'AUTO_REJECTED') {
        const banner = document.createElement('div');
        banner.id = 'post-deleted-warning-banner';
        banner.style.background = '#ffe8e8';
        banner.style.color = '#d93d59';
        banner.style.padding = '12px 16px';
        banner.style.fontSize = '13px';
        banner.style.fontWeight = '600';
        banner.style.borderBottom = '1px solid #fcd2d8';
        banner.style.display = 'flex';
        banner.style.alignItems = 'center';
        banner.style.gap = '10px';
        banner.style.width = '100%';
        banner.style.boxSizing = 'border-box';
        
        if (document.documentElement.getAttribute('data-theme') === 'dark') {
            banner.style.background = 'rgba(217, 61, 89, 0.15)';
            banner.style.color = '#ff6b8b';
            banner.style.borderBottom = '1px solid rgba(217, 61, 89, 0.3)';
        }
        
        banner.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 16px; flex-shrink: 0;"></i>
            <span>Bài viết này đã bị gỡ do vi phạm tiêu chuẩn cộng đồng. Chỉ bạn mới có thể xem và bài viết sẽ bị xóa vĩnh viễn sau 3 ngày kể từ ngày gỡ.</span>
        `;
        const sidebar = document.querySelector('.post-info-sidebar');
        if (sidebar) {
            sidebar.insertBefore(banner, sidebar.firstChild);
        }
    }

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
    document.getElementById('post-author-name').innerHTML = `<a href="/html/profile.html?userId=${post.authorId}" style="text-decoration:none; color:inherit;">${post.authorName}</a>`;
    const authorAvatar = post.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName)}&background=00d1b2&color=fff`;
    const authorAvatarImg = document.getElementById('post-author-avatar');
    authorAvatarImg.src = authorAvatar;
    authorAvatarImg.style.cursor = 'pointer';
    authorAvatarImg.onclick = () => {
        window.location.href = `/html/profile.html?userId=${post.authorId}`;
    };

    // Time
    document.getElementById('post-time').innerText = timeSince(post.createdAt);

    // Content
    const postTextContainer = document.getElementById('post-text');
    postTextContainer.innerText = post.content || '';
    if (post.sharedPost) {
        postTextContainer.insertAdjacentHTML('beforeend', `
            <div class="shared-post-preview" onclick="window.location.href='/html/post.html?id=${post.sharedPost.id}'" style="border: 1px solid var(--border-color); border-radius: 8px; margin-top: 15px; padding: 12px; background: var(--comment-bg); cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='var(--button-hover)'" onmouseout="this.style.backgroundColor='var(--comment-bg)'">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <img src="${post.sharedPost.authorAvatar || '/uploads/default-avatar.png'}" class="avatar-small" style="width: 24px; height: 24px; border-radius: 50%;" onerror="this.src='/uploads/default-avatar.png'">
                    <span style="font-weight: 600; font-size: 13px; margin-left: 8px;">${post.sharedPost.authorName}</span>
                </div>
                <p style="font-size: 13px; color: var(--text-color); margin-bottom: 8px;">${(post.sharedPost.content || '').replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                ${post.sharedPost.imageUrl ? `<img src="${post.sharedPost.imageUrl}" style="max-width: 100%; border-radius: 8px;">` : ''}
                ${post.sharedPost.videoUrl ? `<video src="${post.sharedPost.videoUrl}" style="max-width: 100%; border-radius: 8px; background: #000; max-height: 200px;" controls></video>` : ''}
            </div>
        `);
    }

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

    // Share Button State
    const shareBtn = document.getElementById('share-button');
    if (shareBtn) {
        if (post.visibility !== 'PUBLIC') {
            shareBtn.style.display = 'none';
        } else {
            shareBtn.style.display = 'inline-flex';
            // Share is only fully functional in feeds for now unless post-creation.js is included
        }
    }

    // Post Options Menu
    const dropdownMenu = document.getElementById('post-dropdown-menu');
    if (post.mine || post.isMine) {
        dropdownMenu.innerHTML = `
            <a href="javascript:void(0)" onclick="deletePostDetail(${post.id})" style="color: var(--red-icon);"><i class="fa-regular fa-trash-can"></i> Xóa bài viết</a>
        `;
    } else {
        dropdownMenu.innerHTML = `
            <a href="javascript:void(0)" onclick="reportPost(${post.id})"><i class="fa-regular fa-flag"></i> Báo cáo bài viết</a>
        `;
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
    } else {
        menuHtml = `
            <div class="comment-menu-container">
                <div class="comment-menu-btn" onclick="toggleCommentMenu(event, ${c.id})">
                    <i class="fa-solid fa-ellipsis"></i>
                </div>
                <div class="comment-dropdown" id="comment-dropdown-${c.id}">
                    <div class="comment-dropdown-item" onclick="reportComment(${c.id})">
                        <i class="fa-regular fa-flag"></i> Báo cáo bình luận
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
                <a href="/html/profile.html?userId=${c.authorId}">
                    <img src="${avatar}" class="avatar-small" loading="lazy" style="width: ${isReply ? '24px' : '32px'}; height: ${isReply ? '24px' : '32px'}; border-radius: 50%; object-fit: cover;">
                </a>
                <div class="comment-bubble" style="background: var(--comment-bg); padding: 6px 12px; border-radius: 18px; max-width: 85%; position: relative;">
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
        <div style="display: flex; gap: 8px; align-items: center; background: var(--comment-bg); border-radius: 20px; padding: 4px 12px;">
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
        } else if (res.status === 403) {
            const msg = await res.text();
            if (typeof showBanModal === 'function') {
                showBanModal(msg);
            } else {
                alert(msg);
            }
        } else {
            const msg = await res.text();
            alert(msg || 'Không thể gửi bình luận');
        }
    } catch (err) {
        console.error(err);
    }
}

function showBanModal(message) {
    const oldModal = document.getElementById('ban-alert-modal');
    if (oldModal) oldModal.remove();

    const modalHtml = `
        <div id="ban-alert-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); display: flex; justify-content: center; align-items: center; z-index: 999999;">
            <div style="background: white; border-radius: 12px; width: 450px; max-width: 90vw; padding: 30px; text-align: center; box-shadow: 0 15px 40px rgba(0,0,0,0.4); position: relative;">
                <button onclick="document.getElementById('ban-alert-modal').remove()" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 28px; color: #65676b; cursor: pointer;">&times;</button>
                <div style="margin-bottom: 20px;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size: 60px; color: #e41e3f;"></i>
                </div>
                <h3 style="font-size: 22px; color: #1c1e21; margin-bottom: 15px; font-weight: 700;">Thông báo vi phạm</h3>
                <p style="font-size: 16px; color: #4b4f56; line-height: 1.5; margin-bottom: 25px;">${message}</p>
                <button onclick="document.getElementById('ban-alert-modal').remove()" style="background: #e41e3f; color: white; border: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; cursor: pointer; width: 100%;">Đóng</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
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
            <textarea id="edit-input-${commentId}" style="width: 100%; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-main); border-radius: 8px; padding: 5px; outline: none; font-size: 14px; font-family: inherit;">${currentContent}</textarea>
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
    
    // Thêm logic đóng menu bài viết nếu có
    const allPostDropdowns = document.querySelectorAll('.post-dropdown');
    if(allPostDropdowns) {
        allPostDropdowns.forEach(d => d.classList.remove('show'));
    }
});

let activeReportPostId = null;
let activeReportCommentId = null;

function reportPost(postId) {
    activeReportPostId = postId;
    activeReportCommentId = null;
    const titleEl = document.getElementById('report-modal-title');
    if(titleEl) titleEl.innerText = "Báo cáo bài viết";
    document.getElementById('report-modal').style.display = 'flex';
    document.getElementById('report-reason').value = '';
    
    const confirmBtn = document.getElementById('confirm-report-btn');
    confirmBtn.onclick = () => submitReport();
}

function reportComment(commentId) {
    activeReportCommentId = commentId;
    activeReportPostId = null;
    const titleEl = document.getElementById('report-modal-title');
    if(titleEl) titleEl.innerText = "Báo cáo bình luận";
    document.getElementById('report-modal').style.display = 'flex';
    document.getElementById('report-reason').value = '';
    
    const confirmBtn = document.getElementById('confirm-report-btn');
    confirmBtn.onclick = () => submitReport();
}

function closeReportModal() {
    document.getElementById('report-modal').style.display = 'none';
    activeReportPostId = null;
    activeReportCommentId = null;
}

async function submitReport() {
    const reason = document.getElementById('report-reason').value.trim();
    const categoryEl = document.getElementById('report-category');
    const category = categoryEl ? categoryEl.value : 'OTHER';
    if (!reason) {
        showToast('Vui lòng nhập lý do báo cáo.', 'error');
        return;
    }

    const token = localStorage.getItem('token');
    try {
        let endpoint = '';
        if (activeReportPostId) {
            endpoint = `/api/posts/${activeReportPostId}/report`;
        } else if (activeReportCommentId) {
            endpoint = `/api/posts/comments/${activeReportCommentId}/report`;
        } else {
            return;
        }

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ reason: reason, category: category })
        });

        if (res.ok) {
            closeReportModal();
            showToast('Cảm ơn bạn! Báo cáo đã được gửi.', 'success');
        } else {
            const txt = await res.text();
            showToast(txt, 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Lỗi khi gửi báo cáo.', 'error');
    }
}

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

window.togglePostMenu = function (event) {
    event.stopPropagation();
    const dropdown = document.getElementById('post-dropdown-menu');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
};

window.deletePostDetail = async function(postId) {
    if (!confirm('Bạn có chắc chắn muốn chuyển bài viết này vào thùng rác?')) return;
    
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/posts/${postId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            alert('Bài viết đã được chuyển vào thùng rác.');
            window.location.href = '/html/home.html';
        } else {
            const txt = await res.text();
            alert("Lỗi: " + txt);
        }
    } catch (err) {
        console.error(err);
    }
};
