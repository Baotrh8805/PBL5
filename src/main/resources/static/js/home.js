// Base API URL
const API_URL = '/api/v1/auth'; // Update with proper prefix if needed

let selectedCommentFiles = {}; // postId -> file
let selectedCommentMediaTypes = {}; // postId -> 'image' | 'video'

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
    // Fetch sidebar suggestions
    fetchSidebarSuggestions(token);
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
                const adminContainer = document.getElementById('admin-menu-container');
                if (adminContainer) {
                    adminContainer.innerHTML = `
                        <a href="/html/admin.html" id="admin-menu-item" class="menu-item admin-menu-item">
                            <i class="fa-solid ${data.role === 'ADMIN' ? 'fa-shield-halved' : 'fa-user-shield'}"></i>
                            <span>${data.role === 'ADMIN' ? 'Quản trị hệ thống' : 'Kiểm duyệt'}</span>
                        </a>
                    `;
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
    // We don't clear the skeleton here anymore because it's already in the HTML
    // container.innerHTML = '<div class="card" style="padding:16px; text-align:center; color:#65676B;">Đang tải bài đăng...</div>';

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
                    <span class="post-time"><a href="/html/post.html?id=${post.id}" style="text-decoration:none; color:inherit;">Vừa xong</a> <span id="visibility-icon-${post.id}">${visibilityIcon}</span></span>
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
                    <i id="like-icon-${post.id}" class="${likeIcon} fa-heart"></i> <span id="like-count-${post.id}">Mọi người (${post.likeCount || 0})</span>
                </button>
                <button class="interaction-btn" onclick="toggleComments(${post.id})">
                    <i class="fa-regular fa-comment"></i> <span id="comment-count-${post.id}">Bình luận (${post.commentCount || 0})</span>
                </button>
                <button class="interaction-btn"><i class="fa-regular fa-share-from-square"></i> Chia sẻ</button>
                <button id="bookmark-btn-${post.id}" class="interaction-btn" onclick="toggleBookmark(${post.id})" style="margin-left: auto;"><i class="fa-regular fa-bookmark"></i></button>
            </div>

            <div id="comments-${post.id}" class="comments-section" style="display: none; padding: 15px; border-top: 1px solid #ced0d4;">
                <!-- Media Preview Area -->
                <div id="comment-media-preview-container-${post.id}" style="display: none; position: relative; margin-bottom: 10px; margin-left: 42px;">
                    <img id="comment-image-preview-${post.id}" src="" style="max-width: 200px; max-height: 150px; border-radius: 8px; object-fit: cover;">
                    <video id="comment-video-preview-${post.id}" src="" style="max-width: 200px; max-height: 150px; border-radius: 8px; object-fit: cover; display: none;" controls></video>
                    <button onclick="removeCommentMedia(${post.id})" style="position: absolute; top: -10px; left: 190px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10;">
                        <i class="fa-solid fa-xmark" style="font-size: 12px;"></i>
                    </button>
                </div>

                <div class="comment-input-wrapper" style="display: flex; gap: 10px; margin-bottom: 15px; align-items: center;">
                    <img src="${document.getElementById('header-avatar') && document.getElementById('header-avatar').src ? document.getElementById('header-avatar').src : '/uploads/default-avatar.png'}" class="avatar-small" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.src='/uploads/default-avatar.png'">
                    <div style="flex: 1; position: relative; display: flex; align-items: center; background: #f0f2f5; border-radius: 20px; padding: 0 12px;">
                        <input type="text" id="comment-input-${post.id}" class="post-input" placeholder="Viết bình luận..." 
                            onkeypress="handleCommentKeyPress(event, ${post.id})" 
                            style="flex: 1; background: transparent; border: none; padding: 8px 0; outline: none; font-size: 14px;">
                        
                        <label for="comment-media-input-${post.id}" style="cursor: pointer; margin-left: 8px; color: #65676b;" title="Thêm ảnh hoặc video">
                            <i class="fa-solid fa-camera"></i>
                        </label>
                        <input type="file" id="comment-media-input-${post.id}" accept="image/*,video/*" style="display: none;" onchange="previewCommentMedia(event, ${post.id})">
                    </div>
                    <button class="btn-send-comment" onclick="submitComment(${post.id})" style="background: none; border: none; color: var(--primary-color); cursor: pointer; font-size: 18px; display: flex; align-items: center;">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
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

    let allPostsHtml = '';
    posts.forEach(post => {
        
        let visibilityIcon = '';
        if (post.visibility === 'PUBLIC') visibilityIcon = '<i class="fa-solid fa-earth-americas" style="margin-left: 5px; font-size: 11px;"></i>';
        else if (post.visibility === 'FRIENDS') visibilityIcon = '<i class="fa-solid fa-user-group" style="margin-left: 5px; font-size: 10px;"></i>';
        else visibilityIcon = '<i class="fa-solid fa-lock" style="margin-left: 5px; font-size: 11px;"></i>';
        const isMine = post.mine ?? post.isMine ?? false;

        let postHtml = `
        <article class="card post" id="post-${post.id}">
            <div class="post-header">
                <img src="${post.authorAvatar}" alt="Avatar" class="avatar-medium" loading="lazy" onerror="this.src='/uploads/default-avatar.png'">
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
                    <img src="${post.imageUrl}" alt="Post image" loading="lazy" style="max-width: 100%; border-radius: 8px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;">
                </div>
            </a>
            `;
        }

        if (post.videoUrl) {
            postHtml += `
            <a href="/html/post.html?id=${post.id}" class="post-video-link">
                <div class="post-video-placeholder text-center">
                    <video src="${post.videoUrl}" loading="lazy" style="max-width: 100%; border-radius: 8px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto; background: #000; max-height: 400px;"></video>
                </div>
            </a>
            `;
        }

        // Tính tương tác (Like, Comment icon style active nếu true)
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
                <button id="bookmark-btn-${post.id}" class="interaction-btn" onclick="toggleBookmark(${post.id})" style="margin-left: auto; ${post.bookmarkedByCurrentUser ? 'color: var(--primary-color);' : ''}"><i class="${post.bookmarkedByCurrentUser ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i></button>
            </div>

            <!-- COMMENT SECTION -->
            <div id="comments-${post.id}" class="comments-section" style="display: none; padding: 15px; border-top: 1px solid #ced0d4;">
                <!-- Media Preview Area -->
                <div id="comment-media-preview-container-${post.id}" style="display: none; position: relative; margin-bottom: 10px; margin-left: 42px;">
                    <img id="comment-image-preview-${post.id}" src="" loading="lazy" style="max-width: 200px; max-height: 150px; border-radius: 8px; object-fit: cover;">
                    <video id="comment-video-preview-${post.id}" src="" style="max-width: 200px; max-height: 150px; border-radius: 8px; object-fit: cover; display: none;" controls></video>
                    <button onclick="removeCommentMedia(${post.id})" style="position: absolute; top: -10px; left: 190px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10;">
                        <i class="fa-solid fa-xmark" style="font-size: 12px;"></i>
                    </button>
                </div>

                <div class="comment-input-wrapper" style="display: flex; gap: 10px; margin-bottom: 15px; align-items: center;">
                    <img src="${document.getElementById('header-avatar') && document.getElementById('header-avatar').src ? document.getElementById('header-avatar').src : '/uploads/default-avatar.png'}" class="avatar-small" loading="lazy" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.src='/uploads/default-avatar.png'">
                    <div style="flex: 1; position: relative; display: flex; align-items: center; background: #f0f2f5; border-radius: 20px; padding: 0 12px;">
                        <input type="text" id="comment-input-${post.id}" class="post-input" placeholder="Viết bình luận..." 
                            onkeypress="handleCommentKeyPress(event, ${post.id})" 
                            style="flex: 1; background: transparent; border: none; padding: 8px 0; outline: none; font-size: 14px;">
                        
                        <label for="comment-media-input-${post.id}" style="cursor: pointer; margin-left: 8px; color: #65676b;" title="Thêm ảnh hoặc video">
                            <i class="fa-solid fa-camera"></i>
                        </label>
                        <input type="file" id="comment-media-input-${post.id}" accept="image/*,video/*" style="display: none;" onchange="previewCommentMedia(event, ${post.id})">
                    </div>
                    <button class="btn-send-comment" onclick="submitComment(${post.id})" style="background: none; border: none; color: var(--primary-color); cursor: pointer; font-size: 18px; display: flex; align-items: center;">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                </div>
                <div id="comment-list-${post.id}" class="comment-list" style="display: flex; flex-direction: column; gap: 10px;">
                    <!-- Nơi bình luận hiển thị -->
                </div>
            </div>
        </article>
        `;

        allPostsHtml += postHtml;
    });
    container.innerHTML = allPostsHtml;
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

// ======================= GLOBAL SEARCH =======================
let searchTimeout = null;

window.handleGlobalSearch = function(query) {
    const resultsContainer = document.getElementById('global-search-results');
    if (!query || query.trim() === '') {
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        const token = localStorage.getItem('token');
        try {
            // Fetch both users and posts in parallel
            const [usersRes, postsRes] = await Promise.all([
                fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`/api/posts/search?q=${encodeURIComponent(query)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            let users = [];
            let posts = [];

            if (usersRes.ok) users = await usersRes.json();
            if (postsRes.ok) posts = await postsRes.json();

            renderSearchResults(users, posts, query);
        } catch (err) {
            console.error("Lỗi tìm kiếm:", err);
        }
    }, 300);
};

