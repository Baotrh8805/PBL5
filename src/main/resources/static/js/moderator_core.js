console.log("MODERATOR CORE SCRIPT STARTING...");
/**
 * MODERATOR CONTROL PANEL LOGIC - LC NETWORK
 * Quản lý điều phối, báo cáo và người dùng vi phạm
 */

// 1. KIỂM TRA QUYỀN TRUY CẬP (Global State)
window.token = localStorage.getItem('token');
window.MOD_LOG_KEY = 'moderator_action_logs_v1';

window.dashboardState = {
    pending: 0,
    banned: 0,
    processedToday: 0
};

window.cache = {
    posts: [],
    users: []
};

window.currentModerator = {
    fullName: 'Nhân viên điều phối',
    email: '',
    id: null,
    avatar: '',
    phoneNumber: '',
    dateOfBirth: '',
    gender: '',
    bio: '',
    relationshipStatus: ''
};

// Khai báo alias để các hàm bên dưới không bị lỗi ReferenceError
var token = window.token;
var cache = window.cache;
var dashboardState = window.dashboardState;
var currentModerator = window.currentModerator;
window.showCustomAlert = function (title, message, type = "warning") {
    const oldPopup = document.getElementById('custom-alert-popup');
    if (oldPopup) oldPopup.remove();

    const color = type === "warning" ? "#faad14" : (type === "error" ? "#ff4d4f" : "#52c41a");
    const icon = type === "warning" ? "fa-triangle-exclamation" : (type === "error" ? "fa-circle-xmark" : "fa-circle-check");

    const popupHtml = `
        <div id="custom-alert-popup" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 999999;">
            <div style="background: #242526; border-radius: 8px; padding: 20px; min-width: 300px; max-width: 400px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.3); color: #e4e6eb; border-top: 4px solid ${color};">
                <i class="fa-solid ${icon}" style="font-size: 40px; color: ${color}; margin-bottom: 15px;"></i>
                <h3 style="margin: 0 0 10px 0; font-size: 18px;">${title}</h3>
                <p style="margin: 0 0 20px 0; font-size: 14px; color: #b0b3b8;">${message}</p>
                <button onclick="document.getElementById('custom-alert-popup').remove()" style="background: ${color}; color: ${type === "warning" ? "#000" : "#fff"}; border: none; padding: 8px 24px; border-radius: 4px; font-weight: 600; cursor: pointer;">Đóng</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', popupHtml);
};

window.showCustomConfirm = function (title, message, onConfirm) {
    const oldPopup = document.getElementById('custom-alert-popup');
    if (oldPopup) oldPopup.remove();

    const popupHtml = `
        <div id="custom-alert-popup" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 999999;">
            <div style="background: #242526; border-radius: 8px; padding: 25px; min-width: 350px; max-width: 450px; text-align: center; box-shadow: 0 4px 25px rgba(0,0,0,0.4); color: #e4e6eb; border-top: 4px solid #3498db;">
                <i class="fa-solid fa-circle-question" style="font-size: 45px; color: #3498db; margin-bottom: 20px;"></i>
                <h3 style="margin: 0 0 10px 0; font-size: 20px;">${title}</h3>
                <p style="margin: 0 0 25px 0; font-size: 15px; color: #b0b3b8; line-height: 1.5;">${message}</p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="custom-confirm-yes" style="background: #3498db; color: #fff; border: none; padding: 10px 25px; border-radius: 6px; font-weight: 600; cursor: pointer; flex: 1;">Xác nhận</button>
                    <button id="custom-confirm-no" style="background: #3e4042; color: #e4e6eb; border: none; padding: 10px 25px; border-radius: 6px; font-weight: 600; cursor: pointer; flex: 1;">Hủy bỏ</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', popupHtml);

    document.getElementById('custom-confirm-yes').onclick = () => {
        document.getElementById('custom-alert-popup').remove();
        if (onConfirm) onConfirm();
    };
    document.getElementById('custom-confirm-no').onclick = () => {
        document.getElementById('custom-alert-popup').remove();
    };
};


window.viewPostDetail = async function (postId) {
    console.log("DEBUG: viewPostDetail triggered for ID:", postId);
    try {
        window.postActionTaken = false;
        window.currentViewedPostId = postId;

        let post = (window.cache.posts || []).find(p => p.id == postId);

        if (!post) {
            console.warn("DEBUG: Post not found in cache, attempting to reload data...");
            await fetchPostsData();
            post = (window.cache.posts || []).find(p => p.id == postId);
        }

        if (!post) {
            showCustomAlert("Lỗi", "Không tìm thấy thông tin bài viết (ID: " + postId + "). Vui lòng tải lại trang.", "error");
            return;
        }

        console.log("DEBUG: Rendering post detail for:", post.id);
        const postStatus = String(post.status || '').toUpperCase();
        const myId = window.myUserId || (window.currentModerator ? window.currentModerator.id : null);

        // [RESTORED LOGIC] Nếu có người khác đang duyệt bài này thì không cho vào xem chi tiết
        if (postStatus === 'PENDING_REVIEW' && post.processingModeratorId && post.processingModeratorId != myId) {
            showCustomAlert("Thông báo", "Bài viết này đang được điều phối viên khác xử lý.", "warning");
            return;
        }

        if (postStatus === 'PENDING_REVIEW' && !post.processingModeratorId && myId) {
            const claimed = await claimPost(postId, { silent: true, skipDetailRefresh: true });
            if (!claimed) {
                await loadDashboardData();
                post = (window.cache.posts || []).find(p => p.id == postId) || post;
            }
        }

        renderPostDetailContent(post);

        const modal = document.getElementById('mod-post-detail-modal');
        if (modal) {
            modal.classList.remove('profile-modal-hidden');
            modal.setAttribute('aria-hidden', 'false');
            console.log("DEBUG: Modal opened successfully.");
        } else {
            console.error("DEBUG: Modal element 'mod-post-detail-modal' not found!");
            window.showCustomAlert("Lỗi giao diện", "Không tìm thấy khung hiển thị chi tiết bài viết.", "error");
        }
    } catch (error) {
        console.error("CRITICAL ERROR in viewPostDetail:", error);
        window.showCustomAlert("Lỗi hệ thống", "Không thể hiển thị chi tiết bài viết: " + error.message, "error");
    }
};

// Global Error Logging for Debugging
window.onerror = function (message, source, lineno, colno, error) {
    console.error("GLOBAL ERROR:", message, "at", source, ":", lineno);
};

window.approvePost = async function (id) {
    console.log("DEBUG: approvePost triggered for ID:", id);
    if (typeof showCustomConfirm !== 'function') {
        window.showToast("Lỗi hệ thống: Tính năng xác nhận chưa được tải!", "error");
        return;
    }
    showCustomConfirm('Duyệt bài viết', 'Bạn có chắc chắn muốn DUYỆT bài viết này không?', async () => {
        try {
            const res = await fetch(`/api/moderator/posts/${id}/approve`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
            });
            if (res.ok) {
                window.postActionTaken = true;
                if (window.closeModPostDetailModal) await window.closeModPostDetailModal();
                if (window.appendActionLog) appendActionLog('Duyệt bài viết', `#P-${id}`);
                showCustomAlert('Thành công', 'Đã duyệt bài viết thành công.', 'success');
                if (typeof fetchPostsData === 'function') await fetchPostsData();
                if (document.getElementById('overview-view') && typeof syncDashboardStats === 'function') syncDashboardStats();
                if (document.getElementById('review-posts-view') && typeof renderReviewPostsTable === 'function') renderReviewPostsTable(window.cache.posts);
            } else {
                const msg = await res.text();
                showCustomAlert('Lỗi', msg || 'Lỗi khi duyệt bài viết.', 'error');
            }
        } catch (e) {
            console.error(e);
            showCustomAlert('Lỗi kết nối', 'Không thể kết nối đến máy chủ.', 'error');
        }
    });
};

window.deletePost = async function (id) {
    console.log("DEBUG: deletePost triggered for ID:", id);
    if (typeof showCustomConfirm !== 'function') {
        window.showToast("Lỗi hệ thống: Tính năng xác nhận chưa được tải!", "error");
        return;
    }
    showCustomConfirm('Xóa bài viết', 'Bạn có chắc chắn muốn XÓA bài viết này? Hành động này không thể hoàn tác.', async () => {
        try {
            const res = await fetch(`/api/moderator/posts/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
            });
            if (res.ok) {
                window.postActionTaken = true;
                if (window.closeModPostDetailModal) await window.closeModPostDetailModal();
                if (window.appendActionLog) appendActionLog('Xóa bài viết', `#P-${id}`);
                showCustomAlert('Thành công', 'Đã xóa bài viết thành công.', 'success');
                if (typeof fetchPostsData === 'function') await fetchPostsData();
                if (document.getElementById('overview-view') && typeof syncDashboardStats === 'function') syncDashboardStats();
                if (document.getElementById('review-posts-view') && typeof renderReviewPostsTable === 'function') renderReviewPostsTable(window.cache.posts);
            } else {
                const msg = await res.text();
                showCustomAlert('Lỗi', msg || 'Lỗi khi xóa bài viết.', 'error');
            }
        } catch (e) {
            console.error(e);
            showCustomAlert('Lỗi kết nối', 'Không thể kết nối đến máy chủ.', 'error');
        }
    });
};


if (!window.token) {
    window.location.href = '/index.html'; // Về trang chủ nếu chưa đăng nhập
}


document.addEventListener('DOMContentLoaded', async () => {
    // Khởi tạo giao diện và dữ liệu
    if (typeof initHeaderMenus === 'function') initHeaderMenus();
    if (typeof initRightRailTabs === 'function') initRightRailTabs();
    if (typeof initProfileModal === 'function') initProfileModal();

    if (document.getElementById('statistics-view') && typeof renderLogTable === 'function') {
        renderLogTable();
    }

    // Thiết lập hệ thống chuyển trang SPA không reload
    setupNavigation();

    // Tải dữ liệu từ Server
    try {
        console.log("Khởi tạo: Đang tải thông tin cá nhân...");
        if (typeof fetchUserProfile === 'function') await fetchUserProfile();

        console.log("Khởi tạo: Đang tải danh sách bài viết...");
        // Tải dữ liệu mặc định ban đầu cho trang Tổng quan (Overview)
        if (typeof fetchPostsData === 'function') await fetchPostsData();
        console.log("Tải dữ liệu hoàn tất.");

        // Render Dashboard
        if (document.getElementById('overview-view')) {
            console.log("Rendering Dashboard...");
            if (typeof renderPostsTable === 'function') renderPostsTable(window.cache.posts || [], 'dashboard-posts-list');
            if (typeof syncDashboardStats === 'function') syncDashboardStats();
        }

        // Right Rail
        if (typeof loadNotifications === 'function' && typeof loadMessages === 'function') {
            await Promise.all([loadNotifications(), loadMessages()]);
        }

        // Sidebar toggle logic
        const toggleBtn = document.getElementById('toggle-right-rail');
        const rightRail = document.querySelector('.mod-chat-sidebar');
        if (toggleBtn && rightRail) {
            toggleBtn.addEventListener('click', () => {
                rightRail.classList.toggle('collapsed');
                toggleBtn.classList.toggle('active');
            });
        }

        const closeRightRailBtn = document.getElementById('close-right-rail-btn');
        if (closeRightRailBtn && rightRail) {
            closeRightRailBtn.addEventListener('click', () => {
                rightRail.classList.add('collapsed');
                if (toggleBtn) toggleBtn.classList.remove('active');
            });
        }
    } catch (e) {
        console.error("Lỗi khởi tạo:", e);
    }
});

