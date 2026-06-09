/**
 * post-creation.js - Logic xử lý tạo bài đăng mới
 * Chứa logic phức tạp với kiểm tra AI nội dung
 */

let selectedMediaFile = null;
let selectedMediaType = null; // 'image' or 'video'

function showPostNotification(message, isError = false) {
    // Nếu là lỗi cấm (chứa chữ "vui lòng quay lại"), chúng ta dùng modal lớn
    if (isError && (message.includes("cấm đăng bài") || message.includes("cấm bình luận"))) {
        showBanModal(message);
        return;
    }
    
    let notification = document.getElementById('post-notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'post-notification';
        notification.style.position = 'fixed';
        notification.style.left = '50%';
        notification.style.bottom = '24px';
        notification.style.transform = 'translateX(-50%)';
        notification.style.zIndex = '3000';
        notification.style.padding = '12px 16px';
        notification.style.borderRadius = '10px';
        notification.style.boxShadow = '0 10px 30px rgba(0,0,0,0.18)';
        notification.style.fontSize = '14px';
        notification.style.fontWeight = '600';
        notification.style.maxWidth = 'min(92vw, 420px)';
        notification.style.textAlign = 'center';
        document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.style.background = isError ? '#ffe8e8' : '#e7f7ef';
    notification.style.color = isError ? '#b42318' : '#146c43';
    notification.style.border = isError ? '1px solid #ffb3b3' : '1px solid #a6e3bd';
    notification.style.display = 'block';

    clearTimeout(window.__postNotificationTimer);
    window.__postNotificationTimer = setTimeout(() => {
        notification.style.display = 'none';
    }, 3200);
}

function showBanModal(message) {
    // Xóa modal cũ nếu có
    const oldModal = document.getElementById('ban-alert-modal');
    if (oldModal) oldModal.remove();

    const modalHtml = `
        <div id="ban-alert-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 10000; animation: modalFadeIn 0.3s ease-out;">
            <div style="background: #ffffff; border-radius: 20px; width: 480px; max-width: 92vw; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); position: relative; animation: modalSlideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                <!-- Nút X đóng modal -->
                <button onclick="document.getElementById('ban-alert-modal').remove()" style="position: absolute; top: 15px; right: 15px; background: #f0f2f5; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; color: #1c1e21; font-size: 22px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10;">&times;</button>
                
                <div style="padding: 45px 35px; text-align: center;">
                    <div style="background: #fff0f0; width: 90px; height: 90px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 30px; box-shadow: 0 10px 20px rgba(228, 30, 63, 0.1);">
                        <i class="fa-solid fa-user-slash" style="font-size: 40px; color: #e41e3f;"></i>
                    </div>
                    
                    <h2 style="margin: 0 0 15px 0; font-size: 26px; color: #1c1e21; font-weight: 800; letter-spacing: -0.5px;">Thông báo vi phạm</h2>
                    
                    <div style="background: #fff5f5; padding: 25px; border-radius: 15px; margin-bottom: 30px; border: 1px solid #ffebeb; position: relative;">
                        <p style="margin: 0; font-size: 17px; color: #333; line-height: 1.6; font-weight: 500;">
                            ${message}
                        </p>
                    </div>
                    
                    <button onclick="document.getElementById('ban-alert-modal').remove()" style="background: linear-gradient(135deg, #e41e3f 0%, #c11732 100%); color: #fff; border: none; width: 100%; padding: 15px; border-radius: 12px; font-size: 17px; font-weight: 700; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 8px 20px rgba(228, 30, 63, 0.3);">
                        Tôi đã hiểu và cam kết tuân thủ
                    </button>
                </div>
            </div>
            <style>
                @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes modalSlideUp { from { transform: translateY(40px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
                #ban-alert-modal button:active { transform: scale(0.98); }
            </style>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function parseErrorMessage(errorData, fallbackMessage) {
    if (!errorData) return fallbackMessage;
    if (typeof errorData === 'string') return errorData;
    if (typeof errorData.message === 'string' && errorData.message.trim().length > 0) {
        return errorData.message;
    }
    if (typeof errorData.error === 'string' && errorData.error.trim().length > 0) {
        return errorData.error;
    }
    return fallbackMessage;
}

/**
 * Mở modal tạo bài đăng
 */
function openPostModal() {
    // Reset visibility to PUBLIC by default to match visual state
    const visibilitySelect = document.getElementById('modal-post-visibility');
    if (visibilitySelect) {
        visibilitySelect.value = 'PUBLIC';
        updateModalVisibility('PUBLIC');
    }
    document.getElementById('create-post-modal').style.display = 'flex';
    document.getElementById('modal-post-content').focus();
}

/**
 * Đóng modal tạo bài đăng
 */
function closePostModal() {
    document.getElementById('create-post-modal').style.display = 'none';
}

/**
 * Kiểm tra nội dung bài đăng và cập nhật trạng thái nút gửi
 */
function checkModalPostContent() {
    const text = document.getElementById('modal-post-content').value.trim();
    const btn = document.getElementById('modal-submit-btn');
    if (text.length > 0 || selectedMediaFile) {
        btn.disabled = false;
        btn.classList.add('active');
    } else {
        btn.disabled = true;
        btn.classList.remove('active');
    }
}

/**
 * Xem trước media (ảnh/video) được chọn
 */
function previewModalMedia(event) {
    const file = event.target.files[0];
    if (file) {
        selectedMediaFile = file;
        const fileName = (file.name || '').toLowerCase();
        const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/.test(fileName);
        selectedMediaType = isVideo ? 'video' : 'image';
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgPreview = document.getElementById('modal-image-preview');
            const videoPreview = document.getElementById('modal-video-preview');
            const container = document.getElementById('modal-image-preview-container');
            
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
            checkModalPostContent();
        };
        reader.readAsDataURL(file);
    }
}

/**
 * Xóa media được chọn
 */
function removeModalMedia() {
    selectedMediaFile = null;
    selectedMediaType = null;
    document.getElementById('modal-image-input').value = '';
    document.getElementById('modal-image-preview-container').style.display = 'none';
    document.getElementById('modal-image-preview').src = '';
    document.getElementById('modal-video-preview').src = '';
    checkModalPostContent();
}

/**
 * Cập nhật nút hiển thị visibility
 */
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

/**
 * Gửi bài đăng mới với kiểm tra nội dung AI
 */
async function submitModalPost() {
    const token = localStorage.getItem('token');
    const content = document.getElementById('modal-post-content').value.trim();
    const visibilitySelect = document.getElementById('modal-post-visibility');
    let visibility = 'PUBLIC';
    if(visibilitySelect) visibility = visibilitySelect.value;
    
    if (!content && !selectedMediaFile) {
        return;
    }

    const btn = document.getElementById('modal-submit-btn');
    btn.innerText = 'Đang đăng...';
    btn.disabled = true;

    let imageUrl = null;
    let videoUrl = null;

    // Upload media nếu có
    if (selectedMediaFile) {
        const formData = new FormData();
        formData.append('file', selectedMediaFile);
        
        try {
            const endpoint = selectedMediaType === 'video' ? '/api/upload/video' : '/api/upload/image';
            const uploadRes = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                if (selectedMediaType === 'video') {
                    videoUrl = uploadData.videoUrl || uploadData.url || uploadData.secure_url || uploadData.secureUrl || null;
                } else {
                    imageUrl = uploadData.imageUrl || uploadData.url || uploadData.secure_url || uploadData.secureUrl || null;
                }

                if (selectedMediaType === 'video' && !videoUrl) {
                    showPostNotification('Upload video thành công nhưng không nhận được URL video.', true);
                    btn.innerText = 'Đăng';
                    btn.disabled = false;
                    return;
                }

                if (selectedMediaType === 'image' && !imageUrl) {
                    showPostNotification('Upload ảnh thành công nhưng không nhận được URL ảnh.', true);
                    btn.innerText = 'Đăng';
                    btn.disabled = false;
                    return;
                }
            } else {
                const mediaType = selectedMediaType === 'video' ? 'video' : 'ảnh';
                showPostNotification("Lỗi upload " + mediaType + ".", true);
                btn.innerText = 'Đăng';
                btn.disabled = false;
                return;
            }
        } catch (error) {
            console.error(error);
            const mediaType = selectedMediaType === 'video' ? 'video' : 'ảnh';
            showPostNotification("Lỗi kết nối khi upload " + mediaType + ".", true);
            btn.innerText = 'Đăng';
            btn.disabled = false;
            return;
        }
    }

    // Chuẩn bị dữ liệu bài đăng
    const postData = {
        content: content,
        imageUrl: imageUrl,
        videoUrl: videoUrl,
        visibility: visibility
    };

    try {
        btn.innerText = 'Đang đăng...';
        
        // Gửi bài đăng đến endpoint tạo bài đăng mới (có kiểm tra AI)
        const res = await fetch('/api/posts/create', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
        });

        if (res.ok) {
            const createdPost = await res.json();

            // Xóa dữ liệu từ modal
            document.getElementById('modal-post-content').value = '';
            removeModalMedia();
            closePostModal();

            const inserted = typeof prependCreatedPostToFeed === 'function' && prependCreatedPostToFeed(createdPost);
            if (!inserted && typeof fetchPosts === 'function') {
                fetchPosts(token);
            }

            showPostNotification('Bài đăng đã được đăng thành công. Hệ thống sẽ tự kiểm duyệt trong nền.');
        } else {
            let errorData = null;
            try {
                const raw = await res.text();
                if (raw) {
                    try {
                        errorData = JSON.parse(raw);
                    } catch (_) {
                        errorData = raw;
                    }
                }
            } catch (_) {
                errorData = null;
            }
            
            // Xử lý các lỗi khác nhau
            if (res.status === 403) {
                const errorMessage = parseErrorMessage(errorData, 'Bạn đang bị cấm đăng bài do vi phạm chính sách cộng đồng.');
                showBanModal(errorMessage);
                closePostModal();
            } else if (res.status === 202) {
                showPostNotification('Bài đăng của bạn đang chờ duyệt bởi moderator.');
                closePostModal();
            } else {
                showPostNotification(parseErrorMessage(errorData, 'Không thể đăng bài, vui lòng thử lại.'), true);
            }
        }
    } catch (error) {
        console.error(error);
        showPostNotification('Lỗi kết nối khi đăng bài.', true);
    } finally {
        btn.innerText = 'Đăng';
        checkModalPostContent();
    }
}

/**
 * Hàm thêm listener events khi trang load
 */
window.addEventListener('DOMContentLoaded', function() {
    // Thêm event listener cho input file
    const modalImageInput = document.getElementById('modal-image-input');
    if (modalImageInput) {
        modalImageInput.addEventListener('change', previewModalMedia);
    }
});

// ================= SHARE POST LOGIC =================

let currentSharePostId = null;

async function openShareModal(postId) {
    currentSharePostId = postId;
    document.getElementById('share-post-modal').style.display = 'flex';
    document.getElementById('share-modal-content').value = '';
    checkShareModalContent();

    // Reset preview
    const previewContainer = document.getElementById('share-modal-preview-container');
    previewContainer.innerHTML = '<div style="padding: 20px; text-align: center;">Đang tải...</div>';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/posts/${postId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const post = await res.json();
            
            // Set current user details in modal header
            const myAvatar = document.getElementById('header-avatar') ? document.getElementById('header-avatar').src : '/uploads/default-avatar.png';
            document.getElementById('share-modal-avatar').src = myAvatar;
            document.querySelectorAll('.user-name').forEach((el, index) => {
                if(index === 0) {
                    document.getElementById('share-modal-user-name').innerText = el.innerText || 'Người dùng';
                }
            });

            // Build preview html
            let previewHtml = `
                <div style="padding: 12px; background: var(--comment-bg);">
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <img src="${post.authorAvatar}" class="avatar-small" style="width: 24px; height: 24px; border-radius: 50%;" onerror="this.src='/uploads/default-avatar.png'">
                        <span style="font-weight: 600; font-size: 13px; margin-left: 8px; color: var(--text-color);">${post.authorName}</span>
                    </div>
                    <p style="font-size: 13px; color: var(--text-color); margin-bottom: 8px;">${escapeHtml(post.content || '')}</p>
            `;
            if (post.imageUrl) {
                previewHtml += `<img src="${post.imageUrl}" style="max-width: 100%; border-radius: 8px; display: block; margin: 0 auto;">`;
            }
            if (post.videoUrl) {
                previewHtml += `<video src="${post.videoUrl}" style="max-width: 100%; border-radius: 8px; display: block; margin: 0 auto; background: #000; max-height: 200px;" controls></video>`;
            }
            previewHtml += `</div>`;
            previewContainer.innerHTML = previewHtml;
        } else {
            previewContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Lỗi tải bài viết</div>';
        }
    } catch (err) {
        previewContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Lỗi kết nối</div>';
    }
}

function closeShareModal() {
    document.getElementById('share-post-modal').style.display = 'none';
    currentSharePostId = null;
}

function checkShareModalContent() {
    const btn = document.getElementById('share-modal-submit-btn');
    if (currentSharePostId) {
        btn.disabled = false;
        btn.classList.add('active');
    } else {
        btn.disabled = true;
        btn.classList.remove('active');
    }
}

async function submitSharePost() {
    if (!currentSharePostId) return;

    const token = localStorage.getItem('token');
    const content = document.getElementById('share-modal-content').value.trim();
    const visibilitySelect = document.getElementById('share-modal-visibility');
    let visibility = 'PUBLIC';
    if(visibilitySelect) visibility = visibilitySelect.value;
    
    const btn = document.getElementById('share-modal-submit-btn');
    btn.innerText = 'Đang chia sẻ...';
    btn.disabled = true;

    const postData = {
        content: content,
        sharedPostId: currentSharePostId,
        visibility: visibility
    };

    try {
        const res = await fetch('/api/posts/create', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
        });

        if (res.ok) {
            const createdPost = await res.json();
            closeShareModal();
            
            // Try to prepend to feed
            const inserted = typeof prependCreatedPostToFeed === 'function' && prependCreatedPostToFeed(createdPost);
            if (!inserted && typeof fetchPosts === 'function') {
                fetchPosts(token);
            }

            showPostNotification('Đã chia sẻ bài viết thành công.');
        } else {
            showPostNotification('Lỗi chia sẻ bài viết, vui lòng thử lại.', true);
        }
    } catch (err) {
        showPostNotification('Lỗi kết nối mạng.', true);
    } finally {
        btn.innerText = 'Chia sẻ ngay';
        checkShareModalContent();
    }
}
