let targetUserId = null;
let currentUserId = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Kiểm tra đăng nhập
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = "/";
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('userId');
    if (id) targetUserId = parseInt(id);

    // 2. Fetch User Info
    fetchUserProfile();
});

function fetchUserProfile() {
    const token = localStorage.getItem('token');
    
    fetch('/api/users/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if (!res.ok) throw new Error('Token hết hạn');
        return res.json();
    })
    .then(currentUser => {
        currentUserId = currentUser.id;
        
        // --- Populate Global Sidebars and Header ---
        document.querySelectorAll('.user-name').forEach(el => {
            el.textContent = currentUser.fullName || 'Người dùng';
        });
        
        let avatarUrl = currentUser.avatar;
        if (!avatarUrl && currentUser.fullName) {
            avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.fullName)}&background=00d1b2&color=fff`;
        }

        document.querySelectorAll('#header-avatar, .avatar-large, .avatar-small, #modal-avatar').forEach(img => {
            img.src = avatarUrl;
        });

        // Admin/Moderator Menu
        if (currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR') {
            const adminContainer = document.getElementById('admin-menu-container');
            if (adminContainer) {
                adminContainer.innerHTML = `
                    <a href="/html/admin.html" id="admin-menu-item" class="menu-item admin-menu-item">
                        <i class="fa-solid ${currentUser.role === 'ADMIN' ? 'fa-shield-halved' : 'fa-user-shield'}"></i>
                        <span>${currentUser.role === 'ADMIN' ? 'Quản trị hệ thống' : 'Kiểm duyệt'}</span>
                    </a>
                `;
            }
        }
        // --- End Sidebar Population ---

        if (targetUserId && targetUserId !== currentUserId) {
            // Xem trang của người khác
            fetchTargetUser(targetUserId, token);
        } else {
            // Xem trang của mình
            fillProfileData(currentUser, true);
            fetchMyPosts('/api/posts/me');
        }
    })
    .catch(() => {
        localStorage.removeItem('token');
        window.location.href = "/";
    });
}

function fetchTargetUser(id, token) {
    fetch(`/api/users/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if (!res.ok) throw new Error('Không lấy được user');
        return res.json();
    })
    .then(targetUser => {
        fillProfileData(targetUser, false);
        fetchMyPosts(`/api/posts/user/${targetUser.id}`);
    })
    .catch(err => console.error(err));
}