function setupNavigation() {
    console.log("Setting up SPA Sidebar navigation...");

    // Hide all mod sections except overview by default
    document.querySelectorAll('.mod-section').forEach(section => {
        if (section.id === 'overview-view') {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const id = link.id;

            // Map navigation ID to section ID
            let targetSectionId = 'overview-view';
            if (id === 'nav-overview-view') targetSectionId = 'overview-view';
            else if (id === 'nav-review-posts-view') targetSectionId = 'review-posts-view';
            else if (id === 'nav-manage-posts-view') targetSectionId = 'manage-posts-view';
            else if (id === 'nav-manage-users-view') targetSectionId = 'manage-users-view';
            else if (id === 'nav-reports-view') targetSectionId = 'reports-view';
            else if (id === 'nav-statistics-view') targetSectionId = 'statistics-view';

            console.log(`Navigating to section: ${targetSectionId}`);

            // Active link styling
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Active view switching
            document.querySelectorAll('.mod-section').forEach(s => s.classList.remove('active'));
            const targetSection = document.getElementById(targetSectionId);
            if (targetSection) targetSection.classList.add('active');

            // Trigger specific page load actions to ensure data is fresh
            if (targetSectionId === 'overview-view') {
                if (typeof loadDashboardData === 'function') await loadDashboardData();
            } else if (targetSectionId === 'review-posts-view') {
                if (typeof fetchPostsData === 'function') await fetchPostsData();
                if (typeof renderReviewPostsTable === 'function') renderReviewPostsTable(window.cache.posts || []);
            } else if (targetSectionId === 'manage-posts-view') {
                if (typeof fetchPostsData === 'function') await fetchPostsData();
                if (typeof renderManagePostsFeed === 'function') renderManagePostsFeed(window.cache.posts || []);
            } else if (targetSectionId === 'manage-users-view') {
                if (typeof loadFlaggedUsers === 'function') await loadFlaggedUsers();
            } else if (targetSectionId === 'reports-view') {
                if (typeof loadReports === 'function') await loadReports();
            } else if (targetSectionId === 'statistics-view') {
                if (typeof renderLogTable === 'function') renderLogTable();
                if (typeof syncDashboardStats === 'function') syncDashboardStats();
            }
        });
    });
}

async function fetchPostsData() {
    console.log("Bắt đầu fetchPostsData...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // Tăng lên 30s
    try {
        const reviewFeed = document.getElementById('review-posts-list');
        if (reviewFeed) reviewFeed.innerHTML = '<div class="review-empty">Đang tải bài viết cần duyệt...</div>';

        const feedUrl = `/api/moderator/posts?ts=${Date.now()}`;
        console.log("Đang gọi API", feedUrl);
        const res = await fetch(feedUrl, {
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` },
            cache: 'no-store',
            signal: controller.signal
        });
        console.log("API phản hồi với status:", res.status);
        if (res.ok) {
            const posts = await res.json();
            console.log("Đã tải xong posts:", posts.length);
            window.cache.posts = Array.isArray(posts) ? posts : [];
            window.dashboardState.pending = window.cache.posts.filter(p => String(p.status).toUpperCase() === 'PENDING_REVIEW').length;
        } else {
            console.error("API trả về lỗi:", res.status);
            window.cache.posts = [];
        }
    } catch (err) {
        console.error("Lỗi tải bài viết:", err);
        window.cache.posts = [];
    } finally {
        clearTimeout(timeoutId);
    }
}

window.loadDashboardData = async function () {
    await fetchPostsData();

    if (document.getElementById('overview-view')) {
        if (typeof renderPostsTable === 'function') renderPostsTable(window.cache.posts || [], 'dashboard-posts-list');
        if (typeof syncDashboardStats === 'function') syncDashboardStats();
    }

    if (document.getElementById('review-posts-view') && typeof renderReviewPostsTable === 'function') {
        renderReviewPostsTable(window.cache.posts || []);
    }

    if (document.getElementById('manage-posts-view') && typeof renderManagePostsFeed === 'function') {
        renderManagePostsFeed(window.cache.posts || []);
    }
};

function initHeaderMenus() {
    const staffToggle = document.getElementById('staff-menu-toggle');
    const staffDropdown = document.getElementById('staff-menu-dropdown');
    const profileInfoBtn = document.getElementById('profile-info-btn');
    const changeAvatarBtn = document.getElementById('change-avatar-btn');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const staffLogoutBtn = document.getElementById('staff-logout-btn');
    const topbarLogoutBtn = document.getElementById('topbar-logout-btn');
    const avatarUploadInput = document.getElementById('staff-avatar-upload');

    if (staffToggle && staffDropdown) {
        staffToggle.addEventListener('click', () => {
            const willOpen = !staffDropdown.classList.contains('show');
            staffDropdown.classList.toggle('show', willOpen);
            staffToggle.setAttribute('aria-expanded', String(willOpen));
            staffDropdown.setAttribute('aria-hidden', String(!willOpen));
        });
    }

    if (profileInfoBtn) {
        profileInfoBtn.addEventListener('click', () => {
            openProfileModal();
            closeStaffDropdown();
        });
    }

    if (changeAvatarBtn && avatarUploadInput) {
        changeAvatarBtn.addEventListener('click', () => {
            avatarUploadInput.click();
        });

        avatarUploadInput.addEventListener('change', async (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            await updateAvatarFromFile(file);
            avatarUploadInput.value = '';
            closeStaffDropdown();
        });
    }

    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', async () => {
            await requestPasswordResetEmail();
            closeStaffDropdown();
        });
    }

    if (staffLogoutBtn) {
        staffLogoutBtn.addEventListener('click', () => {
            window.logout();
        });
    }

    if (topbarLogoutBtn) {
        topbarLogoutBtn.addEventListener('click', () => {
            window.logout();
        });
    }

    document.addEventListener('click', (event) => {
        if (staffDropdown && staffToggle && !staffDropdown.contains(event.target) && !staffToggle.contains(event.target)) {
            closeStaffDropdown();
        }
    });
}

function initRightRailTabs() {
    const tabs = document.querySelectorAll('.right-rail-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-rail-tab');
            tabs.forEach(t => t.classList.toggle('active', t === tab));
            document.querySelectorAll('.rail-panel').forEach(panel => {
                panel.classList.toggle('active', panel.id === `rail-${target}-panel`);
            });
        });
    });
}

function initProfileModal() {
    const modal = document.getElementById('profile-edit-modal');
    const closeBtn = document.getElementById('close-profile-modal');
    const cancelBtn = document.getElementById('cancel-profile-edit');
    const saveBtn = document.getElementById('save-profile-edit');
    const avatarBtn = document.getElementById('profile-modal-change-avatar');
    const avatarUpload = document.getElementById('profile-modal-avatar-upload');

    [closeBtn, cancelBtn].forEach(btn => {
        if (btn) btn.addEventListener('click', closeProfileModal);
    });

    if (avatarBtn && avatarUpload) {
        avatarBtn.addEventListener('click', () => avatarUpload.click());
        avatarUpload.addEventListener('change', async () => {
            const file = avatarUpload.files && avatarUpload.files[0];
            if (!file) return;
            await updateAvatarFromFile(file);
            populateProfileModal();
            avatarUpload.value = '';
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveProfileChanges);
    }

    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeProfileModal();
        });
    }
}

function openProfileModal() {
    populateProfileModal();
    const modal = document.getElementById('profile-edit-modal');
    if (modal) {
        modal.classList.remove('profile-modal-hidden');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeProfileModal() {
    const modal = document.getElementById('profile-edit-modal');
    if (modal) {
        modal.classList.add('profile-modal-hidden');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function populateProfileModal() {
    const avatar = document.getElementById('profile-modal-avatar');
    const fullName = document.getElementById('profile-fullName');
    const phone = document.getElementById('profile-phoneNumber');
    const dob = document.getElementById('profile-dateOfBirth');
    const gender = document.getElementById('profile-gender');
    const bio = document.getElementById('profile-bio');
    const rel = document.getElementById('profile-relationshipStatus');

    if (avatar) avatar.src = currentModerator.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentModerator.fullName || 'Moderator')}&background=00d1b2&color=fff`;
    if (fullName) fullName.value = currentModerator.fullName || '';
    if (phone) phone.value = currentModerator.phoneNumber || '';
    if (dob) dob.value = currentModerator.dateOfBirth ? String(currentModerator.dateOfBirth).slice(0, 10) : '';
    if (gender) gender.value = currentModerator.gender || '';
    if (bio) bio.value = currentModerator.bio || '';
    if (rel) rel.value = currentModerator.relationshipStatus || '';
}

async function saveProfileChanges() {
    const fullName = document.getElementById('profile-fullName')?.value?.trim() || '';
    const phoneNumber = document.getElementById('profile-phoneNumber')?.value?.trim() || '';
    const dateOfBirth = document.getElementById('profile-dateOfBirth')?.value || '';
    const gender = document.getElementById('profile-gender')?.value || '';
    const bio = document.getElementById('profile-bio')?.value || '';
    const relationshipStatus = document.getElementById('profile-relationshipStatus')?.value || '';
    // Hàm warnUser đã được chuyển sang moderator_core.js để đảm bảo tính toàn cục

    if (!fullName) {
        window.showCustomAlert("Cảnh báo", "Tên hiển thị không được để trống.", "warning");
        return;
    }

    try {
        const res = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.token || localStorage.getItem('token')}`
            },
            body: JSON.stringify({ fullName, phoneNumber, dateOfBirth, gender, bio, relationshipStatus })
        });

        if (!res.ok) {
            const message = await res.text();
            throw new Error(message || 'Không thể cập nhật thông tin');
        }

        currentModerator.fullName = fullName;
        currentModerator.phoneNumber = phoneNumber;
        currentModerator.dateOfBirth = dateOfBirth;
        currentModerator.gender = gender;
        currentModerator.bio = bio;
        currentModerator.relationshipStatus = relationshipStatus;

        const staffName = document.getElementById('staff-display-name');
        if (staffName) staffName.textContent = fullName;

        window.showToast("Đã cập nhật thông tin cá nhân thành công!", "success");
        closeProfileModal();
    } catch (error) {
        console.error('Lỗi cập nhật hồ sơ:', error);
        window.showCustomAlert("Lỗi cập nhật", "Cập nhật thông tin thất bại. Vui lòng thử lại.", "error");
    }
}

async function updateAvatarFromFile(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch('/api/upload/image', {
            method: 'POST',
            body: formData
        });

        if (!uploadRes.ok) {
            throw new Error('Tải ảnh lên thất bại');
        }

        const uploadData = await uploadRes.json();
        if (!uploadData.imageUrl) {
            throw new Error('Không nhận được URL ảnh');
        }

        const avatarRes = await fetch('/api/users/profile/avatar', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.token || localStorage.getItem('token')}`
            },
            body: JSON.stringify({ avatar: uploadData.imageUrl })
        });

        if (!avatarRes.ok) {
            throw new Error('Cập nhật ảnh đại diện thất bại');
        }

        const avatarImg = document.getElementById('header-avatar');
        if (avatarImg) avatarImg.src = uploadData.imageUrl;

        window.showToast("Đã cập nhật ảnh đại diện thành công!", "success");
    } catch (error) {
        console.error('Lỗi đổi ảnh đại diện:', error);
        window.showCustomAlert("Lỗi cập nhật", "Không thể cập nhật ảnh đại diện. Vui lòng thử lại.", "error");
    }
}

