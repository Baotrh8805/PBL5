// Base API URL
const API_URL = '/api/v1/auth'; // Update with proper prefix if needed

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

// Check authentication
window.onload = () => {
    const token = localStorage.getItem('token');
    if (!token) {
        // Redirect to login if no token 
        // alert('Vui lòng đăng nhập để tiếp tục!');
        window.location.href = '/';
        return;
    }
    
    // Fetch user profile info here
    fetchUserProfile(token);
    // Fetch feed posts
    fetchPosts(token);
};

// Logout Function
window.logout = function() {
    localStorage.removeItem('token');
    window.location.href = '/';
};

// Fetch User Profile
async function fetchUserProfile(token) {
    try {
        // Changed from /api/v1/users/profile to /api/users/profile
        const res = await fetch('/api/users/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (res.ok) {
            const data = await res.json();
            
            // Redirect MODERATOR out of home feed
            if (data.role === 'MODERATOR') {
                window.location.href = '/html/moderator.html';
                return;
            } else if (data.role === 'ADMIN') {
                window.location.href = '/html/admin.html';
                return;
            }
            
            // Cập nhật tên của tài khoản đăng nhập trên màn hình (sidebar)
            document.querySelectorAll('.user-name').forEach(el => {
                el.textContent = data.fullName || 'Người dùng';
            });
            
            // Cập nhật avatar (nếu có custom url, hiện tại tạm xài chữ cái đầu)
            let avatarUrl = data.avatar;
            if (!avatarUrl && data.fullName) {
                avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.fullName)}&background=00d1b2&color=fff`;
            }

            document.querySelectorAll('#header-avatar, .avatar-large, .avatar-small, #modal-avatar').forEach(img => {
                img.src = avatarUrl;
            });
            document.querySelectorAll('.modal-user-name').forEach(el => {
                el.textContent = data.fullName || 'Người dùng';
            });
            document.getElementById('modal-post-content').placeholder = `${data.fullName || 'Người dùng'} ơi, bạn đang nghĩ gì thế?`;
            
            // Hiện nút Admin/Moderator trong sidebar nếu có quyền
            if (data.role === 'ADMIN' || data.role === 'MODERATOR') {
                const sidebarNav = document.querySelector('.sidebar-nav');
                if (sidebarNav && !document.getElementById('admin-menu-item')) {
                    const adminLink = document.createElement('a');
                    adminLink.id = 'admin-menu-item';
                    adminLink.href = '/html/admin.html';
                    adminLink.className = 'menu-item admin-menu-item';
                    adminLink.innerHTML = data.role === 'ADMIN'
                        ? '<i class="fa-solid fa-shield-halved"></i> Quản trị hệ thống'
                        : '<i class="fa-solid fa-user-shield"></i> Kiểm duyệt';
                    // Chèn trước nút Đăng xuất
                    const logoutItem = sidebarNav.querySelector('[onclick="logout()"]');
                    sidebarNav.insertBefore(adminLink, logoutItem);
                }
            }

            // Xử lý Onboarding (Cách 1: Ép cập nhật thông tin nếu thiếu Số đt hoặc Ngày sinh)
            if (!data.phoneNumber || !data.dateOfBirth) {
                showOnboardingModal(data);
            }

        } else {
             // Handle token expired/invalid
             // localStorage.removeItem('token');
             // window.location.href = '/';
        }
    } catch (err) {
        console.error("Error fetching profile", err);
    }
    
}

// ---- Onboarding Logic ----
function showOnboardingModal(user) {
    const modal = document.getElementById('onboarding-modal');
    modal.style.display = 'flex';
    if (user && user.fullName) {
        document.getElementById('onboard-fullname').value = user.fullName;
    }
}

async function submitOnboarding() {
    const fullName = document.getElementById('onboard-fullname').value.trim();
    const phone = document.getElementById('onboard-phone').value.trim();
    const dob = document.getElementById('onboard-dob').value;
    
    const genderNode = document.querySelector('input[name="onboard-gender"]:checked');
    const gender = genderNode ? genderNode.value : '';
    
    const errorMsg = document.getElementById('onboard-error');

    if (!fullName) {
        errorMsg.textContent = 'Vui lòng nhập Tên hiển thị.';
        errorMsg.style.display = 'block';
        return;
    }

    if (!phone || !dob || !gender) {
        errorMsg.textContent = 'Vui lòng điền đầy đủ thông tin (số điện thoại, ngày sinh và giới tính).';
        errorMsg.style.display = 'block';
        return;
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
        errorMsg.textContent = 'Số điện thoại phải bao gồm đúng 10 chữ số.';
        errorMsg.style.display = 'block';
        return;
    }

    const dobYear = new Date(dob).getFullYear();
    if (dobYear > 2015) {
        errorMsg.textContent = 'Năm sinh phải chọn dưới năm 2016.';
        errorMsg.style.display = 'block';
        return;
    }

    const token = localStorage.getItem('token');
    const payload = {
        fullName: fullName,
        phoneNumber: phone,
        dateOfBirth: dob,
        gender: gender
    };

    try {
        const res = await fetch('/api/users/onboarding', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            document.getElementById('onboarding-modal').style.display = 'none';
        } else {
            const data = await res.json();
            errorMsg.textContent = data.message || 'Số điện thoại đã tồn tại hoặc có lỗi xảy ra.';
            errorMsg.style.display = 'block';
        }
    } catch (err) {
        errorMsg.textContent = 'Lỗi kết nối mạng.';
        errorMsg.style.display = 'block';
    }
}
// -------------------------

// ============ CÁC HÀM LIÊN QUAN ĐẾN ĐĂNG BÀI ĐÃ ĐƯỢC CHUYỂN SANG post-creation.js ============
// - openPostModal()
// - closePostModal()
// - checkModalPostContent()
// - previewModalMedia()
// - removeModalMedia()
// - updateModalVisibility()
// - submitModalPost()

async function fetchPosts(token) {
    const container = document.getElementById('posts-container');
    if (container) {
        container.innerHTML = '<div class="card" style="padding:16px; text-align:center; color:#65676B;">Đang tải bài đăng...</div>';
    }

    try {
        const res = await fetch('/api/posts', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const message = res.status === 401
                ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
                : 'Không thể tải bài đăng. Vui lòng thử lại.';
            if (container) {
                container.innerHTML = `<div class="card" style="padding:16px; text-align:center; color:#d93025;">${message}</div>`;
            }
            return;
        }

        const posts = await res.json();
        if (!Array.isArray(posts)) {
            throw new Error('Dữ liệu bài đăng không hợp lệ');
        }
        renderPosts(posts, token);
    } catch (err) {
        console.error('Error fetching posts:', err);
        if (container) {
            container.innerHTML = '<div class="card" style="padding:16px; text-align:center; color:#d93025;">Đã xảy ra lỗi khi tải bài đăng.</div>';
        }
    }
}

function prependCreatedPostToFeed(post) {
    const container = document.getElementById('posts-container');
    if (!container || !post || !post.id) {
        return false;
    }

    let visibilityIcon = '';
    if (post.visibility === 'PUBLIC') visibilityIcon = '<i class="fa-solid fa-earth-americas" style="margin-left: 5px; font-size: 11px;"></i>';
    else if (post.visibility === 'FRIENDS') visibilityIcon = '<i class="fa-solid fa-user-group" style="margin-left: 5px; font-size: 10px;"></i>';
    else visibilityIcon = '<i class="fa-solid fa-lock" style="margin-left: 5px; font-size: 11px;"></i>';
    const isMine = post.mine ?? post.isMine ?? false;

    let postHtml = `
        <article class="card post" id="post-${post.id}">
            <div class="post-header">
                <img src="${post.authorAvatar}" alt="Avatar" class="avatar-medium" onerror="this.src='/uploads/default-avatar.png'">
                <div class="post-meta">
                    <h4 class="post-author"><a href="/html/profile.html?userId=${post.authorId}" style="text-decoration:none; color:inherit;">${post.authorName}</a></h4>
                    <span class="post-time">Vừa xong ${visibilityIcon}</span>
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

    const likeIcon = post.likedByCurrentUser ? 'fa-solid text-red' : 'fa-regular';
    const likeStyle = post.likedByCurrentUser ? 'color: var(--red-icon);' : '';

    postHtml += `
            <div class="post-actions-bar">
                <button class="interaction-btn" onclick="toggleLike(${post.id})" style="${likeStyle}">
                    <i class="${likeIcon} fa-heart"></i> Mọi người (${post.likeCount || 0})
                </button>
                <button class="interaction-btn" onclick="toggleComments(${post.id})">
                    <i class="fa-regular fa-comment"></i> Bình luận (${post.commentCount || 0})
                </button>
                <button class="interaction-btn"><i class="fa-regular fa-share-from-square"></i> Chia sẻ</button>
            </div>

            <div id="comments-${post.id}" class="comments-section" style="display: none; padding: 15px; border-top: 1px solid #ced0d4;">
                <div class="comment-input-wrapper" style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <img src="${document.getElementById('header-avatar') && document.getElementById('header-avatar').src ? document.getElementById('header-avatar').src : '/uploads/default-avatar.png'}" class="avatar-small" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.src='/uploads/default-avatar.png'">
                    <input type="text" id="comment-input-${post.id}" class="post-input" placeholder="Viết bình luận..." onkeypress="handleCommentKeyPress(event, ${post.id})">
                    <button class="btn btn-primary" onclick="submitComment(${post.id})"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
                <div id="comment-list-${post.id}" class="comment-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
            </div>
        </article>
    `;

    container.insertAdjacentHTML('afterbegin', postHtml);
    return true;
}

function timeSince(dateString) {
    const postDate = new Date(dateString);
    if (Number.isNaN(postDate.getTime())) {
        return 'Vừa xong';
    }
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

function renderPosts(posts, token) {
    const container = document.getElementById('posts-container');
    container.innerHTML = ''; // Clear cũ

    posts.forEach(post => {
        
        let visibilityIcon = '';
        if (post.visibility === 'PUBLIC') visibilityIcon = '<i class="fa-solid fa-earth-americas" style="margin-left: 5px; font-size: 11px;"></i>';
        else if (post.visibility === 'FRIENDS') visibilityIcon = '<i class="fa-solid fa-user-group" style="margin-left: 5px; font-size: 10px;"></i>';
        else visibilityIcon = '<i class="fa-solid fa-lock" style="margin-left: 5px; font-size: 11px;"></i>';
        const isMine = post.mine ?? post.isMine ?? false;

        let postHtml = `
        <article class="card post" id="post-${post.id}">
            <div class="post-header">
                <img src="${post.authorAvatar}" alt="Avatar" class="avatar-medium" onerror="this.src='/uploads/default-avatar.png'">
                <div class="post-meta">
                    <h4 class="post-author"><a href="/html/profile.html?userId=${post.authorId}" style="text-decoration:none; color:inherit;">${post.authorName}</a></h4>
                    <span class="post-time">${timeSince(post.createdAt)} ${visibilityIcon}</span>
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

        // Tính tương tác (Like, Comment icon style active nếu true)
        const likeIcon = post.likedByCurrentUser ? 'fa-solid text-red' : 'fa-regular';
        const likeStyle = post.likedByCurrentUser ? 'color: var(--red-icon);' : '';

        postHtml += `
            <div class="post-actions-bar">
                <button class="interaction-btn" onclick="toggleLike(${post.id})" style="${likeStyle}">
                    <i class="${likeIcon} fa-heart"></i> Mọi người (${post.likeCount})
                </button>
                <button class="interaction-btn" onclick="toggleComments(${post.id})">
                    <i class="fa-regular fa-comment"></i> Bình luận (${post.commentCount})
                </button>
                <button class="interaction-btn"><i class="fa-regular fa-share-from-square"></i> Chia sẻ</button>
            </div>

            <!-- COMMENT SECTION -->
            <div id="comments-${post.id}" class="comments-section" style="display: none; padding: 15px; border-top: 1px solid #ced0d4;">
                <div class="comment-input-wrapper" style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <img src="${document.getElementById('header-avatar') && document.getElementById('header-avatar').src ? document.getElementById('header-avatar').src : '/uploads/default-avatar.png'}" class="avatar-small" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.src='/uploads/default-avatar.png'">
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
         .replace(/\n/g, "<br>"); // Xuống dòng
}

async function toggleLike(postId) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            fetchPosts(token); // Load lại để update số like
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

// ===== API GỌI XÓA VÀ CHỈNH SỬA POST =====
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
    try {
        // level: PUBLIC, FRIENDS, PRIVATE
        const res = await fetch(`/api/posts/${postId}/visibility?level=${level}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            fetchPosts(token); // Load lại ds bài viết để hiện chế độ mới
        } else {
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
        
        if(comments.length === 0) {
            listDiv.innerHTML = '<span style="color: #65676b; font-size: 13px;">Chưa có bình luận nào. Hãy là người đầu tiên!</span>';
            return;
        }

        comments.forEach(c => {
            const timeStr = timeSince(c.createdAt);
            listDiv.innerHTML += `
                <div class="comment" style="display: flex; gap: 8px; margin-bottom: 10px;">
                    <img src="${c.authorAvatar || '/uploads/default-avatar.png'}" class="avatar-small" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.src='/uploads/default-avatar.png'">
                    <div class="comment-bubble" style="background: #f0f2f5; padding: 8px 12px; border-radius: 18px; max-width: 80%;">
                        <strong style="font-size: 13px;"><a href="/html/profile.html?userId=${c.authorId}" style="text-decoration:none; color:inherit;">${c.authorName}</a></strong>
                        <div style="font-size: 14px; margin-top: 2px; white-space: pre-wrap;">${escapeHtml(c.content || '')}</div>
                    </div>
                </div>
                <div style="font-size: 11px; color: #65676b; margin-left: 45px; margin-top: -15px; margin-bottom: 10px;">${timeStr}</div>
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
            fetchComments(postId);
            fetchPosts(token); // Reload để udpate số lượng bình luận
        } else {
            alert('Lỗi gửi bình luận');
        }
    } catch (err) {
        console.error(err);
    }
}