function fillProfileData(user, isCurrentUser) {
    // Cập nhật Trang cá nhân
    document.getElementById('profile-name').innerText = user.fullName || "Người dùng";
    document.getElementById('profile-bio').innerText = user.bio || "Chưa có tiểu sử.";
    
    if (user.avatar) {
        const pAvatar = document.getElementById('profile-avatar');
        if (pAvatar) pAvatar.src = user.avatar;
        const cpAvatar = document.getElementById('create-post-avatar');
        if (cpAvatar) cpAvatar.src = user.avatar;
        const modalAvatar = document.getElementById('modal-avatar');
        if (modalAvatar) modalAvatar.src = user.avatar;
    }

    const relEl = document.getElementById('profile-relationship');
    if (relEl) relEl.innerText = user.relationshipStatus || '---';
    const emailEl = document.getElementById('profile-email');
    if (emailEl) emailEl.innerText = user.email || '---';
    const phoneEl = document.getElementById('profile-phone');
    if (phoneEl) phoneEl.innerText = user.phoneNumber || '---';
    const dobEl = document.getElementById('profile-dob');
    if (dobEl) dobEl.innerText = user.dateOfBirth ? formatDate(user.dateOfBirth) : '---';
    const genderEl = document.getElementById('profile-gender');
    if (genderEl) genderEl.innerText = user.gender || '---';
    
    // Luôn hiển thị tên của CHÍNH MÌNH (currentUser) trong các modal tạo bài viết hoặc chỉnh sửa
    // Tuy nhiên, ở trang cá nhân người khác, user truyền vào fillProfileData là targetUser.
    // Chúng ta cần lấy fullName của currentUser đã lưu trước đó.
    const token = localStorage.getItem('token');
    fetch('/api/users/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(curr => {
        document.querySelectorAll('.modal-user-name').forEach(el => {
            el.textContent = curr.fullName || 'Người dùng';
        });
        const modalAvt = document.getElementById('modal-avatar');
        if (modalAvt) modalAvt.src = curr.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(curr.fullName)}&background=00d1b2&color=fff`;
    });

    if (isCurrentUser) {
        // Setup placeholders
    } else {
        // Ẩn các nút chỉnh sửa
        const btnEdit = document.getElementById('btn-edit-profile');
        if (btnEdit) btnEdit.style.display = 'none';
        
        const editAvt = document.querySelector('.edit-avatar-btn');
        if (editAvt) editAvt.style.display = 'none';
        const editCov = document.querySelector('.edit-cover-btn');
        if (editCov) editCov.style.display = 'none';

        // Ẩn khung tạo bài viết
        const createPostBlock = document.querySelector('.create-post-box');
        if (createPostBlock) createPostBlock.style.display = 'none';

        // Hiện nút nhắn tin
        const btnMsg = document.getElementById('btn-message');
        if (btnMsg) {
        const fAction = document.getElementById('friendship-actions');
        if (fAction) {
            fAction.style.display = 'inline-block';
            const status = user.friendshipStatus;
            const targetId = user.id;
            if (!status || status === 'NONE') {
                fAction.innerHTML = `<button class="btn btn-primary" onclick="sendFriendRequest(${targetId})"><i class="fa-solid fa-user-plus"></i> Thêm bạn bè</button>`;
            } else if (status === 'PENDING') {
                if (targetId === user.receiverId) {
                    fAction.innerHTML = `<button class="btn btn-secondary" onclick="removeFriend(${targetId})"><i class="fa-solid fa-user-clock"></i> Đã gửi lời mời</button>`;
                } else {
                    fAction.innerHTML = `
                        <button class="btn btn-primary" onclick="acceptFriendRequest(${targetId})"><i class="fa-solid fa-user-check"></i> Chấp nhận</button>
                        <button class="btn btn-secondary" onclick="removeFriend(${targetId})"><i class="fa-solid fa-user-xmark"></i> Xóa</button>
                    `;
                }
            } else if (status === 'ACCEPTED') {
                fAction.innerHTML = `<button class="btn btn-secondary" onclick="removeFriend(${targetId})"><i class="fa-solid fa-user-group"></i> Bạn bè</button>`;
            }
        }
            btnMsg.style.display = 'inline-block';
            let avt = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=00d1b2&color=fff`;
            btnMsg.onclick = () => {
                if (typeof openChatBox === "function") {
                    openChatBox(user.id, user.fullName, avt);
                } else {
                    console.error("Chat functionality not loaded");
                }
            };
        }
    }

    // Fetch and display Photos and Friends
    fetchAndDisplayPhotos(user.id);
    fetchAndDisplayFriends(user.id);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Lấy danh sách ảnh từ bài viết của user
 */
async function fetchAndDisplayPhotos(userId) {
    const token = localStorage.getItem('token');
    const container = document.getElementById('profile-photos-grid');
    if (!container) return;

    try {
        const res = await fetch(`/api/posts/user/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const posts = await res.json();
            const photos = posts.filter(p => p.imageUrl).slice(0, 9);
            
            if (photos.length > 0) {
                container.innerHTML = photos.map(p => `
                    <div class="photo-item" onclick="window.location.href = '/html/post.html?id=${p.id}'">
                        <img src="${p.imageUrl}" alt="Post photo" onerror="this.parentElement.style.display='none'">
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<div style="grid-column: span 3; padding: 20px; text-align: center; color: #65676b; font-size: 13px;">Chưa có ảnh nào.</div>';
            }
            
            // Cập nhật số bài viết trong stats
            const statPosts = document.querySelector('.stat-item:nth-child(1) strong');
            if (statPosts) statPosts.innerText = posts.length;
        }
    } catch (err) {
        console.error("Lỗi lấy ảnh:", err);
    }
}