async function requestPasswordResetEmail() {
    if (!currentModerator.email) {
        window.showCustomAlert("Thông báo", "Không tìm thấy email tài khoản để đổi mật khẩu.", "warning");
        return;
    }

    try {
        const res = await fetch(`/api/auth/forgot-password?email=${encodeURIComponent(currentModerator.email)}`, {
            method: 'POST'
        });

        if (!res.ok) {
            throw new Error('Không thể gửi yêu cầu đổi mật khẩu');
        }

        window.showCustomAlert("Thành công", "Đã gửi email hướng dẫn đổi mật khẩu. Vui lòng kiểm tra hộp thư của bạn.", "success");
    } catch (error) {
        console.error('Lỗi đổi mật khẩu:', error);
        window.showCustomAlert("Lỗi hệ thống", "Gửi yêu cầu đổi mật khẩu thất bại. Vui lòng thử lại sau.", "error");
    }
}

function closeStaffDropdown() {
    const staffToggle = document.getElementById('staff-menu-toggle');
    const staffDropdown = document.getElementById('staff-menu-dropdown');
    if (!staffDropdown || !staffToggle) return;

    staffDropdown.classList.remove('show');
    staffToggle.setAttribute('aria-expanded', 'false');
    staffDropdown.setAttribute('aria-hidden', 'true');
}

async function fetchUserProfile() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
    try {
        console.log("Đang gọi API /api/users/profile...");
        const res = await fetch('/api/users/profile', {
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` },
            signal: controller.signal
        });
        if (res.ok) {
            const user = await res.json();
            console.log("Đã tải xong thông tin người dùng:", user.fullName);
            // Chỉ cho phép MODERATOR hoặc ADMIN vào panel này
            if (user.role !== 'MODERATOR' && user.role !== 'ADMIN') {
                window.location.href = '/html/home.html';
                return;
            }
            // Hiển thị avatar lên header
            const avatarImg = document.getElementById('header-avatar');
            if (avatarImg) avatarImg.src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=00d1b2&color=fff`;

            const staffName = document.getElementById('staff-display-name');
            if (staffName) staffName.textContent = user.fullName || 'Nhân viên điều phối';

            window.currentModerator.fullName = user.fullName || 'Nhân viên điều phối';
            window.currentModerator.email = user.email || '';
            window.currentModerator.id = user.id || null;
            window.currentModerator.avatar = user.avatar || '';
            window.currentModerator.phoneNumber = user.phoneNumber || '';
            window.currentModerator.dateOfBirth = user.dateOfBirth || '';
            window.currentModerator.gender = user.gender || '';
            window.currentModerator.bio = user.bio || '';
            window.currentModerator.relationshipStatus = user.relationshipStatus || '';
            window.myUserId = user.id;
            if (typeof connectWebSocket === 'function') connectWebSocket();
        } else {
            console.error("Lỗi fetch profile:", res.status);
        }
    } catch (err) {
        console.error("Lỗi xác thực:", err);
    } finally {
        clearTimeout(timeoutId);
    }
}
window.showToast = function (message, type = "info") {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    const color = type === "success" ? "#52c41a" : "#1890ff";
    const icon = type === "success" ? "fa-circle-check" : "fa-info-circle";

    const toast = document.createElement('div');
    toast.style.cssText = `background: #242526; color: #e4e6eb; padding: 12px 20px; border-radius: 8px; margin-top: 10px; border-left: 4px solid ${color}; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 12px; min-width: 250px; animation: slideInLeft 0.3s ease-out;`;
    toast.innerHTML = `
        <i class="fa-solid ${icon}" style="color: ${color}; font-size: 18px;"></i>
        <div style="font-size: 14px;">${message}</div>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease-out forwards';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
};

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = "position: fixed; bottom: 20px; left: 20px; z-index: 10000; display: flex; flex-direction: column-reverse;";
    document.body.appendChild(container);

    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes slideInLeft { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    `;
    document.head.appendChild(style);
    return container;
}



window.logout = function () {
    localStorage.removeItem('token');
    window.location.href = '/index.html';
};