function renderSearchResults(users, posts, query) {
    const resultsContainer = document.getElementById('global-search-results');
    
    if (users.length === 0 && posts.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 15px; text-align: center; color: #65676b; font-size: 14px;">Không tìm thấy kết quả phù hợp.</div>';
    } else {
        let html = '';

        // Users Section
        if (users.length > 0) {
            html += '<div class="search-section-header">Mọi người</div>';
            html += users.slice(0, 5).map(user => {
                const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=00d1b2&color=fff`;
                return `
                    <a href="/html/profile.html?userId=${user.id}" class="search-result-item">
                        <img src="${avatarUrl}" alt="Avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=00d1b2&color=fff'">
                        <div class="search-item-info">
                            <span class="user-name-result">${user.fullName}</span>
                            <span class="search-item-sub">Người dùng</span>
                        </div>
                    </a>
                `;
            }).join('');
        }

        // Posts Section
        if (posts.length > 0) {
            html += '<div class="search-section-header">Bài viết</div>';
            html += posts.slice(0, 5).map(post => {
                const contentSnippet = post.content ? (post.content.length > 60 ? post.content.substring(0, 60) + '...' : post.content) : 'Bài viết không có nội dung';
                return `
                    <a href="/html/post.html?id=${post.id}" class="search-result-item">
                        <div class="search-post-icon"><i class="fa-regular fa-file-lines"></i></div>
                        <div class="search-item-info">
                            <span class="user-name-result">${contentSnippet}</span>
                            <span class="search-item-sub">Bởi ${post.authorName}</span>
                        </div>
                    </a>
                `;
            }).join('');
        }
        
        resultsContainer.innerHTML = html;
    }
    resultsContainer.style.display = 'block';
}

// Ẩn menu khi click ra ngoài
window.addEventListener('click', function(event) {
    // Dropdown posts logic
    if (!event.target.closest('.options-btn')) {
        var dropdowns = document.getElementsByClassName("dropdown-content");
        for (var i = 0; i < dropdowns.length; i++) {
            var openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }

    // Global search results logic
    const searchContainer = document.querySelector('.search-bar');
    const resultsContainer = document.getElementById('global-search-results');
    if (searchContainer && resultsContainer && !searchContainer.contains(event.target)) {
        resultsContainer.style.display = 'none';
    }
});

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

async function hidePost(postId) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/posts/${postId}/hide`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            document.getElementById('post-' + postId).style.display = 'none';
            showToast('Đã ẩn bài viết vĩnh viễn.', 'info');
        }
    } catch (err) {
        console.error(err);
    }
}

let activeReportPostId = null;

function reportPost(postId) {
    activeReportPostId = postId;
    document.getElementById('report-modal').style.display = 'flex';
    document.getElementById('report-reason').value = '';
    
    // Bind confirm button
    const confirmBtn = document.getElementById('confirm-report-btn');
    confirmBtn.onclick = () => submitReport();
}

function closeReportModal() {
    document.getElementById('report-modal').style.display = 'none';
    activeReportPostId = null;
}

async function submitReport() {
    const reason = document.getElementById('report-reason').value.trim();
    if (!reason) {
        showToast('Vui lòng nhập lý do báo cáo.', 'error');
        return;
    }

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/posts/${activeReportPostId}/report`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ reason: reason })
        });

        if (res.ok) {
            document.getElementById('post-' + activeReportPostId).style.display = 'none';
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

async function toggleBookmark(postId) {
    const token = localStorage.getItem('token');
    const btn = document.getElementById(`bookmark-btn-${postId}`);
    if (!btn) return;

    const icon = btn.querySelector('i');
    const isBookmarked = icon.classList.contains('fa-solid');

    // Optimistic UI
    if (isBookmarked) {
        icon.classList.remove('fa-solid');
        icon.classList.add('fa-regular');
        btn.style.color = '';
    } else {
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid');
        btn.style.color = 'var(--primary-color)';
    }

    try {
        const res = await fetch(`/api/posts/${postId}/bookmark`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            showToast(data.message, 'success');
        }
    } catch (err) {
        console.error('Bookmark error:', err);
    }
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

window.previewCommentMedia = function(event, postId) {
    const file = event.target.files[0];
    if (file) {
        selectedCommentFiles[postId] = file;
        const fileName = (file.name || '').toLowerCase();
        const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/.test(fileName);
        selectedCommentMediaTypes[postId] = isVideo ? 'video' : 'image';
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgPreview = document.getElementById(`comment-image-preview-${postId}`);
            const videoPreview = document.getElementById(`comment-video-preview-${postId}`);
            const container = document.getElementById(`comment-media-preview-container-${postId}`);
            
            if (isVideo) {
                imgPreview.style.display = 'none';
                videoPreview.style.display = 'block';
                videoPreview.src = e.target.result;
            } else {
                imgPreview.style.display = 'block';
                videoPreview.style.display = 'none';
                imgPreview.src = e.target.result;
            }
            container.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
};

window.removeCommentMedia = function(postId) {
    delete selectedCommentFiles[postId];
    delete selectedCommentMediaTypes[postId];
    const input = document.getElementById(`comment-media-input-${postId}`);
    if (input) input.value = '';
    const container = document.getElementById(`comment-media-preview-container-${postId}`);
    if (container) container.style.display = 'none';
    const imgPreview = document.getElementById(`comment-image-preview-${postId}`);
    if (imgPreview) imgPreview.src = '';
    const videoPreview = document.getElementById(`comment-video-preview-${postId}`);
    if (videoPreview) videoPreview.src = '';
};

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

        listDiv.innerHTML = comments.map(c => renderCommentItem(c, postId)).join('');
    } catch (err) {
        console.error("Lỗi lấy comment:", err);
    }
}

function renderCommentItem(c, postId, isReply = false) {
    const timeStr = timeSince(c.createdAt);
    let mediaHtml = '';
    if (c.imageUrl) {
        mediaHtml = `<img src="${c.imageUrl}" style="max-width: 100%; border-radius: 8px; margin-top: 8px; display: block;">`;
    } else if (c.videoUrl) {
        mediaHtml = `<video src="${c.videoUrl}" controls style="max-width: 100%; border-radius: 8px; margin-top: 8px; display: block;"></video>`;
    }

    const createdAtDate = new Date(c.createdAt);
    const now = new Date();
    const diffMinutes = (now - createdAtDate) / (1000 * 60);
    
    let actionsHtml = `
        <div class="comment-actions" style="margin-left: ${isReply ? '35px' : '45px'}; font-size: 11px; display: flex; gap: 12px; margin-top: -8px; margin-bottom: 10px; align-items: center;">
            <span onclick="toggleCommentLike(${postId}, ${c.id})" id="comment-like-btn-${c.id}" style="color: ${c.liked ? 'var(--primary-color)' : '#65676b'}; cursor: pointer; font-weight: 600;">
                ${c.liked ? 'Đã thích' : 'Thích'} ${c.likeCount > 0 ? `(${c.likeCount})` : ''}
            </span>
            ${!isReply ? `<span onclick="showReplyInput(${postId}, ${c.id}, '${c.authorName}')" style="color: #65676b; cursor: pointer; font-weight: 600;">Phản hồi</span>` : ''}
            ${c.isMine && diffMinutes < 30 ? `<span onclick="startEditComment(${postId}, ${c.id}, '${c.content ? c.content.replace(/'/g, "\\'") : ''}')" style="color: #65676b; cursor: pointer; font-weight: 600;">Sửa</span>` : ''}
            ${c.isMine ? `<span onclick="deleteComment(${postId}, ${c.id})" style="color: #65676b; cursor: pointer; font-weight: 600;">Xóa</span>` : ''}
            <span style="color: #65676b; font-size: 11px;">${timeStr}</span>
        </div>
    `;

    let repliesHtml = '';
    if (c.replies && c.replies.length > 0) {
        repliesHtml = `<div class="replies-container" style="margin-left: 40px; border-left: 2px solid #e4e6eb; padding-left: 10px;">
            ${c.replies.map(r => renderCommentItem(r, postId, true)).join('')}
        </div>`;
    }

    return `
        <div class="comment-container" id="comment-container-${c.id}" style="margin-bottom: 5px;">
            <div class="comment" style="display: flex; gap: 8px; margin-bottom: 10px;">
                <img src="${c.authorAvatar || '/uploads/default-avatar.png'}" class="avatar-small" style="width: ${isReply ? '24px' : '32px'}; height: ${isReply ? '24px' : '32px'}; border-radius: 50%; object-fit: cover;" onerror="this.src='/uploads/default-avatar.png'">
                <div class="comment-bubble" style="background: #f0f2f5; padding: 6px 12px; border-radius: 18px; max-width: 85%; position: relative;">
                    <strong style="font-size: 13px;"><a href="/html/profile.html?userId=${c.authorId}" style="text-decoration:none; color:inherit;">${c.authorName}</a></strong>
                    <div id="comment-content-${c.id}" style="font-size: 14px; margin-top: 2px; white-space: pre-wrap;">${escapeHtml(c.content || '')}</div>
                    ${mediaHtml}
                </div>
            </div>
            ${actionsHtml}
            <div id="reply-input-container-${c.id}" style="margin-left: 45px; margin-bottom: 10px;"></div>
            ${repliesHtml}
        </div>
    `;
}

async function toggleCommentLike(postId, commentId) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/posts/comments/${commentId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            fetchComments(postId);
        }
    } catch (err) {
        console.error(err);
    }
}

function showReplyInput(postId, commentId, authorName) {
    const container = document.getElementById(`reply-input-container-${commentId}`);
    if (container.innerHTML !== '') {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: center; background: #f0f2f5; border-radius: 20px; padding: 4px 12px;">
            <input type="text" id="reply-field-${commentId}" placeholder="Trả lời ${authorName}..." 
                style="flex: 1; border: none; background: transparent; outline: none; padding: 6px 0; font-size: 13px;"
                onkeypress="if(event.key==='Enter') submitReply(${postId}, ${commentId})">
            <i class="fas fa-paper-plane" onclick="submitReply(${postId}, ${commentId})" style="color: var(--primary-color); cursor: pointer;"></i>
        </div>
    `;
    document.getElementById(`reply-field-${commentId}`).focus();
}

async function submitReply(postId, parentId) {
    const field = document.getElementById(`reply-field-${parentId}`);
    const content = field.value.trim();
    if (!content) return;

    const token = localStorage.getItem('token');
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
            fetchComments(postId);
        }
    } catch (err) {
        console.error(err);
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
    const token = localStorage.getItem('token');
    
    let imageUrl = null;
    let videoUrl = null;

    // Check if there's content or media
    if (!content && !selectedCommentFiles[postId]) return;

    try {
        // Upload media if exists
        if (selectedCommentFiles[postId]) {
            const file = selectedCommentFiles[postId];
            const type = selectedCommentMediaTypes[postId];
            const formData = new FormData();
            formData.append('file', file);
            
            const endpoint = type === 'video' ? '/api/upload/video' : '/api/upload/image';
            const uploadRes = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            
            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                if (type === 'video') videoUrl = uploadData.videoUrl || uploadData.url;
                else imageUrl = uploadData.imageUrl || uploadData.url;
            } else {
                alert('Lỗi upload media cho bình luận');
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
            removeCommentMedia(postId);
            
            // Optimistic UI update: cộng số bình luận (nếu chưa cộng)
            const commentCountSpan = document.getElementById(`comment-count-${postId}`);
            if (commentCountSpan) {
                const countMatch = commentCountSpan.innerText.match(/\d+/);
                let currentCount = countMatch ? parseInt(countMatch[0], 10) : 0;
                // Note: we don't increment here if we already did it optimistically elsewhere, 
                // but fetchComments will refresh anyway.
            }
            
            fetchComments(postId); 
        } else {
            alert('Lỗi gửi bình luận');
        }
    } catch (err) {
        console.error(err);
    }
}

// ======================= SIDEBAR SUGGESTIONS =======================
async function deleteComment(postId, commentId) {
    if (!confirm('Bạn có chắc chắn muốn xóa bình luận này?')) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/posts/comments/${commentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            // Optimistic UI update: giảm số bình luận
            const commentCountSpan = document.getElementById(`comment-count-${postId}`);
            if (commentCountSpan) {
                const countMatch = commentCountSpan.innerText.match(/\d+/);
                let currentCount = countMatch ? parseInt(countMatch[0], 10) : 0;
                if (currentCount > 0) {
                    commentCountSpan.innerText = `Bình luận (${currentCount - 1})`;
                }
            }
            fetchComments(postId);
        } else {
            const data = await res.json();
            alert(data.message || 'Lỗi khi xóa bình luận');
        }
    } catch (err) {
        console.error(err);
    }
}