/**
 * Lấy danh sách bạn bè
 */
async function fetchAndDisplayFriends(userId) {
    const token = localStorage.getItem('token');
    const container = document.getElementById('profile-friends-grid');
    if (!container) return;

    try {
        const res = await fetch('/api/friends', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const friends = await res.json();
            const displayedFriends = friends.slice(0, 9);
            
            if (displayedFriends.length > 0) {
                container.innerHTML = displayedFriends.map(f => {
                    const avt = f.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.fullName)}&background=00d1b2&color=fff`;
                    return `
                        <a href="/html/profile.html?userId=${f.id}" class="friend-item">
                            <img src="${avt}" alt="${f.fullName}" class="friend-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(f.fullName)}&background=00d1b2&color=fff'">
                            <span class="friend-name">${f.fullName}</span>
                        </a>
                    `;
                }).join('');
            } else {
                container.innerHTML = '<div style="grid-column: span 3; padding: 20px; text-align: center; color: #65676b; font-size: 13px;">Chưa có bạn bè.</div>';
            }
            
            // Cập nhật số người theo dõi (tạm thời dùng số bạn bè)
            const statFollowers = document.querySelector('.stat-item:nth-child(2) strong');
            if (statFollowers) statFollowers.innerText = friends.length;
        }
    } catch (err) {
        console.error("Lỗi lấy bạn bè:", err);
    }
}

function fetchMyPosts(endpointUrl) {
    const token = localStorage.getItem('token');
    const url = endpointUrl || '/api/posts/me';
    fetch(url, {
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
        const isMine = post.mine ?? post.isMine ?? false;

        let postHtml = `
        <article class="card post" id="post-${post.id}">
            <div class="post-header">
                <img src="${post.authorAvatar || '/uploads/default-avatar.png'}" alt="Avatar" class="avatar-medium" onerror="this.src='/uploads/default-avatar.png'">
                <div class="post-meta">
                    <h4 class="post-author"><a href="/html/profile.html?userId=${post.authorId}" style="text-decoration:none; color:inherit;">${post.authorName}</a></h4>
                    <span class="post-time"><a href="/html/post.html?id=${post.id}" style="text-decoration:none; color:inherit;">${timeSince(post.createdAt)}</a> <span id="visibility-icon-${post.id}">${visibilityIcon}</span></span>
                </div>
            </div>
            
            <div class="post-options">
                <button class="options-btn" onclick="toggleDropdown(${post.id})">
                    <i class="fa-solid fa-ellipsis"></i>
                </button>
                <div id="dropdown-${post.id}" class="dropdown-content">
                    ${isMine ? `
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
            <a href="/html/post.html?id=${post.id}" class="post-image-link">
                <div class="post-image-placeholder text-center">
                    <img src="${post.imageUrl}" alt="Post image" style="max-width: 100%; border-radius: 8px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;">
                </div>
            </a>
            `;
        }

        if (post.videoUrl) {
            postHtml += `
            <a href="/html/post.html?id=${post.id}" class="post-video-link">
                <div class="post-video-placeholder text-center">
                    <video src="${post.videoUrl}" style="max-width: 100%; border-radius: 8px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto; background: #000; max-height: 400px;"></video>
                </div>
            </a>
            `;
        }

        const likeIcon = post.likedByCurrentUser ? 'fa-solid text-red' : 'fa-regular';
        const likeStyle = post.likedByCurrentUser ? 'color: var(--red-icon);' : '';

        postHtml += `
            <div class="post-actions-bar">
                <button id="like-btn-${post.id}" class="interaction-btn" onclick="toggleLike(${post.id})" style="${likeStyle}">
                    <i id="like-icon-${post.id}" class="${likeIcon} fa-heart"></i> <span id="like-count-${post.id}">Mọi người (${post.likeCount})</span>
                </button>
                <button class="interaction-btn" onclick="toggleComments(${post.id})">
                    <i class="fa-regular fa-comment"></i> <span id="comment-count-${post.id}">Bình luận (${post.commentCount})</span>
                </button>
                <button class="interaction-btn"><i class="fa-regular fa-share-from-square"></i> Chia sẻ</button>
            </div>

            <!-- COMMENT SECTION -->
            <div id="comments-${post.id}" class="comments-section" style="display: none; padding: 15px; border-top: 1px solid #ced0d4;">
                <div class="comment-input-wrapper" style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <img src="${document.getElementById('header-avatar') && document.getElementById('header-avatar').src ? document.getElementById('header-avatar').src : '/uploads/default-avatar.png'}" alt="Avatar" class="avatar-small" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.src='/uploads/default-avatar.png'">
                    <input type="text" id="comment-input-${post.id}" class="post-input" placeholder="Viết bình luận..." onkeypress="handleCommentKeyPress(event, ${post.id})">
                    <button class="btn btn-primary" onclick="submitComment(${post.id})"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
                <div id="comment-list-${post.id}" class="comment-list" style="display: flex; flex-direction: column; gap: 10px;">
                    <!-- Nơi bình luận hiển thị -->
                </div>
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
         .replace(/'/g, "&#039;")
         .replace(/\n/g, "<br>");
}

// ===== API GỌI XÓA VÀ CHỈNH SỬA POST (Đồng bộ với home.js) =====

async function toggleLike(postId) {
    const token = localStorage.getItem('token');
    
    // UI Cập nhật tức thì (Optimistic UI)
    const likeBtn = document.getElementById(`like-btn-${postId}`);
    const likeIcon = document.getElementById(`like-icon-${postId}`);
    const likeCountSpan = document.getElementById(`like-count-${postId}`);
    
    if (likeBtn && likeIcon && likeCountSpan) {
        const isLiked = likeIcon.classList.contains('fa-solid');
        
        let currentCount = 0;
        const countMatch = likeCountSpan.innerText.match(/\d+/);
        if (countMatch) {
            currentCount = parseInt(countMatch[0], 10);
        }

        if (isLiked) {
            // Đổi thành chưa like
            likeIcon.classList.remove('fa-solid', 'text-red');
            likeIcon.classList.add('fa-regular');
            likeBtn.style.color = '';
            likeCountSpan.innerText = `Mọi người (${Math.max(0, currentCount - 1)})`;
        } else {
            // Đổi thành đã like
            likeIcon.classList.remove('fa-regular');
            likeIcon.classList.add('fa-solid', 'text-red');
            likeBtn.style.color = 'var(--red-icon)';
            likeCountSpan.innerText = `Mọi người (${currentCount + 1})`;
        }
    }

    try {
        const res = await fetch(`/api/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            console.error("Lỗi khi cập nhật like trên server");
        }
    } catch (err) {
        console.error(err);
    }
}

// Logic Xử lý Dropdown (menu 3 chấm)
function toggleDropdown(postId) {
    const dropdown = document.getElementById('dropdown-' + postId);
    dropdown.classList.toggle("show");
}

// Ẩn menu khi click ra ngoài
window.onclick = function(event) {
    if (!event.target.closest('.options-btn')) {
        var dropdowns = document.getElementsByClassName("dropdown-content");
        for (var i = 0; i < dropdowns.length; i++) {
            var openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
}

async function deletePost(postId) {
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return;
    
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/posts/${postId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            // Xóa khỏi giao diện
            document.getElementById('post-' + postId).remove();
        } else {
            const txt = await res.text();
            alert("Lỗi: " + txt);
        }
    } catch (err) {
        console.error(err);
    }
}

async function changeVisibility(postId, level) {
    const token = localStorage.getItem('token');
    
    // Optimistic UI update: thay đổi icon hiển thị ngay lập tức
    const visibilityIconSpan = document.getElementById(`visibility-icon-${postId}`);
    if (visibilityIconSpan) {
        if (level === 'PUBLIC') visibilityIconSpan.innerHTML = '<i class="fa-solid fa-earth-americas" title="Công khai"></i>';
        else if (level === 'FRIENDS') visibilityIconSpan.innerHTML = '<i class="fa-solid fa-user-group" title="Bạn bè"></i>';
        else visibilityIconSpan.innerHTML = '<i class="fa-solid fa-lock" title="Chỉ mình tôi"></i>';
    }

    const dropdown = document.getElementById(`dropdown-${postId}`);
    if (dropdown) {
        dropdown.classList.remove('show');
    }

    try {
        // level: PUBLIC, FRIENDS, PRIVATE
        const res = await fetch(`/api/posts/${postId}/visibility?level=${level}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            const txt = await res.text();
            alert("Lỗi: " + txt);
        }
    } catch (err) {
        console.error(err);
    }
}

function hidePost(postId) {
    document.getElementById('post-' + postId).style.display = 'none';
}

function reportPost(postId) {
    alert('Đã gửi báo cáo vi phạm nội dung!');
    // Ẩn luôn sau khi báo cáo như FB
    document.getElementById('post-' + postId).style.display = 'none';
}

// ======================= CHỨC NĂNG BÌNH LUẬN =======================

function toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    if (commentsSection.style.display === 'none') {
        commentsSection.style.display = 'block';
        fetchComments(postId);
    } else {
        commentsSection.style.display = 'none';
    }
}

async function fetchComments(postId) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const comments = await res.json();
        
        const listDiv = document.getElementById(`comment-list-${postId}`);
        listDiv.innerHTML = '';
        
        if (comments.length === 0) {
            listDiv.innerHTML = '<span style="color: #65676b; font-size: 13px;">Chưa có bình luận nào. Hãy là người đầu tiên!</span>';
            return;
        }

        comments.forEach(c => {
            const timeStr = timeSince(c.createdAt);
            listDiv.innerHTML += `
                <div style="margin-bottom: 10px;">
                    <div class="comment" style="display: flex; gap: 8px;">
                        <img src="${c.authorAvatar || '/uploads/default-avatar.png'}" class="avatar-small" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.src='/uploads/default-avatar.png'">
                        <div class="comment-bubble" style="background: #f0f2f5; padding: 8px 12px; border-radius: 18px; max-width: 80%;">
                            <strong style="font-size: 13px;"><a href="/html/profile.html?userId=${c.authorId}" style="text-decoration:none; color:inherit;">${c.authorName}</a></strong>
                            <div style="font-size: 14px; margin-top: 2px; white-space: pre-wrap;">${escapeHtml(c.content || '')}</div>
                        </div>
                    </div>
                    <div style="font-size: 11px; color: #65676b; margin-left: 45px; margin-top: 2px;">${timeStr}</div>
                </div>
            `;
        });
    } catch (err) {
        console.error("Lỗi lấy comment:", err);
    }
}

function handleCommentKeyPress(event, postId) {
    if (event.key === 'Enter') {
        submitComment(postId);
    }
}

async function submitComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value.trim();
    if (!content) return;

    const token = localStorage.getItem('token');
    
    // Optimistic UI update: cộng số bình luận
    const commentCountSpan = document.getElementById(`comment-count-${postId}`);
    if (commentCountSpan) {
        const countMatch = commentCountSpan.innerText.match(/\d+/);
        let currentCount = countMatch ? parseInt(countMatch[0], 10) : 0;
        commentCountSpan.innerText = `Bình luận (${currentCount + 1})`;
    }

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
            fetchComments(postId); // Chỉ tải lại đúng danh sách bình luận của bài này
        } else {
            alert('Lỗi gửi bình luận');
        }
    } catch (err) {
        console.error(err);
    }
}

// === FRIENDSHIP START ===
function sendFriendRequest(id) {
    const token = localStorage.getItem('token');
    fetch(`/api/friends/request/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if(res.ok) location.reload();
        else alert("Lỗi gửi yêu cầu");
    });
}
function acceptFriendRequest(id) {
    const token = localStorage.getItem('token');
    fetch(`/api/friends/accept/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if(res.ok) location.reload();
        else alert("Lỗi chấp nhận yêu cầu");
    });
}
function removeFriend(id) {
    if(!confirm("Bạn có chắc chắn muốn thực hiện thao tác này?")) return;
    const token = localStorage.getItem('token');
    fetch(`/api/friends/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if(res.ok) location.reload();
        else alert("Lỗi xóa/hủy");
    });
}
// === FRIENDSHIP END ===

// === CHỈNH SỬA TRANG CÁ NHÂN ===
let currentProfileData = null;

const originalFillProfileData = fillProfileData;
fillProfileData = function(user, isCurrentUser) {
    if(isCurrentUser) currentProfileData = user;
    
    if (user.cover) {
        document.getElementById('profile-cover').src = user.cover;
    }
    
    originalFillProfileData(user, isCurrentUser);
};

function openEditProfileModal() {
    if(!currentProfileData) return;
    document.getElementById('edit-fullname').value = currentProfileData.fullName || '';
    document.getElementById('edit-bio').value = currentProfileData.bio || '';
    document.getElementById('edit-relationship').value = currentProfileData.relationshipStatus || 'Độc thân';
    document.getElementById('edit-phone').value = currentProfileData.phoneNumber || '';
    
    if(currentProfileData.dateOfBirth) {
        let dob = new Date(currentProfileData.dateOfBirth);
        let yyyy = dob.getFullYear();
        let mm = String(dob.getMonth() + 1).padStart(2, '0');
        let dd = String(dob.getDate()).padStart(2, '0');
        document.getElementById('edit-dob').value = `${yyyy}-${mm}-${dd}`;
    }
    
    document.getElementById('edit-gender').value = currentProfileData.gender || 'Nam';
    
    document.getElementById('edit-profile-modal').style.display = 'flex';
}

function closeEditProfileModal() {
    document.getElementById('edit-profile-modal').style.display = 'none';
}

async function saveProfileChanges() {
    const token = localStorage.getItem('token');
    
    const req = {
        fullName: document.getElementById('edit-fullname').value.trim(),
        bio: document.getElementById('edit-bio').value.trim(),
        relationshipStatus: document.getElementById('edit-relationship').value,
        phoneNumber: document.getElementById('edit-phone').value.trim(),
        dateOfBirth: document.getElementById('edit-dob').value,
        gender: document.getElementById('edit-gender').value
    };
    
    try {
        const res = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req)
        });
        
        if (res.ok) {
            alert('Cập nhật thông tin thành công!');
            location.reload();
        } else {
            const err = await res.text();
            alert('Lỗi cập nhật: ' + err);
        }
    } catch(e) {
        console.error(e);
        alert('Đã xảy ra lỗi!');
    }
}