window.renderPostDetailContent = function (post) {
    const postStatus = String(post.status || '').toUpperCase();
    const isReviewed = postStatus !== 'PENDING_REVIEW';
    const myId = window.myUserId || (window.currentModerator ? window.currentModerator.id : null);

    const modalBody = document.querySelector('#mod-post-detail-modal .modal-body');
    let statusDiv = document.getElementById('mod-post-modal-status');

    if (!statusDiv && modalBody) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'mod-post-modal-status';
        modalBody.prepend(statusDiv);
    }

    if (isReviewed && statusDiv) {
        const isRejected = postStatus === 'REJECTED' || postStatus === 'AUTO_REJECTED';
        const statusColor = isRejected ? '#ff4d4f' : '#00d1b2';
        const statusBg = isRejected ? 'rgba(255, 77, 79, 0.1)' : 'rgba(0, 209, 178, 0.1)';
        const statusIcon = isRejected ? 'fa-circle-xmark' : 'fa-circle-check';
        const statusText = postStatus === 'REJECTED' ? 'Xử lý: Xóa bài' : (postStatus === 'AUTO_REJECTED' ? 'Xử lý: Hệ thống tự động xóa' : 'Xử lý: Duyệt bài');

        statusDiv.innerHTML = `
            <div style="margin-bottom: 20px; padding: 15px; background: #18191a; border-radius: 10px; border: 2px solid ${statusColor}; display: flex; align-items: center; gap: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                <div style="font-size: 30px; color: ${statusColor}; display: flex; align-items: center; justify-content: center; width: 45px; height: 45px; background: ${statusBg}; border-radius: 50%;">
                    <i class="fa-solid ${statusIcon}"></i>
                </div>
                <div style="flex: 1;">
                    <div style="color: ${statusColor}; font-weight: 800; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">
                        ${statusText}
                    </div>
                    <div style="display: flex; gap: 20px; font-size: 13px; color: #b0b3b8;">
                        <span>Moderator: <strong style="color: #e4e6eb;">${escapeHtml(post.reviewerName || 'Hệ thống AI')}</strong></span>
                        <span>Thời gian: <strong style="color: #e4e6eb;">${post.reviewedAt ? new Date(post.reviewedAt).toLocaleString('vi-VN') : 'Không rõ'}</strong></span>
                    </div>
                </div>
            </div>
        `;
        statusDiv.style.display = 'block';
    } else if (statusDiv) {
        statusDiv.style.display = 'none';
    }

    const authorElem = document.getElementById('mod-post-modal-author');
    if (authorElem) authorElem.innerText = post.authorName || 'Ẩn danh';

    const timeElem = document.getElementById('mod-post-modal-time');
    if (timeElem) timeElem.innerText = new Date(post.createdAt).toLocaleString('vi-VN');

    const avatarElem = document.getElementById('mod-post-modal-avatar');
    if (avatarElem) avatarElem.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(post.authorName || 'Ẩn danh') + '&background=00d1b2&color=fff';

    const contentElem = document.getElementById('mod-post-modal-content-original');
    if (contentElem) contentElem.innerText = post.content || '(Nội dung trống)';

    const idBadgeElem = document.getElementById('mod-post-modal-id-badge');
    if (idBadgeElem) idBadgeElem.innerText = `#P-${post.id}`;

    // Xử lý Bằng chứng vi phạm
    let evidenceHtml = '';
    let hateData = post.hateSpeechWord;
    if (hateData === null || hateData === undefined || hateData === 'null') hateData = '';
    hateData = hateData.trim();

    const evidenceWrapper = document.getElementById('mod-post-modal-evidence-wrapper');

    if (hateData) {
        try {
            const formatTokens = (text) => {
                if (!text || text === 'null' || text.trim() === '') return '';
                const tokens = text.split(' ');
                let hasTag = false;
                const html = tokens.map(t => {
                    const tagMatch = t.match(/\[(.*?)\]/);
                    if (tagMatch) {
                        const tag = tagMatch[1];
                        let word = t.replace(/\[.*?\]/g, '').replace(/^["']|["']$/g, '');
                        if (tag === 'B-T' || tag === 'I-T') {
                            hasTag = true;
                            return `<span style="background-color: #f1c40f; color: black; padding: 2px 4px; border-radius: 4px; font-weight: bold;">${escapeHtml(word)}</span>`;
                        }
                        return escapeHtml(word);
                    }
                    return escapeHtml(t.replace(/^["']|["']$/g, ''));
                }).join(' ');
                return hasTag ? html : '';
            };

            if (hateData.includes('(Video:)') || hateData.includes('(Content:)')) {
                const vMatch = hateData.match(/\(Video:\)(.*?)(?=\s*\(Content:\)|$)/);
                const cMatch = hateData.match(/\(Content:\)(.*)/);
                const videoText = vMatch ? vMatch[1].trim() : '';
                const contentText = cMatch ? cMatch[1].trim() : '';

                const vFormatted = formatTokens(videoText);
                const cFormatted = formatTokens(contentText);

                let parts = [];
                if (vFormatted) parts.push(`<div style="margin-bottom:8px;"><strong style="color: #ffba08;">(Video):</strong> ${vFormatted}</div>`);
                if (cFormatted) parts.push(`<div><strong style="color: #ffba08;">(Content):</strong> ${cFormatted}</div>`);

                if (parts.length > 0) {
                    evidenceHtml = parts.join('');
                }
            } else {
                evidenceHtml = formatTokens(hateData);
            }
        } catch (e) {
            console.error("Lỗi parse hateData", e);
        }
    }

    if (!evidenceHtml) {
        // Kiểm tra bằng chứng vi phạm khác (NSFW/Violence)
        const otherEvidence = (post.violationEvidence || '').trim();
        if (otherEvidence && otherEvidence !== 'null' && otherEvidence !== post.content) {
            evidenceHtml = escapeHtml(otherEvidence);
        }
    }

    const evidenceContentElem = document.getElementById('mod-post-modal-content-evidence');
    if (evidenceHtml) {
        if (evidenceContentElem) evidenceContentElem.innerHTML = evidenceHtml;
        if (evidenceWrapper) evidenceWrapper.style.display = 'block';
    } else {
        if (evidenceWrapper) evidenceWrapper.style.display = 'none';
    }

    const mediaContainer = document.getElementById('mod-post-modal-media');

    // Thêm thông tin giây vi phạm và từ vi phạm trong ảnh
    let extraViolationsHtml = '';
    let videoUrlStr = post.videoUrl ? escapeHtml(post.videoUrl) : '';

    if (post.videoUrl && post.highestScoreFrameSecond !== undefined && post.highestScoreFrameSecond !== null) {
        let frameIdx = post.highestScoreFrameSecond; // Re-purposed
        let fps = post.fps || 30;
        let timeInSec = Math.floor(frameIdx / fps);
        let totalFrames = post.totalFramesAnalyzed; // Re-purposed
        let totalFramesText = totalFrames ? ` / ${totalFrames}` : '';

        extraViolationsHtml += `<div style="background: rgba(255, 77, 79, 0.1); border-left: 4px solid #ff4d4f; padding: 10px; margin-bottom: 10px; border-radius: 4px; color: #ff4d4f; font-weight: 600;"><i class="fa-solid fa-clock"></i> Khung hình vi phạm: ${frameIdx}${totalFramesText} (Giây thứ ${timeInSec}s)</div>`;
        videoUrlStr += `#t=${timeInSec}`;
    }



    if (post.imageUrl && Array.isArray(post.ocrViolationWords) && post.ocrViolationWords.length > 0) {
        extraViolationsHtml += `<div style="background: rgba(255, 77, 79, 0.1); border-left: 4px solid #ff4d4f; padding: 10px; margin-bottom: 10px; border-radius: 4px; color: #ff4d4f; font-weight: 600;"><i class="fa-solid fa-file-signature"></i> Chữ vi phạm phát hiện trong ảnh: ${post.ocrViolationWords.join(', ')}</div>`;
    }

    // Hiển thị video/ảnh gốc (không dùng frame đỏ chứa box để moderator xem rõ nội dung gốc)
    let rawMediaHtml = '';
    if (post.imageUrl) {
        rawMediaHtml += `<img src="${escapeHtml(post.imageUrl)}" style="max-height: 400px; width: 100%; object-fit: contain; margin: 0 auto; display: block;" alt="Ảnh bài viết">`;
    }
    if (post.videoUrl) {
        rawMediaHtml += `<video controls preload="metadata" playsinline style="max-height: 400px; width: 100%; object-fit: contain; margin: 0 auto; display: block;"><source src="${videoUrlStr}">Trình duyệt không hỗ trợ video.</video>`;
    }

    if (mediaContainer) mediaContainer.innerHTML = extraViolationsHtml + rawMediaHtml;

    // Xử lý Interaction (Like, Comment, Share) và Score Bars, Buttons
    const likeCount = Array.isArray(post.likes) ? post.likes.length : (post.likeCount || 0);
    const commentCount = Array.isArray(post.comments) ? post.comments.length : (post.commentCount || 0);

    let interactionHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #3e4042; font-size: 13px; color: #b0b3b8; margin-top: 15px;">
            <span><i class="fa-solid fa-thumbs-up" style="color: #3498db;"></i> ${likeCount}</span>
            <div>
                <span>${commentCount} bình luận</span>
                <span style="margin-left: 10px;">0 chia sẻ</span>
            </div>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #3e4042;">
            <button style="flex: 1; background: transparent; border: none; color: #b0b3b8; padding: 8px; border-radius: 4px; font-weight: 600;"><i class="fa-regular fa-thumbs-up"></i> Thích</button>
            <button style="flex: 1; background: transparent; border: none; color: #b0b3b8; padding: 8px; border-radius: 4px; font-weight: 600;"><i class="fa-regular fa-comment"></i> Bình luận</button>
            <button style="flex: 1; background: transparent; border: none; color: #b0b3b8; padding: 8px; border-radius: 4px; font-weight: 600;"><i class="fa-solid fa-share"></i> Chia sẻ</button>
        </div>
    `;

    const nsfwScore = post.nsfwScore || 0;
    const violenScore = post.violenceScore || 0;

    let contentHateScore = post.hateSpeechContentScore || 0;
    let videoHateScore = post.hateSpeechVideoScore || 0;
    let contentHateLabelVal = 0;
    let videoHateLabelVal = 0;

    if (post.speechLabels) {
        try {
            if (post.speechLabels.includes(';')) {
                const parts = post.speechLabels.split(';');
                const cPart = parts[0].split(':');
                const vPart = parts[1].split(':');
                contentHateLabelVal = parseInt(cPart[0]) || 0;
                contentHateScore = parseFloat(cPart[1]) || contentHateScore;
                videoHateLabelVal = parseInt(vPart[0]) || 0;
                videoHateScore = parseFloat(vPart[1]) || videoHateScore;
            } else if (post.speechLabels.includes(':')) {
                const part = post.speechLabels.split(':');
                contentHateLabelVal = parseInt(part[0]) || 0;
                contentHateScore = parseFloat(part[1]) || contentHateScore;
            }
        } catch (err) {
            console.error("Lỗi parse speechLabels:", err);
        }
    }

    const labelNames = { 0: "CLEAN", 1: "OFFENSIVE", 2: "HATE" };
    const contentHateLabel = labelNames[contentHateLabelVal] || "CLEAN";
    const videoHateLabel = labelNames[videoHateLabelVal] || "CLEAN";

    let scoreBarsHtml = '';
    if (violenScore > 0) {
        scoreBarsHtml += `
            <div class="review-score-item" style="margin-bottom: 8px;">
                <div class="review-score-header" style="font-size: 0.9rem; margin-bottom: 4px; display: flex; justify-content: space-between;"><span>Bạo lực</span><strong>${(violenScore * 100).toFixed(1)}%</strong></div>
                <div class="review-score-bar" style="height: 8px; margin-bottom: 0; background: #3e4042; border-radius: 4px; overflow: hidden;"><div class="review-score-fill danger" style="width: ${Math.min(100, violenScore * 100)}%; height: 100%; background: #ff4d4f;"></div></div>
            </div>
        `;
    }
    if (nsfwScore > 0) {
        scoreBarsHtml += `
            <div class="review-score-item" style="margin-bottom: 8px;">
                <div class="review-score-header" style="font-size: 0.9rem; margin-bottom: 4px; display: flex; justify-content: space-between;"><span>Nội dung nhạy cảm</span><strong>${(nsfwScore * 100).toFixed(1)}%</strong></div>
                <div class="review-score-bar" style="height: 8px; margin-bottom: 0; background: #3e4042; border-radius: 4px; overflow: hidden;"><div class="review-score-fill warning" style="width: ${Math.min(100, nsfwScore * 100)}%; height: 100%; background: #faad14;"></div></div>
            </div>
        `;
    }
    if (contentHateScore > 0) {
        const labelColor = contentHateLabelVal === 2 ? '#ff4d4f' : (contentHateLabelVal === 1 ? '#faad14' : '#52c41a');
        const fillClass = contentHateLabelVal === 2 ? 'danger' : (contentHateLabelVal === 1 ? 'warning' : 'success');
        scoreBarsHtml += `
            <div class="review-score-item" style="margin-bottom: 8px;">
                <div class="review-score-header" style="font-size: 0.9rem; margin-bottom: 4px; display: flex; justify-content: space-between;">
                    <span>Ngôn từ thù ghét (Bài viết) <span style="font-size: 0.75rem; padding: 1px 6px; border-radius: 4px; margin-left: 6px; font-weight: bold; background: ${labelColor}; color: #fff;">${contentHateLabel}</span></span>
                    <strong>${(contentHateScore * 100).toFixed(1)}%</strong>
                </div>
                <div class="review-score-bar" style="height: 8px; margin-bottom: 0; background: #3e4042; border-radius: 4px; overflow: hidden;"><div class="review-score-fill ${fillClass}" style="width: ${Math.min(100, contentHateScore * 100)}%; height: 100%;"></div></div>
            </div>
        `;
    }
    if (videoHateScore > 0) {
        const labelColor = videoHateLabelVal === 2 ? '#ff4d4f' : (videoHateLabelVal === 1 ? '#faad14' : '#52c41a');
        const fillClass = videoHateLabelVal === 2 ? 'danger' : (videoHateLabelVal === 1 ? 'warning' : 'success');
        scoreBarsHtml += `
            <div class="review-score-item" style="margin-bottom: 8px;">
                <div class="review-score-header" style="font-size: 0.9rem; margin-bottom: 4px; display: flex; justify-content: space-between;">
                    <span>Ngôn từ thù ghét (Media) <span style="font-size: 0.75rem; padding: 1px 6px; border-radius: 4px; margin-left: 6px; font-weight: bold; background: ${labelColor}; color: #fff;">${videoHateLabel}</span></span>
                    <strong>${(videoHateScore * 100).toFixed(1)}%</strong>
                </div>
                <div class="review-score-bar" style="height: 8px; margin-bottom: 0; background: #3e4042; border-radius: 4px; overflow: hidden;"><div class="review-score-fill ${fillClass}" style="width: ${Math.min(100, videoHateScore * 100)}%; height: 100%;"></div></div>
            </div>
        `;
    }

    const scoresElem = document.getElementById('mod-post-modal-scores');
    if (scoresElem) {
        if (scoreBarsHtml) {
            scoresElem.innerHTML = `<div style="margin-bottom: 15px; background: #18191a; padding: 15px; border-radius: 8px; border: 1px solid #3e4042; color: #e4e6eb;">${scoreBarsHtml}</div>`;
        } else {
            scoresElem.innerHTML = '';
        }
    }

    let actionButtons = '';
    if (postStatus === 'PENDING_REVIEW') {
        const isClaimedByOther = post.processingModeratorId && post.processingModeratorId != myId;
        if (!isClaimedByOther) {
            actionButtons = `
                <div style="display: flex; gap: 10px;">
                    <button class="btn-action success" onclick="approvePost(${post.id})" style="padding: 8px 16px; font-size: 14px;">Duyệt</button>
                    <button class="btn-action danger" onclick="deletePost(${post.id})" style="padding: 8px 16px; font-size: 14px;">Xóa bài</button>
                </div>
            `;
        } else {
            actionButtons = `<div style="color: #faad14; font-weight: 600; padding: 10px; background: rgba(250, 173, 20, 0.1); border-radius: 4px; border-left: 4px solid #faad14; width: 100%;">Bài viết này đang được xử lý bởi: ${post.processingModeratorName || 'Moderator khác'}</div>`;
        }
    }


    const actionsElem = document.getElementById('mod-post-modal-actions');
    if (actionsElem) actionsElem.innerHTML = actionButtons;

    const interactionsElem = document.getElementById('mod-post-modal-interactions');
    if (interactionsElem) interactionsElem.innerHTML = interactionHtml;

    const modal = document.getElementById('mod-post-detail-modal');
    if (modal) {
        // Fetch comments before opening
        if (window.fetchModComments) {
            window.fetchModComments(post.id);
        }
        modal.classList.remove('profile-modal-hidden');
        modal.setAttribute('aria-hidden', 'false');
    }
};

window.fetchModComments = async function (postId) {
    const token = window.token || localStorage.getItem('token');
    const container = document.getElementById('mod-post-modal-comments-section');
    const list = document.getElementById('mod-post-modal-comments-list');

    if (!container || !list) return;

    container.style.display = 'block';
    list.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px;">Đang tải bình luận...</div>';

    try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Fetch failed");
        const comments = await res.json();

        if (!comments || comments.length === 0) {
            list.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px;">Chưa có bình luận nào.</div>';
            return;
        }

        list.innerHTML = comments.map(c => renderModCommentItem(c)).join('');
    } catch (err) {
        console.error("Lỗi lấy comment:", err);
        list.innerHTML = '<div style="color: #ff4d4f; font-size: 13px;">Lỗi tải bình luận.</div>';
    }
};

window.renderModCommentItem = function (c, isReply = false) {
    const timeStr = new Date(c.createdAt).toLocaleString('vi-VN');
    let mediaHtml = '';
    if (c.imageUrl) {
        mediaHtml = `<img src="${c.imageUrl}" style="max-width: 100%; border-radius: 8px; margin-top: 8px; display: block;">`;
    } else if (c.videoUrl) {
        mediaHtml = `<video src="${c.videoUrl}" controls style="max-width: 100%; border-radius: 8px; margin-top: 8px; display: block;"></video>`;
    }

    let repliesHtml = '';
    if (c.replies && c.replies.length > 0) {
        repliesHtml = `<div class="replies-container" style="margin-left: 30px; border-left: 2px solid var(--border-color, #3e4042); padding-left: 10px; margin-top: 10px; display: flex; flex-direction: column; gap: 10px;">
            ${c.replies.map(r => renderModCommentItem(r, true)).join('')}
        </div>`;
    }

    const avatar = c.authorAvatar || '/uploads/default-avatar.png';
    const content = escapeHtml(c.content || '').replace(/\\n/g, "<br>");

    return `
        <div class="comment-item" style="display: flex; gap: 10px;">
            <img src="${avatar}" style="width: ${isReply ? '24px' : '32px'}; height: ${isReply ? '24px' : '32px'}; border-radius: 50%; object-fit: cover;" onerror="this.src='/uploads/default-avatar.png'">
            <div style="flex: 1;">
                <div style="background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 12px; border: 1px solid var(--border-color, #3e4042); display: inline-block;">
                    <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); margin-bottom: 2px;">${c.authorName}</div>
                    <div style="font-size: 14px; color: var(--text-primary);">${content}</div>
                    ${mediaHtml}
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; margin-left: 5px;">${timeStr}</div>
                ${repliesHtml}
            </div>
        </div>
    `;
};

window.claimPost = async function (postId, options = {}) {
    const { silent = false, skipDetailRefresh = false } = options;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/moderator/posts/${postId}/start-processing`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
        });
        if (res.ok) {
            const data = await res.json();
            const postObj = (window.cache.posts || []).find(p => p.id == postId);
            if (postObj) {
                postObj.processingModeratorId = data.processingModeratorId;
                postObj.processingModeratorName = data.processingModeratorName;
                if (!skipDetailRefresh) {
                    window.renderPostDetailContent(postObj);
                }
                if (typeof renderReviewPostsTable === 'function') renderReviewPostsTable(window.cache.posts);
            }

            if (window.keepAliveInterval) clearInterval(window.keepAliveInterval);
            window.keepAliveInterval = setInterval(() => {
                fetch(`/api/moderator/posts/${postId}/keep-alive`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
                }).catch(e => console.error("Heartbeat error", e));
            }, 1000);

            if (!silent) {
                showCustomAlert("Thông báo", "Bạn đã nhận bài viết này. Bài viết sẽ chuyển sang mục 'Đang duyệt' của bạn.", "success");
            }
            return true;
        } else {
            const err = await res.text();
            showCustomAlert("Không thể nhận bài", err || "Bài viết đã được người khác nhận.", "warning");
            return false;
        }
    } catch (e) {
        console.error(e);
        return false;
    }
};

