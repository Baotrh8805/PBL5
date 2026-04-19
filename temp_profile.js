document.addEventListener('DOMContentLoaded', () => {
    // 1. Kiểm tra đăng nhập
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = "/";
        return;
    }

    // 2. Fetch User Info
    fetchUserProfile();
});

function fetchUserProfile() {
    const token = localStorage.getItem('token');
    fetch('/api/users/profile', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => {
        if (!res.ok) throw new Error('Token hết hạn');
        return res.json();
    })
    .then(user => {
        // Cập nhật Header
        const headerAvatar = document.getElementById('header-avatar');
        if (headerAvatar && user.avatar) {
            headerAvatar.src = user.avatar;
        }

        // Cập nhật Trang cá nhân
        document.getElementById('profile-name').innerText = user.fullName || "Người dùng";
        document.getElementById('profile-bio').innerText = user.bio || "Chưa có tiểu sử.";
        
        if (user.avatar) {
            document.getElementById('profile-avatar').src = user.avatar;
            document.getElementById('create-post-avatar').src = user.avatar;
        }

        document.getElementById('profile-relationship').innerText = user.relationshipStatus || '---';
        document.getElementById('profile-email').innerText = user.email || '---';
        document.getElementById('profile-phone').innerText = user.phoneNumber || '---';
        document.getElementById('profile-dob').innerText = user.dateOfBirth ? formatDate(user.dateOfBirth) : '---';
        document.getElementById('profile-gender').innerText = user.gender || '---';
        
        // Setup placeholders
        document.getElementById('post-content-input').placeholder = `${user.fullName} ơi, bạn đang nghĩ gì thế?`;
        
        // 3. Tải bài viết
        fetchMyPosts();
    })
    .catch(() => {
        localStorage.removeItem('token');
        window.location.href = "/";
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function fetchMyPosts() {
    const token = localStorage.getItem('token');
    fetch('/api/posts/me', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(posts => {
        renderProfilePosts(posts);
    })
    .catch(err => {
        document.getElementById('profile-posts-container').innerHTML = '<p style="text-align: center; color: red;">Lỗi tải bài viết.</p>';
    });
}

function timeSince(dateString) {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);
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

function renderProfilePosts(posts) {
    const container = document.getElementById('profile-posts-container');
    if (!posts || posts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #65676B; padding: 20px;">Chưa có bài viết nào.</p>';
        return;
    }
    
    container.innerHTML = '';
    
    posts.forEach(post => {
        let visibilityIcon = '';
        if (post.visibility === 'PUBLIC') visibilityIcon = '<i class="fa-solid fa-earth-americas" style="margin-left: 5px; font-size: 11px;"></i>';
        else if (post.visibility === 'FRIENDS') visibilityIcon = '<i class="fa-solid fa-user-group" style="margin-left: 5px; font-size: 10px;"></i>';
        else visibilityIcon = '<i class="fa-solid fa-lock" style="margin-left: 5px; font-size: 11px;"></i>';

        let postHtml = `
        <article class="card post" id="post-${post.id}">
            <div class="post-header">
                <img src="${post.authorAvatar || '/uploads/default-avatar.png'}" alt="Avatar" class="avatar-medium" onerror="this.src='/uploads/default-avatar.png'">
                <div class="post-meta">
                    <h4 class="post-author">${post.authorName}</h4>
                    <span class="post-time">${timeSince(post.createdAt)} ${visibilityIcon}</span>
                </div>
            </div>
            
            <div class="post-options">
                <button class="options-btn" onclick="toggleDropdown(${post.id})">
                    <i class="fa-solid fa-ellipsis"></i>
                </button>
                <div id="dropdown-${post.id}" class="dropdown-content">
                    ${post.mine ? `
                        <a href="javascript:void(0)" onclick="changeVisibility(${post.id}, 'PUBLIC')"><i class="fa-solid fa-earth-americas"></i> Công khai</a>
                        <a href="javascript:void(0)" onclick="changeVisibility(${post.id}, 'FRIENDS')"><i class="fa-solid fa-user-group"></i> Chỉ bạn bè</a>
                        <a href="javascript:void(0)" onclick="changeVisibility(${post.id}, 'PRIVATE')"><i class="fa-solid fa-lock"></i> Chỉ mình tôi</a>
                        <div style="height: 1px; background: #e4e6eb; margin: 4px 0;"></div>
                        <a href="javascript:void(0)" onclick="deletePost(${post.id})" style="color: var(--red-icon);"><i class="fa-regular fa-trash-can"></i> Xóa bài viết</a>
                    ` : `
                        <a href="javascript:void(0)" onclick="hidePost(${post.id})"><i class="fa-solid fa-eye-slash"></i> Ẩn bài viết này</a>
                        <a href="javascript:void(0)" onclick="reportPost(${post.id})"><i class="fa-regular fa-flag"></i> Báo cáo bài viết</a>
                    `}
                </div>
            </div>

            <div class="post-content">
                <p>${escapeHtml(post.content || '')}</p>
            </div>
        `;

        if (post.imageUrl) {
            postHtml += `
            <div class="post-image-placeholder text-center">
                <img src="${post.imageUrl}" alt="Post image" style="max-width: 100%; border-radius: 8px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;">
            </div>
            `;
        }

        const likeIcon = post.likedByCurrentUser ? 'fa-solid text-red' : 'fa-regular';
        const likeStyle = post.likedByCurrentUser ? 'color: var(--red-icon);' : '';

        postHtml += `
            <div class="post-actions-bar">
                <button class="interaction-btn" onclick="toggleLike(${post.id})" style="${likeStyle}">
                    <i class="${likeIcon} fa-heart"></i> Mọi người (${post.likeCount})
                </button>
                <button class="interaction-btn">
                    <i class="fa-regular fa-comment"></i> Bình luận (${post.commentCount})
                </button>
                <button class="interaction-btn"><i class="fa-regular fa-share-from-square"></i> Chia sẻ</button>
            </div>
        </article>
        `;

        container.innerHTML += postHtml;
    });
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