window.startEditComment = function(postId, commentId, currentContent) {
    const contentDiv = document.getElementById(`comment-content-${commentId}`);
    const originalHtml = contentDiv.innerHTML;
    
    contentDiv.innerHTML = `
        <div style="margin-top: 5px;">
            <textarea id="edit-input-${commentId}" style="width: 100%; border: 1px solid #ced4da; border-radius: 8px; padding: 5px; outline: none; font-size: 14px; font-family: inherit;">${currentContent}</textarea>
            <div style="display: flex; gap: 5px; margin-top: 5px; justify-content: flex-end;">
                <button onclick="cancelEditComment(${commentId}, \`${originalHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)" style="background: #e4e6eb; border: none; padding: 3px 8px; border-radius: 5px; font-size: 12px; cursor: pointer;">Hủy</button>
                <button onclick="saveEditComment(${postId}, ${commentId})" style="background: var(--primary-color); color: white; border: none; padding: 3px 8px; border-radius: 5px; font-size: 12px; cursor: pointer;">Lưu</button>
            </div>
        </div>
    `;
};

window.cancelEditComment = function(commentId, originalHtml) {
    const contentDiv = document.getElementById(`comment-content-${commentId}`);
    contentDiv.innerHTML = originalHtml;
};

async function saveEditComment(postId, commentId) {
    const newContent = document.getElementById(`edit-input-${commentId}`).value.trim();
    if (!newContent) return;

    const token = localStorage.getItem('token');
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
            fetchComments(postId);
        } else {
            const data = await res.json();
            alert(data.message || 'Lỗi khi cập nhật bình luận');
        }
    } catch (err) {
        console.error(err);
    }
}