window.closeModPostDetailModal = async function () {
    const modal = document.getElementById('mod-post-detail-modal');
    if (modal) {
        modal.classList.add('profile-modal-hidden');
        modal.setAttribute('aria-hidden', 'true');
    }
    const video = document.querySelector('#mod-post-modal-media video');
    if (video) video.pause();

    if (window.keepAliveInterval) {
        clearInterval(window.keepAliveInterval);
        window.keepAliveInterval = null;
    }

    if (!window.postActionTaken && window.currentViewedPostId) {
        try {
            const res = await fetch(`/api/moderator/posts/${window.currentViewedPostId}/cancel-processing`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
            });
            // Cập nhật lại trạng thái local thay vì load lại toàn bộ
            const p = (cache.posts || []).find(x => x.id === window.currentViewedPostId);
            if (p) {
                p.processingModeratorId = null;
                p.processingModeratorName = null;
            }
            if (res.ok && typeof loadDashboardData === 'function') {
                await loadDashboardData();
            }
        } catch (e) { }
    }
    window.currentViewedPostId = null;
};

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function parseMaybeJson(value) {
    if (value == null) return null;
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function formatBoxValue(boxValue) {
    if (!boxValue) return 'Chưa phát hiện';

    const parsed = parseMaybeJson(boxValue);
    if (Array.isArray(parsed) && parsed.length >= 4) {
        return `[${parsed.slice(0, 4).join(', ')}]`;
    }

    if (parsed && typeof parsed === 'object') {
        const x1 = parsed.x1 ?? parsed.left ?? 0;
        const y1 = parsed.y1 ?? parsed.top ?? 0;
        const x2 = parsed.x2 ?? parsed.right ?? 0;
        const y2 = parsed.y2 ?? parsed.bottom ?? 0;
        return `[${x1}, ${y1}, ${x2}, ${y2}]`;
    }

    return String(parsed || boxValue);
}

function formatWordList(wordValue) {
    const parsed = parseMaybeJson(wordValue);
    const words = Array.isArray(parsed)
        ? parsed
        : String(parsed || '')
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);

    if (!words.length) {
        return '<span class="score-pill">Chưa phát hiện</span>';
    }

    return words.map(word => `<span class="score-pill">${escapeHtml(word)}</span>`).join(' ');
}

async function loadNotifications() {
    const container = document.getElementById('notifications-list');
    if (!container) return;

    try {
        const res = await fetch('/api/notifications', {
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
        });

        if (!res.ok) throw new Error('Không tải được thông báo');

        const notifications = await res.json();

        // Update bell badge unread indicator dot
        const bellBadge = document.getElementById('bell-badge');
        if (bellBadge) {
            const hasUnread = Array.isArray(notifications) && notifications.some(item => !item.isRead);
            bellBadge.style.display = hasUnread ? 'block' : 'none';
        }

        if (!Array.isArray(notifications) || notifications.length === 0) {
            container.innerHTML = '<div class="rail-empty">Không có thông báo mới.</div>';
            return;
        }

        container.innerHTML = notifications.slice(0, 12).map(item => {
            const isFriendReq = item.type === 'NEW_FRIEND_REQUEST';
            return `
                <div class="rail-item ${item.isRead ? '' : 'unread'}" style="cursor: default;">
                    <div class="rail-item-icon" style="${isFriendReq ? 'background: rgba(52, 152, 219, 0.12); color: #3498db;' : ''}">
                        <i class="fa-solid ${isFriendReq ? 'fa-user-plus' : 'fa-bell'}"></i>
                    </div>
                    <div class="rail-item-body">
                        <div class="rail-item-title">${escapeHtml(item.senderName || 'Hệ thống')}</div>
                        <div class="rail-item-text">${escapeHtml(item.message || '')}</div>
                        ${isFriendReq && !item.isRead ? `
                            <div class="rail-item-actions" style="margin-top: 8px; display: flex; gap: 8px;">
                                <button class="btn-action success" onclick="handleFriendAction(${item.senderId}, 'accept', ${item.id})" style="padding: 4px 10px; font-size: 0.8rem; background: #2ecc71; border: none; border-radius: 4px; color: #fff; cursor: pointer;">Đồng ý</button>
                                <button class="btn-action danger" onclick="handleFriendAction(${item.senderId}, 'refuse', ${item.id})" style="padding: 4px 10px; font-size: 0.8rem; background: #e74c3c; border: none; border-radius: 4px; color: #fff; cursor: pointer;">Từ chối</button>
                            </div>
                        ` : ''}
                        <div class="rail-item-meta">${new Date(item.createdAt).toLocaleString('vi-VN')}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error(error);
        container.innerHTML = '<div class="rail-empty">Không tải được thông báo.</div>';
    }
}

window.handleFriendAction = async function (senderId, action, notifId) {
    try {
        const endpoint = action === 'accept' ? `/api/friends/accept/${senderId}` : `/api/friends/refuse/${senderId}`;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
        });

        if (res.ok) {
            window.showToast(action === 'accept' ? 'Đã chấp nhận kết bạn' : 'Đã từ chối kết bạn', 'success');
            // Đánh dấu thông báo là đã đọc
            await fetch(`/api/notifications/${notifId}/read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
            });
            await loadNotifications();
            if (action === 'accept') loadMessages();
            if (typeof loadFlaggedUsers === 'function') loadFlaggedUsers();
        } else {
            const err = await res.text();
            window.showToast(err || 'Thao tác thất bại', 'danger');
        }
    } catch (e) {
        console.error(e);
        window.showToast('Lỗi kết nối', 'danger');
    }
};

