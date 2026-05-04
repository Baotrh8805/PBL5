/**
 * post-creation.js - Logic xử lý tạo bài đăng mới
 * Chứa logic phức tạp với kiểm tra AI nội dung
 */

let selectedMediaFile = null;
let selectedMediaType = null; // 'image' or 'video'

function showPostNotification(message, isError = false) {
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
                showPostNotification(parseErrorMessage(errorData, 'Bài đăng vi phạm chính sách cộng đồng.'), true);
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
