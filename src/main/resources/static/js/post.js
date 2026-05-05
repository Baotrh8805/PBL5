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

    // Event Listeners
    document.getElementById('send-comment-btn').addEventListener('click', () => submitComment(postId, token));
    document.getElementById('comment-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitComment(postId, token);
    });
    document.getElementById('like-button').addEventListener('click', () => toggleLike(postId, token));
});

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
        mediaContainer.appendChild(video);
    } else if (post.imageUrl) {
        const img = document.createElement('img');
        img.src = post.imageUrl;
        img.alt = "Post media";
        mediaContainer.appendChild(img);
    } else {
        // No media, show text in the center
        mediaContainer.innerHTML = `<div style="color:white; font-size: 20px; padding: 40px; text-align:center;">${post.content}</div>`;
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

    list.innerHTML = comments.map(c => {
        const avatar = c.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.authorName)}&background=00d1b2&color=fff`;
        return `
            <div class="comment-item">
                <img src="${avatar}" class="avatar-small" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                <div class="comment-bubble">
                    <a href="/html/profile.html?userId=${c.authorId}" class="comment-user">${c.authorName}</a>
                    <div class="comment-text">${c.content}</div>
                </div>
            </div>
        `;
    }).join('');
}

async function submitComment(postId, token) {
    const input = document.getElementById('comment-input');
    const content = input.value.trim();
    if (!content) return;

    try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content: content })
        });

        if (res.ok) {
            input.value = '';
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