async function loadMessages() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    try {
        const res = await fetch('/api/messages/conversations', {
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
        });

        if (!res.ok) throw new Error('Server trả về lỗi ' + res.status);

        const conversations = await res.json();

        // Update chat badge unread indicator dot
        const chatBadge = document.getElementById('chat-badge');
        if (chatBadge) {
            const hasUnread = Array.isArray(conversations) && conversations.some(item => item.unreadCount > 0);
            chatBadge.style.display = hasUnread ? 'block' : 'none';
        }

        // Không phân biệt bạn bè/người dùng, gộp chung một danh sách duy nhất
        let html = '';

        if (conversations.length > 0) {
            html += conversations.map(item => renderConvItem(item)).join('');
        } else {
            html += `<div class="rail-empty" style="padding: 20px; text-align: center; color: #b0b3b8; font-size: 13px;">Chưa có cuộc trò chuyện nào</div>`;
        }

        container.innerHTML = html;
    } catch (error) {
        console.error("Lỗi tải tin nhắn:", error);
        container.innerHTML = '<div class="rail-empty" style="padding: 20px; text-align: center; color: #b0b3b8;">Không tải được tin nhắn.</div>';
    }
}

function renderConvItem(item) {
    const hasUnread = item.unreadCount > 0;
    const unreadIndicator = hasUnread ? `<div style="width: 12px; height: 12px; background: #00d1b2; border-radius: 50%; margin-left: 10px; flex-shrink: 0; box-shadow: 0 0 5px rgba(0, 209, 178, 0.5);"></div>` : '';

    // Xử lý hiển thị tin nhắn cuối cùng (nếu có)
    const lastMsgText = item.lastMessage ? escapeHtml(item.lastMessage) : 'Mở để nhắn tin';

    // Màu sắc tối ưu cho độ tương phản cao
    const nameColor = hasUnread ? '#050505' : '#444444';
    const msgColor = hasUnread ? '#1c1e21' : '#65676b';
    const bgColor = hasUnread ? 'rgba(0, 209, 178, 0.08)' : 'transparent';
    const fontWeightName = hasUnread ? '700' : '600';
    const fontWeightMsg = hasUnread ? '600' : '400';

    return `
        <div class="rail-item ${hasUnread ? 'unread' : ''}" onclick="selectPartner(${item.id})" 
             style="cursor: pointer; padding: 15px; display: flex; align-items: center; gap: 12px; transition: all 0.2s; background: ${bgColor}; border-bottom: 1px solid rgba(0,0,0,0.03);">
            <div style="position: relative; flex-shrink: 0;">
                <img class="rail-avatar" src="${item.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(item.fullName || 'User')}" 
                     style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(0,0,0,0.05);">
                ${item.online ? '<div style="position: absolute; bottom: 2px; right: 2px; width: 12px; height: 12px; background: #2ecc71; border: 2px solid #fff; border-radius: 50%;"></div>' : ''}
            </div>
            <div style="flex: 1; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 15px; font-weight: ${fontWeightName}; color: ${nameColor}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${escapeHtml(item.fullName || 'Người dùng')}
                    </span>
                    <span style="font-size: 11px; color: #8a8d91; flex-shrink: 0; margin-left: 5px;">${item.lastMessageTime ? timeSince(item.lastMessageTime) : ''}</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="font-size: 13px; color: ${msgColor}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: ${fontWeightMsg}; flex: 1; line-height: 1.4;">
                        ${lastMsgText}
                    </div>
                    ${unreadIndicator}
                </div>
            </div>
        </div>
    `;
}

let stompClient = null;
let currentChatPartnerId = null;

// Tự động khởi tạo khi trang tải xong
document.addEventListener('DOMContentLoaded', () => {
    injectCommonModals();
    connectWebSocket();
    loadNotifications();
    loadMessages();
});

function injectCommonModals() {
    if (document.getElementById('mod-chat-window')) return;

    const chatHtml = `
    <!-- Chat Window Container Injected Globally -->
    <div id="mod-chat-window" class="chat-box" style="display: none; position: fixed; bottom: 20px; right: 350px; width: 330px; height: 450px; background: #242526; border-radius: 8px 8px 0 0; border: 1px solid #3e4042; flex-direction: column; z-index: 10000; box-shadow: 0 4px 15px rgba(0,0,0,0.4);">
        <div class="chat-header" style="padding: 10px 15px; border-bottom: 1px solid #3e4042; display: flex; align-items: center; justify-content: space-between; background: #242526; border-radius: 8px 8px 0 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <img id="chat-partner-avatar" src="" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">
                <span id="chat-partner-name" style="font-weight: 600; color: #e4e6eb; font-size: 14px;">Tên người dùng</span>
            </div>
            <button onclick="closeModChat()" style="background: none; border: none; color: #b0b3b8; cursor: pointer; font-size: 18px;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div id="chat-messages-body" style="flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; background: #18191a;"></div>
        <div class="chat-input-row" style="padding: 10px; border-top: 1px solid #3e4042; display: flex; gap: 10px; align-items: center;">
            <input type="text" id="chat-input-field" placeholder="Aa" style="flex: 1; background: #3a3b3c; border: none; border-radius: 20px; padding: 8px 15px; color: #e4e6eb; font-size: 14px; outline: none;">
            <button id="send-chat-btn" style="background: none; border: none; color: #00d1b2; cursor: pointer; font-size: 18px;"><i class="fa-solid fa-paper-plane"></i></button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatHtml);

    // Re-bind events for the new injected elements
    const sendBtn = document.getElementById('send-chat-btn');
    const inputField = document.getElementById('chat-input-field');
    if (sendBtn) sendBtn.onclick = sendModChat;
    if (inputField) {
        inputField.onkeypress = (e) => {
            if (e.key === 'Enter') sendModChat();
        };
    }
}

function connectWebSocket() {
    // Kiểm tra xem thư viện đã sẵn sàng chưa
    if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
        console.warn("WebSocket libraries missing. Injecting dynamically...");
        injectScript('https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js', () => {
            injectScript('https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js', () => {
                connectWebSocket();
            });
        });
        return;
    }

    const curToken = window.token || localStorage.getItem('token');
    const myId = window.myUserId || (window.currentModerator ? window.currentModerator.id : null);

    if (!curToken || !myId) {
        console.warn("Missing token or ID, skipping WS connect", { hasToken: !!curToken, myId });
        return;
    }

    if (stompClient && stompClient.connected) return;

    console.log("Attempting WebSocket connection for ID:", myId);
    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.debug = null;
    stompClient.connect({}, function (frame) {
        console.log("WebSocket Connected!");
        stompClient.subscribe(`/topic/messages/${myId}`, function (message) {
            handleIncomingModMessage(JSON.parse(message.body));
        });
        stompClient.subscribe(`/topic/notifications/${myId}`, function (notification) {
            const data = JSON.parse(notification.body);
            window.showToast(data.message || "Bạn có thông báo mới", "success");
            loadNotifications();
            loadMessages();
        });
        stompClient.subscribe(`/topic/review-updates`, function (update) {
            const data = JSON.parse(update.body);
            if (typeof window.handleReviewUpdate === 'function') window.handleReviewUpdate(data);
        });
    }, function (error) {
        console.error("WebSocket Error:", error);
        setTimeout(connectWebSocket, 5000);
    });
}

function injectScript(url, callback) {
    const script = document.createElement('script');
    script.src = url;
    script.onload = callback;
    document.head.appendChild(script);
}

function handleIncomingModMessage(msg) {
    const myId = window.myUserId || (window.currentModerator ? window.currentModerator.id : null);

    if (msg.senderId == myId) return;

    const senderDisplayName = msg.senderName || `Người dùng ${msg.senderId}`;

    // Hiển thị thông báo Toast trên mọi trang
    window.showToast(`Tin nhắn mới từ ${senderDisplayName}`, "info");

    // 1. Tự động chuyển tab sang 'Tin nhắn' trên sidebar (áp dụng cho cả 6 trang)
    const msgTab = document.querySelector('.right-rail-tab[data-rail-tab="messages"]');
    if (msgTab && !msgTab.classList.contains('active')) {
        console.log("Auto-switching to messages tab...");
        msgTab.click();
    }

    // 2. Tự động mở đoạn chat tương ứng lên
    if (typeof window.selectPartner === 'function') {
        window.selectPartner(msg.senderId);
    }

    // 3. Cập nhật danh sách tin nhắn ở sidebar ngay lập tức
    loadMessages();
}

window.selectPartner = async function (id) {
    // Tìm thông tin partner từ list hiện tại hoặc fetch
    try {
        const res = await fetch(`/api/moderator/users`, {
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
        });
        const users = await res.json();
        const user = users.find(u => u.id === id);
        if (user) {
            openModChat(user.id, user.fullName, user.avatar);
        } else {
            // Trường hợp không tìm thấy (có thể là friend không có trong list users)
            const pRes = await fetch(`/api/messages/conversations`, {
                headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
            });
            const convs = await pRes.json();
            const conv = convs.find(c => c.id === id);
            if (conv) openModChat(conv.id, conv.fullName, conv.avatar);
        }
    } catch (e) { console.error(e); }
};

function openModChat(id, name, avatar) {
    currentChatPartnerId = id;
    const chatWindow = document.getElementById('mod-chat-window');
    chatWindow.style.display = 'flex';

    document.getElementById('chat-partner-name').textContent = name;
    document.getElementById('chat-partner-avatar').src = avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00d1b2&color=fff`;

    const body = document.getElementById('chat-messages-body');
    body.innerHTML = '<div style="text-align:center; color:#b0b3b8; font-size:12px;">Đang tải tin nhắn...</div>';

    fetch(`/api/messages/${id}`, {
        headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
    })
        .then(res => res.json())
        .then(messages => {
            body.innerHTML = '';
            window.modLastMessageTimestamp = null; // Reset tracker
            messages.forEach(msg => {
                const isMine = msg.senderId === window.myUserId;
                appendModMessage(msg, isMine);
            });
            scrollToBottom();
            loadMessages(); // Refresh unread count
        });
}

window.closeModChat = function () {
    currentChatPartnerId = null;
    document.getElementById('mod-chat-window').style.display = 'none';
};