let cropper;
let currentCropType = null;
let currentCropFile = null;

function uploadImage(type, ev) {
    const file = ev.target.files[0];
    if(!file) return;
    
    currentCropType = type;
    currentCropFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('cropper-image').src = e.target.result;
        document.getElementById('cropper-modal').style.display = 'flex';
        document.getElementById('cropper-title').textContent = type === 'cover' ? "Căn chỉnh ảnh bìa" : "Căn chỉnh ảnh đại diện";
        
        if (cropper) {
            cropper.destroy();
        }
        
        const aspectRatio = type === 'cover' ? 1095 / 350 : 1;
        
        cropper = new Cropper(document.getElementById('cropper-image'), {
            aspectRatio: aspectRatio,
            viewMode: 1, // Restrict the crop box to not exceed the size of the canvas
            autoCropArea: 1,
            dragMode: 'move', // Allow moving the image itself
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: false, // For cover photo style, we move the image inside the box usually, but viewMode 1 handles it
            cropBoxResizable: false, // Fix the aspect ratio strictly
        });
    };
    reader.readAsDataURL(file);
    ev.target.value = ''; // Reset input to allow re-uploading the same file
}

function closeCropperModal() {
    document.getElementById('cropper-modal').style.display = 'none';
    if(cropper) {
        cropper.destroy();
        cropper = null;
    }
    currentCropType = null;
    currentCropFile = null;
}

