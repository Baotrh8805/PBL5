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
    
    // First fetch current user logic to populate header and compare IDs
    fetch('/api/users/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if (!res.ok) throw new Error('Token hết hạn');
        return res.json();
    })
    .then(currentUser => {
        currentUserId = currentUser.id;
        
        // Update header for current user
        const headerAvatar = document.getElementById('header-avatar');
        if (headerAvatar && currentUser.avatar) {
            headerAvatar.src = currentUser.avatar;
        }

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
    
    document.querySelectorAll('.modal-user-name').forEach(el => {
        el.textContent = user.fullName || 'Người dùng';
    });

    if (isCurrentUser) {
        // Setup placeholders
        const pcInput = document.getElementById('post-content-input');
        if (pcInput) pcInput.placeholder = `Bạn đang nghĩ gì?`;
        const modalPostContent = document.getElementById('modal-post-content');
        if (modalPostContent) {
            modalPostContent.placeholder = `${user.fullName} ơi, bạn đang nghĩ gì thế?`;
        }
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
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
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

        let postHtml = `
        <article class="card post" id="post-${post.id}">
            <div class="post-header">
                <img src="${post.authorAvatar || '/uploads/default-avatar.png'}" alt="Avatar" class="avatar-medium" onerror="this.src='/uploads/default-avatar.png'">
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
                <button class="interaction-btn" onclick="toggleComments(${post.id})">
                    <i class="fa-regular fa-comment"></i> Bình luận (${post.commentCount})
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
    try {
        const res = await fetch(`/api/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            fetchMyPosts(); // Load lại để update số like
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
    try {
        // level: PUBLIC, FRIENDS, PRIVATE
        const res = await fetch(`/api/posts/${postId}/visibility?level=${level}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            fetchMyPosts(); // Load lại ds bài viết để hiện chế độ mới
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
            fetchMyPosts(); // Refresh để udpate số lượng bình luận
        } else {
            alert('Lỗi gửi bình luận');
        }
    } catch (err) {
        console.error(err);
    }
}

let selectedImageFile = null;

// --- Modal Functions ---
function openPostModal() {
    document.getElementById('create-post-modal').style.display = 'flex';
    document.getElementById('modal-post-content').focus();
}

function closePostModal() {
    document.getElementById('create-post-modal').style.display = 'none';
}

function checkModalPostContent() {
    const text = document.getElementById('modal-post-content').value.trim();
    const btn = document.getElementById('modal-submit-btn');
    if (text.length > 0 || selectedImageFile) {
        btn.disabled = false;
        btn.classList.add('active');
    } else {
        btn.disabled = true;
        btn.classList.remove('active');
    }
}

function previewModalImage(event) {
    const file = event.target.files[0];
    if (file) {
        selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('modal-image-preview').src = e.target.result;
            document.getElementById('modal-image-preview-container').style.display = 'block';
            checkModalPostContent();
        };
        reader.readAsDataURL(file);
    }
}

function removeModalImage() {
    selectedImageFile = null;
    document.getElementById('modal-image-input').value = '';
    document.getElementById('modal-image-preview-container').style.display = 'none';
    document.getElementById('modal-image-preview').src = '';
    checkModalPostContent();
}

function updateModalVisibility(val) {
    const btn = document.querySelector('.modal-visibility-btn');
    let text = 'Cài đặt';
    let icon = 'fa-globe';
    if(val === 'PUBLIC') { text = 'Công khai'; icon = 'fa-earth-americas'; }
    if(val === 'FRIENDS') { text = 'Chỉ bạn bè'; icon = 'fa-user-group'; }
    if(val === 'PRIVATE') { text = 'Mình tôi'; icon = 'fa-lock'; }
    if (btn) {
        btn.innerHTML = `<i class="fa-solid ${icon}"></i> ${text} <i class="fa-solid fa-caret-down" style="font-size: 12px; margin-left: 4px;"></i>`;
    }
}

async function submitModalPost() {
    const token = localStorage.getItem('token');
    const content = document.getElementById('modal-post-content').value.trim();
    const visibilitySelect = document.getElementById('modal-post-visibility');
    let visibility = 'PUBLIC';
    if(visibilitySelect) visibility = visibilitySelect.value;
    
    if (!content && !selectedImageFile) {
        return;
    }

    const btn = document.getElementById('modal-submit-btn');
    btn.innerText = 'Đang đăng...';
    btn.disabled = true;

    let imageUrl = null;

    if (selectedImageFile) {
        const formData = new FormData();
        formData.append('file', selectedImageFile);
        try {
            const uploadRes = await fetch('/api/upload/image', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                headers: {'Authorization': `Bearer ${token}`},
            body: formData
            });
            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                imageUrl = uploadData.imageUrl;
            } else {
                alert("Lỗi upload ảnh.");
                btn.innerText = 'Đăng';
                btn.disabled = false;
                return;
            }
        } catch (error) {
            console.error(error);
            alert("Lỗi kết nối khi upload ảnh.");
            btn.innerText = 'Đăng';
            btn.disabled = false;
            return;
        }
    }

    const postData = {
        content: content,
        imageUrl: imageUrl,
        visibility: visibility
    };

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
        });

        if (res.ok) {
            document.getElementById('modal-post-content').value = '';
            removeModalImage();
            closePostModal();
            fetchMyPosts();
        } else {
            const errText = await res.text();
            alert("Lỗi đăng bài: " + errText);
        }
    } catch (error) {
        console.error(error);
    } finally {
        btn.innerText = 'Đăng';
        checkModalPostContent();
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

async function uploadImage(type, ev) {
    const file = ev.target.files[0];
    if(!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
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
        const updateRes = await fetch(`/api/users/profile/${type}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ [type]: imageUrl })
        });
        
        if (updateRes.ok) {
            location.reload();
        } else {
            alert(`Lỗi cập nhật ${type}`);
        }
    } catch(e) {
        console.error(e);
    }
}

window.uploadImage = uploadImage;