function formatModDateSeparator(date) {
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    const day = date.getDate();
    const monthNames = [
        'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
        'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${hours}:${minutes} ${day} ${month}, ${year}`;
}

function appendModMessage(msg, isMine) {
    const body = document.getElementById('chat-messages-body');

    // Date separator logic
    const currentMsgDate = msg.timestamp ? new Date(msg.timestamp) : new Date();
    let needsSeparator = false;

    if (!window.modLastMessageTimestamp) {
        needsSeparator = true;
    } else {
        if (currentMsgDate.toDateString() !== window.modLastMessageTimestamp.toDateString()) {
            needsSeparator = true;
        }
    }

    if (needsSeparator) {
        const separator = document.createElement('div');
        separator.style.textAlign = 'center';
        separator.style.margin = '10px 0';
        separator.style.fontSize = '12px';
        separator.style.color = '#8a8d91';
        separator.innerHTML = `<span>${formatModDateSeparator(currentMsgDate)}</span>`;
        body.appendChild(separator);
    }
    window.modLastMessageTimestamp = currentMsgDate;

    // Message container
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.alignItems = isMine ? 'flex-end' : 'flex-start';
    div.style.marginBottom = '10px';

    const content = document.createElement('div');
    content.textContent = msg.content;
    content.style.background = isMine ? '#00d1b2' : '#3a3b3c';
    content.style.color = '#fff';
    content.style.padding = '8px 12px';
    content.style.borderRadius = '18px';
    content.style.fontSize = '14px';
    content.style.maxWidth = '80%';
    content.style.wordBreak = 'break-word';

    div.appendChild(content);

    // Time string formatting
    let timeStr = "";
    if (msg.timestamp) {
        const d = new Date(msg.timestamp);
        timeStr = ('0' + d.getHours()).slice(-2) + ":" + ('0' + d.getMinutes()).slice(-2);
    } else {
        const d = new Date();
        timeStr = ('0' + d.getHours()).slice(-2) + ":" + ('0' + d.getMinutes()).slice(-2);
    }

    const timeDiv = document.createElement('div');
    timeDiv.textContent = timeStr;
    timeDiv.style.fontSize = '11px';
    timeDiv.style.color = '#8a8d91';
    timeDiv.style.marginTop = '4px';
    timeDiv.style.marginRight = isMine ? '5px' : '0';
    timeDiv.style.marginLeft = isMine ? '0' : '5px';

    div.appendChild(timeDiv);

    body.appendChild(div);
}

function scrollToBottom() {
    const body = document.getElementById('chat-messages-body');
    body.scrollTop = body.scrollHeight;
}

document.getElementById('send-chat-btn').onclick = sendModChat;
document.getElementById('chat-input-field').onkeypress = (e) => {
    if (e.key === 'Enter') sendModChat();
};

function sendModChat() {
    const input = document.getElementById('chat-input-field');
    const content = input.value.trim();
    const myId = window.myUserId || window.currentModerator.id;

    if (!stompClient || !stompClient.connected) {
        window.showToast("Đang kết nối lại máy chủ chat... Vui lòng thử lại sau giây lát.", "warning");
        connectWebSocket();
        return;
    }

    if (!content || !currentChatPartnerId || !myId) return;

    const chatMsg = {
        senderId: myId,
        receiverId: currentChatPartnerId,
        content: content
    };

    try {
        stompClient.send("/app/chat", {}, JSON.stringify(chatMsg));
        appendModMessage(chatMsg, true);
        scrollToBottom();
        input.value = '';
    } catch (e) {
        console.error("Lỗi gửi tin nhắn:", e);
        window.showToast("Lỗi gửi tin nhắn. Đang thử kết nối lại...", "danger");
        connectWebSocket();
    }
}

async function markAllNotificationsRead() {
    try {
        const res = await fetch('/api/notifications/read-all', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
        });

        if (res.ok) {
            await loadNotifications();
        }
    } catch (error) {
        console.error(error);
    }
}


window.addEventListener('beforeunload', function (e) {
    if (!window.postActionTaken && window.currentViewedPostId) {
        navigator.sendBeacon(`/api/moderator/posts/${window.currentViewedPostId}/cancel-processing`, null);
    }
});
window.postActionTaken = false;



window.warnUser = function (id) {
    console.log("DEBUG: Opening warn modal for user:", id);
    const modal = document.getElementById('warn-user-modal');
    const idInput = document.getElementById('warn-user-id');

    if (modal && idInput) {
        idInput.value = id;
        modal.classList.remove('profile-modal-hidden');
        modal.style.setProperty('display', 'flex', 'important');
        modal.style.setProperty('visibility', 'visible', 'important');
        modal.style.setProperty('opacity', '1', 'important');
        modal.style.setProperty('z-index', '10000', 'important');

        // Reset form
        document.getElementById('warn-duration').value = '3';
        const customContainer = document.getElementById('custom-duration-container');
        if (customContainer) customContainer.style.display = 'none';
        const customInput = document.getElementById('warn-custom-value');
        if (customInput) customInput.value = '';
        const customUnit = document.getElementById('warn-custom-unit');
        if (customUnit) customUnit.value = 'DAYS';
    } else {
        console.error("DEBUG: Modal or ID input not found!");
    }
};

window.toggleCustomDuration = function () {
    const durationSelect = document.getElementById('warn-duration');
    const customContainer = document.getElementById('custom-duration-container');
    if (durationSelect && customContainer) {
        if (durationSelect.value === 'custom') {
            customContainer.style.display = 'block';
        } else {
            customContainer.style.display = 'none';
        }
    }
};

window.closeWarnUserModal = function () {
    const modal = document.getElementById('warn-user-modal');
    if (modal) {
        modal.classList.add('profile-modal-hidden');
        modal.style.display = 'none';
    }
};

window.submitUserWarning = async function () {
    const id = document.getElementById('warn-user-id').value;
    const type = document.querySelector('input[name="warn-type"]:checked').value;
    const durationSelect = document.getElementById('warn-duration');
    let days = parseInt(durationSelect.value);
    let unit = 'DAYS';

    if (durationSelect.value === 'custom') {
        days = parseInt(document.getElementById('warn-custom-value').value);
        unit = document.getElementById('warn-custom-unit').value;
        if (isNaN(days) || days <= 0) {
            showCustomAlert('Lỗi', 'Vui lòng nhập thời hạn hợp lệ.', 'error');
            return;
        }
    }

    console.log("DEBUG: Checking for existing warning for user ID:", id, "Type:", type);

    // Tìm user trong cache để kiểm tra thời hạn cũ
    const user = (window.cache.users || []).find(u => u.id == id);
    console.log("DEBUG: User found in cache:", user);

    let existingExpiry = null;
    if (user) {
        existingExpiry = (type === 'POST') ? user.postWarningExpiresAt : user.commentWarningExpiresAt;
        console.log("DEBUG: Existing expiry for", type, ":", existingExpiry);
    }

    const now = new Date();
    // Chuyển đổi existingExpiry sang Date object an toàn hơn
    let expiryDateObj = null;
    if (existingExpiry) {
        expiryDateObj = new Date(existingExpiry);
    }

    const durationText = unit === 'HOURS' ? days + ' giờ' : days + ' ngày';

    if (expiryDateObj && expiryDateObj > now) {
        const expiryStr = expiryDateObj.toLocaleString('vi-VN');
        const typeText = (type === 'POST') ? 'đăng bài' : 'bình luận';

        console.log("DEBUG: Active warning detected. Showing confirm dialog.");
        showCustomConfirm(
            'Cảnh báo đang hoạt động',
            `Người dùng hiện đang bị cấm ${typeText} đến <b>${expiryStr}</b>. Bạn có chắc chắn muốn <b>CỘNG THÊM</b> ${durationText} vào thời hạn này không?`,
            () => performSubmit(id, type, days, unit)
        );
    } else {
        console.log("DEBUG: No active warning or expired. Performing direct submit.");
        performSubmit(id, type, days, unit);
    }
};

async function performSubmit(id, type, days, unit) {
    try {
        const res = await fetch(`/api/moderator/users/${id}/warn`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${window.token || localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type, days, unit })
        });
        if (res.ok) {
            showCustomAlert('Thành công', 'Đã thiết lập cảnh cáo thành công.', 'success');
            closeWarnUserModal();
            if (typeof loadFlaggedUsers === 'function') loadFlaggedUsers();
        } else {
            const msg = await res.text();
            showCustomAlert('Lỗi', msg || 'Không thể thực hiện cảnh cáo', 'error');
        }
    } catch (e) {
        console.error(e);
        showCustomAlert('Lỗi kết nối', 'Không thể kết nối đến máy chủ.', 'error');
    }
}

// ==================== KHÓA / MỞ KHÓA NGƯỜI DÙNG ====================

window.openLockModal = function (id) {
    const modal = document.getElementById('lock-user-modal');
    if (!modal) return;

    document.getElementById('lock-user-id').value = id;

    // Reset form
    document.querySelector('input[name="lock-type"][value="TEMP"]').checked = true;
    document.getElementById('lock-duration').value = '3';
    document.getElementById('lock-custom-value').value = '';
    document.getElementById('lock-custom-unit').value = 'DAYS';
    document.getElementById('lock-reason').value = '';

    toggleLockType();

    modal.style.display = 'flex';
    modal.classList.remove('profile-modal-hidden');
};

window.closeLockUserModal = function () {
    const modal = document.getElementById('lock-user-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('profile-modal-hidden');
    }
};

window.toggleLockType = function () {
    const type = document.querySelector('input[name="lock-type"]:checked').value;
    const durationSection = document.getElementById('lock-duration-section');
    if (type === 'PERM') {
        durationSection.style.display = 'none';
    } else {
        durationSection.style.display = 'block';
        toggleCustomLockDuration();
    }
};

window.toggleCustomLockDuration = function () {
    const durationSelect = document.getElementById('lock-duration');
    const customContainer = document.getElementById('lock-custom-days-container');
    if (durationSelect.value === 'custom') {
        customContainer.style.display = 'block';
    } else {
        customContainer.style.display = 'none';
    }
};

window.submitLockUser = async function () {
    const id = document.getElementById('lock-user-id').value;
    const type = document.querySelector('input[name="lock-type"]:checked').value;
    const reason = document.getElementById('lock-reason').value;

    let days = null;
    let unit = 'DAYS';
    if (type === 'TEMP') {
        const durationSelect = document.getElementById('lock-duration');
        days = parseInt(durationSelect.value);
        if (durationSelect.value === 'custom') {
            days = parseInt(document.getElementById('lock-custom-value').value);
            unit = document.getElementById('lock-custom-unit').value;
            if (isNaN(days) || days <= 0) {
                showCustomAlert('Lỗi', 'Vui lòng nhập thời hạn khóa hợp lệ.', 'error');
                return;
            }
        }
    }

    try {
        const res = await fetch(`/api/moderator/users/${id}/lock`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${window.token || localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type, days, unit, reason })
        });

        if (res.ok) {
            showCustomAlert('Thành công', 'Đã khóa người dùng và gửi email thông báo.', 'success');
            closeLockUserModal();
            if (typeof loadFlaggedUsers === 'function') loadFlaggedUsers();
        } else {
            const msg = await res.text();
            showCustomAlert('Lỗi', msg || 'Không thể khóa người dùng', 'error');
        }
    } catch (e) {
        console.error(e);
        showCustomAlert('Lỗi kết nối', 'Không thể kết nối đến máy chủ.', 'error');
    }
};