async function saveCroppedImage() {
    if(!cropper || !currentCropType) return;
    
    const btn = document.getElementById('cropper-btn-save');
    const originalText = btn.textContent;
    btn.textContent = "Đang xử lý...";
    btn.disabled = true;

    // Get the cropped image data
    cropper.getCroppedCanvas({
        fillColor: '#fff',
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
    }).toBlob(async (blob) => {
        if (!blob) {
            alert('Có lỗi xảy ra khi cắt ảnh');
            btn.textContent = originalText;
            btn.disabled = false;
            return;
        }

        const formData = new FormData();
        // Give it the original file's name and append timestamp
        const ext = currentCropFile.name.split('.').pop();
        formData.append('file', blob, `cropped-${Date.now()}.${ext}`);
        
        try {
            const token = localStorage.getItem('token');
            const uploadRes = await fetch('/api/upload/image', {
                method: 'POST',
                headers: {'Authorization': `Bearer ${token}`},
                body: formData
            });
            
            if(!uploadRes.ok) {
                const text = await uploadRes.text(); alert('Lỗi khi tải ảnh lên: ' + text);
                return;
            }
            
            const uploadData = await uploadRes.json();
            const imageUrl = uploadData.imageUrl;
            
            // Update user profile
            const updateRes = await fetch(`/api/users/profile/${currentCropType}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ [currentCropType]: imageUrl })
            });
            
            if (updateRes.ok) {
                closeCropperModal();
                location.reload();
            } else {
                alert(`Lỗi cập nhật ${currentCropType}`);
            }
        } catch(e) {
            console.error(e);
            alert('Đã xảy ra lỗi tải ảnh.');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
}

window.uploadImage = uploadImage;
window.closeCropperModal = closeCropperModal;
window.saveCroppedImage = saveCroppedImage;

// Alias cho post-creation.js
window.fetchPosts = function() {
    fetchMyPosts();
};

// Hàm thêm bài viết mới vào đầu feed (để post-creation.js gọi)
window.prependCreatedPostToFeed = function(post) {
    const container = document.getElementById('profile-posts-container');
    if (!container || !post) return false;

    // Chỉ hiển thị bài mới nếu đang ở trang cá nhân của CHÍNH MÌNH 
    // Hoặc nếu không có targetUserId (nghĩa là trang của mình)
    if (targetUserId && targetUserId !== currentUserId) {
        // Đang xem profile người khác, không nên tự chèn bài mình vừa đăng vào đây 
        // trừ khi logic app cho phép. Thông thường là không.
        return false; 
    }

    // Nếu đang có thông báo "Đang tải" hoặc "Chưa có bài viết", xóa đi
    if (container.innerHTML.includes('Chưa có bài viết') || container.innerHTML.includes('Đang tải')) {
        container.innerHTML = '';
    }

    let visibilityIcon = '';
    if (post.visibility === 'PUBLIC') visibilityIcon = '<i class="fa-solid fa-earth-americas" style="margin-left: 5px; font-size: 11px;"></i>';
    else if (post.visibility === 'FRIENDS') visibilityIcon = '<i class="fa-solid fa-user-group" style="margin-left: 5px; font-size: 10px;"></i>';
    else visibilityIcon = '<i class="fa-solid fa-lock" style="margin-left: 5px; font-size: 11px;"></i>';
    
    const isMine = true; // Bài mới tạo chắc chắn là của mình

    let authorAvatar = post.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName)}&background=00d1b2&color=fff`;
    let postHtml = `
    <article class="card post" id="post-${post.id}">
        <div class="post-header">
            <img src="${authorAvatar}" alt="Avatar" class="avatar-medium" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName)}&background=00d1b2&color=fff'">
            <div class="post-meta">
                <h4 class="post-author"><a href="/html/profile.html" style="text-decoration:none; color:inherit;">${post.authorName}</a></h4>
                <span class="post-time">Vừa xong <span id="visibility-icon-${post.id}">${visibilityIcon}</span></span>
            </div>
        </div>
        
        <div class="post-options">
            <button class="options-btn" onclick="toggleDropdown(${post.id})">
                <i class="fa-solid fa-ellipsis"></i>
            </button>
            <div id="dropdown-${post.id}" class="dropdown-content">
                <a href="javascript:void(0)" onclick="changeVisibility(${post.id}, 'PUBLIC')"><i class="fa-solid fa-earth-americas"></i> Công khai</a>
                <a href="javascript:void(0)" onclick="changeVisibility(${post.id}, 'FRIENDS')"><i class="fa-solid fa-user-group"></i> Chỉ bạn bè</a>
                <a href="javascript:void(0)" onclick="changeVisibility(${post.id}, 'PRIVATE')"><i class="fa-solid fa-lock"></i> Chỉ mình tôi</a>
                <div style="height: 1px; background: #e4e6eb; margin: 4px 0;"></div>
                <a href="javascript:void(0)" onclick="deletePost(${post.id})" style="color: var(--red-icon);"><i class="fa-regular fa-trash-can"></i> Xóa bài viết</a>
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

    if (post.videoUrl) {
        postHtml += `
        <div class="post-video-placeholder text-center">
            <video src="${post.videoUrl}" style="max-width: 100%; border-radius: 8px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto; background: #000; max-height: 400px;" controls></video>
        </div>
        `;
    }

    postHtml += `
        <div class="post-actions-bar">
            <button id="like-btn-${post.id}" class="interaction-btn" onclick="toggleLike(${post.id})">
                <i id="like-icon-${post.id}" class="fa-regular fa-heart"></i> <span id="like-count-${post.id}">Mọi người (0)</span>
            </button>
            <button class="interaction-btn" onclick="toggleComments(${post.id})">
                <i class="fa-regular fa-comment"></i> <span id="comment-count-${post.id}">Bình luận (0)</span>
            </button>
            <button class="interaction-btn"><i class="fa-regular fa-share-from-square"></i> Chia sẻ</button>
        </div>
        <div id="comments-${post.id}" class="comments-section" style="display: none; padding: 15px; border-top: 1px solid #ced0d4;">
            <div class="comment-input-wrapper" style="display: flex; gap: 10px; margin-bottom: 15px;">
                <img src="${document.getElementById('header-avatar') ? document.getElementById('header-avatar').src : 'https://ui-avatars.com/api/?name=User&background=00d1b2&color=fff'}" alt="Avatar" class="avatar-small" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=User&background=00d1b2&color=fff'">
                <input type="text" id="comment-input-${post.id}" class="post-input" placeholder="Viết bình luận..." onkeypress="handleCommentKeyPress(event, ${post.id})">
                <button class="btn btn-primary" onclick="submitComment(${post.id})"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
            <div id="comment-list-${post.id}" class="comment-list"></div>
        </div>
    </article>
    `;

    container.insertAdjacentHTML('afterbegin', postHtml);
    return true;
};