async function fetchSidebarSuggestions(token) {
    const container = document.getElementById('sidebar-suggestions');
    if (!container) return;

    try {
        const res = await fetch('/api/friends/suggestions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const suggestions = await res.json();
            renderSidebarSuggestions(suggestions.slice(0, 5)); // Show top 5
        }
    } catch (err) {
        console.error("Lỗi lấy gợi ý sidebar:", err);
    }
}

function renderSidebarSuggestions(users) {
    const container = document.getElementById('sidebar-suggestions');
    if (!container) return;
    
    if (users.length === 0) {
        container.innerHTML = '<div class="empty-state">Không có gợi ý mới</div>';
        return;
    }

    container.innerHTML = users.map(user => {
        const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=00d1b2&color=fff`;
        return `
            <div class="suggestion-item" id="suggestion-item-${user.id}">
                <img src="${avatarUrl}" alt="Avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=00d1b2&color=fff'">
                <div class="suggestion-info">
                    <a href="/html/profile.html?userId=${user.id}" class="suggestion-name">${user.fullName}</a>
                    <span class="suggestion-mutual">Gợi ý cho bạn</span>
                </div>
                <button class="add-friend-sidebar-btn" onclick="addFriendFromSidebar(${user.id})">Thêm</button>
            </div>
        `;
    }).join('');
}

window.addFriendFromSidebar = async function(userId) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/friends/request/${userId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const item = document.getElementById(`suggestion-item-${userId}`);
            if (item) {
                const btn = item.querySelector('button');
                btn.innerText = 'Hủy';
                btn.classList.add('cancel-btn');
                btn.onclick = () => cancelRequestFromSidebar(userId);
            }
        }
    } catch (err) {
        console.error("Lỗi gửi lời mời kết bạn:", err);
    }
};

window.cancelRequestFromSidebar = async function(userId) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/friends/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const item = document.getElementById(`suggestion-item-${userId}`);
            if (item) {
                const btn = item.querySelector('button');
                btn.innerText = 'Thêm';
                btn.classList.remove('cancel-btn');
                btn.onclick = () => addFriendFromSidebar(userId);
            }
        }
    } catch (err) {
        console.error("Lỗi hủy lời mời:", err);
    }
};