// ==================== HỆ THỐNG THÔNG BÁO TOAST TOÀN CẦU ====================
window.showToast = function (message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; bottom: 20px; left: 20px; z-index: 100000; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colors = {
        success: '#2ecc71',
        danger: '#e74c3c',
        warning: '#f1c40f',
        info: '#3498db'
    };
    const icons = {
        success: 'fa-circle-check',
        danger: 'fa-circle-xmark',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
    };

    toast.style.cssText = `
        background: #242526;
        color: #e4e6eb;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 250px;
        border-left: 4px solid ${colors[type] || colors.info};
        animation: toastIn 0.3s ease;
        cursor: pointer;
    `;

    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.info}" style="color: ${colors[type] || colors.info}; font-size: 18px;"></i>
        <div style="font-size: 14px; font-weight: 500;">${message}</div>
    `;

    container.appendChild(toast);

    // Click vào toast để tắt hoặc thực hiện hành động nếu cần
    toast.onclick = () => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    };

    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
};

// Thêm style cho animation toast
const style = document.createElement('style');
style.innerHTML = `
    @keyframes toastIn { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes toastOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-100%); opacity: 0; } }
`;
document.head.appendChild(style);

// ==================== KHỞI TẠO VÀ TIÊM MODAL TOÀN CẦU ====================
async function fetchCurrentModerator() {
    try {
        const res = await fetch('/api/users/profile', {
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
        });
        if (res.ok) {
            const data = await res.json();
            window.currentModerator = { ...window.currentModerator, ...data };
            window.myUserId = data.id; // Alias tiện dụng

            // Cập nhật giao diện header nếu có
            const staffName = document.getElementById('staff-display-name');
            const staffAvatar = document.getElementById('header-avatar');
            if (staffName) staffName.textContent = data.fullName || 'Điều phối viên';
            if (staffAvatar && data.avatar) staffAvatar.src = data.avatar;

            console.log("Moderator profile loaded:", data.id);
            return true;
        }
    } catch (e) {
        console.error("Lỗi tải thông tin cá nhân:", e);
    }
    return false;
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Global Moderator Init Start...");
    injectCommonModals();

    // Tải thông tin cá nhân trước khi kết nối WebSocket
    const loaded = await fetchCurrentModerator();

    if (loaded) {
        connectWebSocket();
        loadNotifications();
        loadMessages();
    } else {
        console.warn("Không thể tải thông tin cá nhân, thử kết nối lại sau...");
        setTimeout(() => window.location.reload(), 3000); // Thử lại sau 3s
    }
});

function injectCommonModals() {
    // 1. Tiêm Khung Chat
    if (!document.getElementById('mod-chat-window')) {
        const chatHtml = `
        <div id="mod-chat-window" class="chat-box" style="display: none; position: fixed; bottom: 20px; right: 350px; width: 330px; height: 450px; background: #242526; border-radius: 8px 8px 0 0; border: 1px solid #3e4042; flex-direction: column; z-index: 10000; box-shadow: 0 4px 15px rgba(0,0,0,0.4);">
            <div class="chat-header" style="padding: 10px 15px; border-bottom: 1px solid #3e4042; display: flex; align-items: center; justify-content: space-between; background: #242526; border-radius: 8px 8px 0 0;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img id="chat-partner-avatar" src="" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">
                    <span id="chat-partner-name" style="font-weight: 600; color: #e4e6eb; font-size: 14px;">Tên người dùng</span>
                </div>
                <button onclick="closeModChat()" style="background: none; border: none; color: #b0b3b8; cursor: pointer; font-size: 18px;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div id="chat-messages-body" style="flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; background: #18191a;"></div>
            <div class="chat-input-row" style="padding: 10px; border-top: 1px solid #3e4042; display: flex; gap: 10px; align-items: center;">
                <input type="text" id="chat-input-field" placeholder="Aa" style="flex: 1; background: #3a3b3c; border: none; border-radius: 20px; padding: 8px 15px; color: #e4e6eb; font-size: 14px; outline: none;">
                <button id="send-chat-btn" onclick="sendModChat()" style="background: none; border: none; color: #00d1b2; cursor: pointer; font-size: 18px;"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', chatHtml);
        const chatInput = document.getElementById('chat-input-field');
        if (chatInput) {
            chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendModChat(); };
        }
    }

    // 2. Tiêm Modal Cảnh cáo (Warn)
    if (!document.getElementById('warn-user-modal')) {
        const warnHtml = `
        <div id="warn-user-modal" class="modal-overlay profile-modal-hidden" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 20000; align-items: center; justify-content: center;">
            <div class="profile-modal-content" style="max-width: 450px; background: #242526; border-radius: 8px; overflow: hidden; box-shadow: 0 12px 28px rgba(0,0,0,0.5);">
                <div class="profile-modal-header" style="padding: 15px 20px; border-bottom: 1px solid #3e4042; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 18px; color: #e4e6eb;">Thiết lập cảnh cáo</h3>
                    <button onclick="closeWarnUserModal()" style="background: none; border: none; color: #b0b3b8; font-size: 24px; cursor: pointer;">&times;</button>
                </div>
                <div class="profile-modal-body" style="padding: 20px;">
                    <input type="hidden" id="warn-user-id">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #e4e6eb;">Hình thức cảnh cáo:</label>
                        <div style="display: flex; gap: 20px;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #e4e6eb;"><input type="radio" name="warn-type" value="POST" checked> Cảnh cáo đăng bài</label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #e4e6eb;"><input type="radio" name="warn-type" value="COMMENT"> Cảnh cáo bình luận</label>
                        </div>
                    </div>
                    <div style="margin-bottom: 25px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #e4e6eb;">Thời hạn cảnh cáo:</label>
                        <select id="warn-duration" onchange="toggleCustomDuration()" style="width: 100%; padding: 10px; background: #3a3b3c; border: 1px solid #4e4f50; border-radius: 6px; color: #e4e6eb;">
                            <option value="3">3 ngày</option><option value="7">7 ngày</option><option value="30">1 tháng (30 ngày)</option><option value="custom">Tùy chọn khác...</option>
                        </select>
                    </div>
                    <div id="custom-duration-container" style="display: none; margin-bottom: 25px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #e4e6eb;">Nhập số ngày:</label>
                        <input type="number" id="warn-custom-days" min="1" style="width: 100%; padding: 10px; background: #3a3b3c; border: 1px solid #4e4f50; border-radius: 6px; color: #e4e6eb;">
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button onclick="closeWarnUserModal()" style="padding: 8px 20px; background: #3a3b3c; color: #e4e6eb; border: none; border-radius: 6px; cursor: pointer;">Hủy</button>
                        <button onclick="submitUserWarning()" style="padding: 8px 20px; background: #f02849; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Gửi cảnh cáo</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', warnHtml);
    }

    // 3. Tiêm Modal Khóa (Lock)
    if (!document.getElementById('lock-user-modal')) {
        const lockHtml = `
        <div id="lock-user-modal" class="profile-modal-overlay profile-modal-hidden" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 20000; align-items: center; justify-content: center;">
            <div class="profile-modal-content" style="background: #242526; width: 450px; border-radius: 12px; overflow: hidden; box-shadow: 0 12px 28px rgba(0,0,0,0.5);">
                <div class="profile-modal-header" style="padding: 15px 20px; border-bottom: 1px solid #3e4042; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 18px; color: #e4e6eb;">Khóa tài khoản người dùng</h3>
                    <button onclick="closeLockUserModal()" style="background: none; border: none; color: #b0b3b8; font-size: 24px; cursor: pointer;">&times;</button>
                </div>
                <div class="profile-modal-body" style="padding: 20px;">
                    <input type="hidden" id="lock-user-id">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #e4e6eb;">Hình thức khóa:</label>
                        <div style="display: flex; gap: 20px;">
                            <label style="color: #e4e6eb; cursor: pointer;"><input type="radio" name="lock-type" value="TEMP" checked onchange="toggleLockType()"> Khóa tạm thời</label>
                            <label style="color: #e4e6eb; cursor: pointer;"><input type="radio" name="lock-type" value="PERM" onchange="toggleLockType()"> Khóa vĩnh viễn</label>
                        </div>
                    </div>
                    <div id="lock-duration-section" style="margin-bottom: 25px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #e4e6eb;">Thời hạn khóa:</label>
                        <select id="lock-duration" onchange="toggleCustomLockDuration()" style="width: 100%; padding: 10px; background: #3a3b3c; border: 1px solid #4e4f50; border-radius: 6px; color: #e4e6eb;">
                            <option value="3">3 ngày</option><option value="7">7 ngày</option><option value="30">1 tháng</option><option value="custom">Tùy chọn...</option>
                        </select>
                        <div id="lock-custom-days-container" style="display: none; margin-top: 15px;">
                            <input type="number" id="lock-custom-days" placeholder="Số ngày" style="width: 100%; padding: 10px; background: #3a3b3c; border: 1px solid #4e4f50; border-radius: 6px; color: #e4e6eb;">
                        </div>
                    </div>
                    <div style="margin-bottom: 25px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 10px; color: #e4e6eb;">Lý do khóa:</label>
                        <textarea id="lock-reason" placeholder="Nhập lý do..." style="width: 100%; height: 80px; padding: 10px; background: #3a3b3c; border: 1px solid #4e4f50; border-radius: 6px; color: #e4e6eb; resize: none;"></textarea>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button onclick="closeLockUserModal()" style="padding: 8px 20px; background: #3a3b3c; color: #e4e6eb; border: none; border-radius: 6px; cursor: pointer;">Hủy</button>
                        <button onclick="submitLockUser()" style="padding: 8px 20px; background: #f02849; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Xác nhận</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', lockHtml);
    }
}

// Global control for opening right sidebar with tab name, or collapsing if already active
window.toggleRightRailTab = function (tabName) {
    const rightRail = document.querySelector('.mod-chat-sidebar');
    const toggleBtn = document.getElementById('toggle-right-rail');

    if (!rightRail) return;

    const isCurrentlyCollapsed = rightRail.classList.contains('collapsed');
    const activeTab = document.querySelector('.right-rail-tab.active');
    const activeTabName = activeTab ? activeTab.getAttribute('data-rail-tab') : null;

    if (isCurrentlyCollapsed) {
        // If collapsed, expand it and focus the correct tab
        rightRail.classList.remove('collapsed');
        if (toggleBtn) toggleBtn.classList.add('active');
        switchTab(tabName);
    } else {
        // If expanded
        if (activeTabName === tabName) {
            // If clicking the active tab button, collapse the sidebar
            rightRail.classList.add('collapsed');
            if (toggleBtn) toggleBtn.classList.remove('active');
        } else {
            // If clicking a different tab, switch to it
            switchTab(tabName);
        }
    }

    function switchTab(target) {
        const tabs = document.querySelectorAll('.right-rail-tab');
        tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-rail-tab') === target));
        document.querySelectorAll('.rail-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `rail-${target}-panel`);
        });
    }
};
