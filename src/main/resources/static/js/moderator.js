/**
 * MODERATOR CONTROL PANEL LOGIC - LC NETWORK
 * Quản lý điều phối, báo cáo và người dùng vi phạm
 */

// 1. KIỂM TRA QUYỀN TRUY CẬP (Global State)
const token = localStorage.getItem('token');
const MOD_LOG_KEY = 'moderator_action_logs_v1';

const dashboardState = {
    pending: 0,
    banned: 0,
    processedToday: 0
};

const cache = {
    posts: [],
    users: []
};

const currentModerator = {
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

if (!token) {
    window.location.href = '/index.html'; // Về trang chủ nếu chưa đăng nhập
}

document.addEventListener('DOMContentLoaded', async () => {
    // Khởi tạo giao diện và dữ liệu
    initTabNavigation();
    initHeaderMenus();
    initRightRailTabs();
    initProfileModal();
    renderLogTable();

    // Tải dữ liệu từ Server
    await fetchUserProfile();
    await Promise.all([loadDashboardData(), loadFlaggedUsers()]);
    await Promise.all([loadNotifications(), loadMessages()]);
    syncDashboardStats();
});

// 2. LOGIC CHUYỂN TAB (Navigation)
function initTabNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            activateTab(targetId);
        });
    });
}

function activateTab(targetId) {
    if (!targetId) return;
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.mod-section');

    navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('data-target') === targetId));
    sections.forEach(s => s.classList.toggle('active', s.id === targetId));

    if (targetId === 'manage-users-view') {
        loadFlaggedUsers();
    }
    if (targetId === 'review-posts-view' || targetId === 'manage-posts-view' || targetId === 'reports-view') {
        loadDashboardData();
    }
    if (targetId === 'statistics-view') {
        renderLogTable();
        syncDashboardStats();
    }
}

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

    if (!fullName) {
        alert('Tên hiển thị không được để trống.');
        return;
    }

    try {
        const res = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
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

        alert('Đã cập nhật thông tin cá nhân thành công!');
        closeProfileModal();
    } catch (error) {
        console.error('Lỗi cập nhật hồ sơ:', error);
        alert('Cập nhật thông tin thất bại. Vui lòng thử lại.');
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
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ avatar: uploadData.imageUrl })
        });

        if (!avatarRes.ok) {
            throw new Error('Cập nhật ảnh đại diện thất bại');
        }

        const avatarImg = document.getElementById('header-avatar');
        if (avatarImg) avatarImg.src = uploadData.imageUrl;

        alert('Đã cập nhật ảnh đại diện thành công!');
    } catch (error) {
        console.error('Lỗi đổi ảnh đại diện:', error);
        alert('Không thể cập nhật ảnh đại diện. Vui lòng thử lại.');
    }
}

async function requestPasswordResetEmail() {
    if (!currentModerator.email) {
        alert('Không tìm thấy email tài khoản để đổi mật khẩu.');
        return;
    }

    try {
        const res = await fetch(`/api/auth/forgot-password?email=${encodeURIComponent(currentModerator.email)}`, {
            method: 'POST'
        });

        if (!res.ok) {
            throw new Error('Không thể gửi yêu cầu đổi mật khẩu');
        }

        alert('Đã gửi email hướng dẫn đổi mật khẩu. Vui lòng kiểm tra hộp thư của bạn.');
    } catch (error) {
        console.error('Lỗi đổi mật khẩu:', error);
        alert('Gửi yêu cầu đổi mật khẩu thất bại. Vui lòng thử lại sau.');
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

// 3. KHỞI TẠO BIỂU ĐỒ (Chart.js)
let modChart = null;
function initStatsChart(solved = 0, pending = 0, banned = 0) {
    const ctx = document.getElementById('miniChart');
    if (!ctx) return;

    if (modChart) modChart.destroy(); // Hủy biểu đồ cũ nếu render lại

    modChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Đã xử lý', 'Đang chờ', 'Đã khóa'],
            datasets: [{
                data: [solved, pending, banned],
                backgroundColor: ['#00d1b2', '#f7b928', '#e41e3f'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } }
            }
        }
    });
}

// 4. API FETCHING (Lấy dữ liệu từ Backend)

// Lấy thông tin cá nhân Moderator
async function fetchUserProfile() {
    try {
        const res = await fetch('/api/users/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const user = await res.json();
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

            currentModerator.fullName = user.fullName || 'Nhân viên điều phối';
            currentModerator.email = user.email || '';
            currentModerator.id = user.id || null;
            currentModerator.avatar = user.avatar || '';
            currentModerator.phoneNumber = user.phoneNumber || '';
            currentModerator.dateOfBirth = user.dateOfBirth || '';
            currentModerator.gender = user.gender || '';
            currentModerator.bio = user.bio || '';
            currentModerator.relationshipStatus = user.relationshipStatus || '';
        }
    } catch (err) { console.error("Lỗi xác thực:", err); }
}

// Tải danh sách bài viết báo cáo khẩn cấp (Dashboard)
async function loadDashboardData() {
    const list = document.getElementById('dashboard-posts-list');
    if (!list) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
        const reviewFeed = document.getElementById('review-posts-list');
        if (reviewFeed) {
            reviewFeed.innerHTML = '<div class="review-empty">Đang tải bài viết cần duyệt...</div>';
        }

        const res = await fetch('/api/moderator/posts', {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
        });
        if (res.ok) {
            const posts = await res.json();
            cache.posts = Array.isArray(posts) ? posts : [];
            renderPostsTable(posts, 'dashboard-posts-list');
            renderReviewPostsTable(posts);
            renderManagePostsTable(posts);

            dashboardState.pending = cache.posts.filter(p => String(p.status).toUpperCase() === 'PENDING_REVIEW').length;
            syncDashboardStats();
        } else {
            cache.posts = [];
            renderReviewPostsTable([]);
            const reviewFeed = document.getElementById('review-posts-list');
            if (reviewFeed) {
                reviewFeed.innerHTML = '<div class="review-empty">Không tải được dữ liệu bài viết cần duyệt.</div>';
            }
        }
        
        await loadReports();
    } catch (err) {
        console.error("Lỗi tải bài viết:", err);
        cache.posts = [];
        renderReviewPostsTable([]);
        const reviewFeed = document.getElementById('review-posts-list');
        if (reviewFeed) {
            reviewFeed.innerHTML = '<div class="review-empty">Không tải được dữ liệu bài viết cần duyệt.</div>';
        }
    }
    finally {
        clearTimeout(timeoutId);
    }
}

// Tải danh sách người dùng bị cờ (Flagged Users)
async function loadFlaggedUsers() {
    const list = document.getElementById('users-list');
    if (!list) return;

    try {
        const res = await fetch('/api/moderator/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const users = await res.json();
            cache.users = Array.isArray(users) ? users : [];
            renderUsersTable(users);

            dashboardState.banned = cache.users.filter(u => String(u.status).toUpperCase() === 'BANNED').length;
            syncDashboardStats();
        }
    } catch (err) { console.error("Lỗi tải người dùng:", err); }
}

// 5. RENDER LOGIC (Hiển thị dữ liệu lên bảng)

function renderPostsTable(posts, elementId) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;

    const pendingPosts = posts
        .filter(post => String(post.status || '').toUpperCase() === 'PENDING_REVIEW')
        .slice(0, 20);

    tbody.innerHTML = pendingPosts.map(post => {
        const violationRate = getViolationRate(post);
        const level = getSeverityLabel(violationRate);
        const startedAt = post.moderationStartedAt;
        const reviewer = post.processingModeratorName;

        return `
        <tr>
            <td>#VP-${post.id}</td>
            <td>#P-${post.id}</td>
            <td><span class="status-badge ${getSeverityClass(level)}">${level}</span></td>
            <td>${formatViolationRate(violationRate)}</td>
            <td>${escapeHtml(post.authorName || 'Ẩn danh')}</td>
            <td>
                ${startedAt
                    ? new Date(startedAt).toLocaleString('vi-VN')
                    : `<button class="btn-action warning" onclick="startProcessingViolation(${post.id})">Bắt đầu xử lý</button>`}
            </td>
            <td>${escapeHtml(reviewer || '(Chưa có)')}</td>
        </tr>
    `;
    }).join('') || '<tr><td colspan="7" class="table-loading">Không có vi phạm nào đang xử lý.</td></tr>';
}

function getViolationRate(post) {
    const scores = [post.bestScore, post.nsfwScore, post.violenceScore, post.hateSpeechScore]
        .map(value => Number(value || 0));

    const maxScore = Math.max(...scores, 0);
    return maxScore <= 1 ? maxScore * 100 : maxScore;
}

function formatViolationRate(rate) {
    return `${Math.max(0, Math.min(100, rate)).toFixed(1)}%`;
}

function getSeverityLabel(rate) {
    if (rate >= 75) return 'Nghiêm trọng';
    if (rate >= 50) return 'Cao';
    if (rate >= 30) return 'Cần duyệt';
    return 'Thấp';
}

function getSeverityClass(level) {
    if (level === 'Nghiêm trọng') return 'danger';
    if (level === 'Cao') return 'warning';
    if (level === 'Cần duyệt') return 'warning';
    return 'success';
}

async function startProcessingViolation(postId) {
    try {
        const res = await fetch(`/api/moderator/posts/${postId}/start-processing`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const message = await res.text();
            alert(message || 'Không thể bắt đầu xử lý vi phạm.');
            return;
        }

        appendActionLog('Bắt đầu xử lý vi phạm', `#VP-${postId}`);
        await loadDashboardData();
    } catch (error) {
        console.error(error);
        alert('Không thể bắt đầu xử lý vi phạm.');
    }
}

function renderReviewPostsTable(posts) {
    const tbody = document.getElementById('review-posts-list');
    if (!tbody) return;

    const reviewPosts = posts
        .filter(post => String(post.status || '').toUpperCase() === 'PENDING_REVIEW' || Boolean(post.violationDetected))
        .slice(0, 15);

    const cards = reviewPosts.map(post => {
        const violationRate = getViolationRate(post);
        const level = getSeverityLabel(violationRate);
        const mediaLabel = getMediaLabel(post);
        const contentPreview = getContentPreview(post.content);
        const evidencePreview = getEvidencePreview(post);
        const violationLabel = escapeHtml(post.violationLabel || getViolationLabelFromScore(post));
        const nsfwBox = formatBoxValue(post.nsfwBox);
        const violenBox = formatBoxValue(post.violenBox);
        const hateWords = formatWordList(post.hateSpeechWord);
        const mediaPreview = renderReviewMedia(post);

        return `
        <article class="review-post-card">
            <div class="review-post-head">
                <div>
                    <div class="review-post-meta">#P-${post.id} • ${escapeHtml(post.authorName || 'Ẩn danh')}</div>
                    <h3>${escapeHtml(post.authorName || 'Ẩn danh')}</h3>
                    <div class="review-post-time">${new Date(post.createdAt).toLocaleString('vi-VN')}</div>
                </div>
                <span class="review-media-tag">${mediaLabel}</span>
            </div>

            ${mediaPreview}

            <div class="review-violation-strip ${Boolean(post.violationDetected) ? 'active' : 'inactive'}">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>${Boolean(post.violationDetected) ? 'Phát hiện vi phạm' : 'Chưa phát hiện vi phạm'}</span>
            </div>

            <div class="review-content-box">
                <div class="review-content-label">Nội dung bài viết</div>
                <div class="review-content-text">${contentPreview}</div>
                <div class="review-violation-snippet">Bằng chứng vi phạm: ${evidencePreview}</div>
            </div>

            <div class="review-score-box">
                <div class="review-score-header">
                    <span>${violationLabel}</span>
                    <strong>${formatViolationRate(violationRate)}</strong>
                </div>
                <div class="review-score-bar">
                    <div class="review-score-fill ${getSeverityClass(level)}" style="width: ${Math.max(8, Math.min(100, violationRate))}%;"></div>
                </div>
                <div class="review-score-details">
                    <span class="score-pill">nsfw_box: ${escapeHtml(nsfwBox)}</span>
                    <span class="score-pill">violen_box: ${escapeHtml(violenBox)}</span>
                    <span class="score-pill">hate_speech_word: ${hateWords}</span>
                </div>
            </div>

            <div class="review-action-group">
                <button class="btn-action warning" onclick="startProcessingViolation(${post.id})">Bắt đầu xử lý</button>
                <button class="btn-action success" onclick="approvePost(${post.id})">Duyệt an toàn</button>
                <button class="btn-action danger" onclick="deletePost(${post.id})">Xóa bài</button>
            </div>
        </article>
    `;
    }).join('');

    tbody.innerHTML = cards || '<div class="review-empty">Không có bài viết nào đang chờ duyệt.</div>';
}

function getMediaLabel(post) {
    if (post.imageUrl && post.videoUrl) return 'Ảnh + Video';
    if (post.imageUrl) return 'Ảnh';
    if (post.videoUrl) return 'Video';
    return 'Bài viết thường';
}

function renderReviewMedia(post) {
    const media = [];

    if (post.imageUrl) {
        media.push(`<img class="review-media" src="${escapeHtml(post.imageUrl)}" alt="Ảnh bài viết">`);
    }

    if (post.videoUrl) {
        media.push(`
            <video class="review-media review-media-video" controls preload="metadata" playsinline>
                <source src="${escapeHtml(post.videoUrl)}">
                Trình duyệt của bạn không hỗ trợ video.
            </video>
        `);
    }

    return media.length ? `<div class="review-media-stack">${media.join('')}</div>` : '';
}

function getContentPreview(content) {
    if (!content) return '(Nội dung trống)';
    const trimmed = String(content).trim();
    return trimmed.length > 180 ? `${escapeHtml(trimmed.slice(0, 180))}...` : escapeHtml(trimmed);
}

function getEvidencePreview(post) {
    const evidence = post.violationEvidence || post.content || '';

    if (!evidence) {
        return 'Chưa có bằng chứng vi phạm được lưu.';
    }

    const trimmed = String(evidence).trim();
    return trimmed.length > 160 ? `${escapeHtml(trimmed.slice(0, 160))}...` : escapeHtml(trimmed);
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

function parseMaybeJson(value) {
    if (value == null) return null;
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function getViolationLabelFromScore(post) {
    const rate = getViolationRate(post);
    if (rate >= 75) return 'Nội dung nhạy cảm';
    if (rate >= 50) return 'Bạo lực';
    if (rate >= 30) return 'Ngôn từ thù ghét';
    return 'Đang kiểm tra';
}

function getScoreBreakdown(post) {
    const items = [
        ['NSFW', post.nsfwScore],
        ['Bạo lực', post.violenceScore],
        ['Hate speech', post.hateSpeechScore]
    ];

    return items.map(([label, score]) => {
        const rate = Number(score || 0);
        const percent = rate <= 1 ? rate * 100 : rate;
        return `<span class="score-pill">${escapeHtml(label)}: ${percent.toFixed(1)}%</span>`;
    }).join('');
}

function getViolationRate(post) {
    const storedRate = Number(post.violationRate);
    if (Number.isFinite(storedRate) && storedRate > 0) {
        return Math.min(100, storedRate);
    }

    const scores = [post.bestScore, post.nsfwScore, post.violenceScore, post.hateSpeechScore]
        .map(value => Number(value || 0));

    const maxScore = Math.max(...scores, 0);
    return maxScore <= 1 ? maxScore * 100 : maxScore;
}

function renderManagePostsTable(posts) {
    const tbody = document.getElementById('manage-posts-list');
    if (!tbody) return;

    const rows = posts.slice(0, 30).map(post => `
        <tr>
            <td>#P-${post.id}</td>
            <td>${escapeHtml(post.authorName || 'Ẩn danh')}</td>
            <td title="${escapeHtml(post.content || '')}">${post.content ? escapeHtml(post.content.substring(0, 42)) + '...' : '(Nội dung trống)'}</td>
            <td>${post.likeCount || 0} thích • ${post.commentCount || 0} bình luận</td>
            <td>
                <div class="action-group">
                    <button class="btn-action warning" onclick="approvePost(${post.id})">Duyệt</button>
                    <button class="btn-action danger" onclick="deletePost(${post.id})">Xóa</button>
                </div>
            </td>
        </tr>
    `).join('');

    tbody.innerHTML = rows || '<tr><td colspan="5" class="table-loading">Chưa có bài viết nào.</td></tr>';
}

async function loadReports() {
    try {
        const res = await fetch('/api/moderator/reports', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const reports = await res.json();
            renderReportsTable(reports);
        } else {
            console.error("Không thể tải danh sách báo cáo vi phạm");
        }
    } catch (err) {
        console.error("Lỗi tải báo cáo:", err);
    }
}

function renderReportsTable(reports) {
    const postTbody = document.getElementById('reports-post-list');
    const commentTbody = document.getElementById('reports-comment-list');
    if (!postTbody || !commentTbody) return;

    if (!Array.isArray(reports)) reports = [];

    const postReports = reports.filter(r => r.targetType === 'POST');
    const commentReports = reports.filter(r => r.targetType === 'COMMENT');

    // Render Post Reports
    if (postReports.length === 0) {
        postTbody.innerHTML = '<tr><td colspan="4" class="table-loading">Không có báo cáo bài viết nào.</td></tr>';
    } else {
        postTbody.innerHTML = postReports.slice(0, 15).map(report => {
            const content = report.reason ? escapeHtml(report.reason.substring(0, 36)) : '(Không có lý do)';
            const targetId = report.post ? report.post.id : '?';
            let actions = '';
            if (report.status === 'PENDING') {
                actions = `
                    <div class="action-group">
                        <button class="btn-action primary" title="Xem chi tiết" onclick="showModPostDetailModal(${targetId})"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn-action warning" onclick="resolveReport(${report.id}, 'DISMISSED')">Bỏ qua</button>
                        <button class="btn-action danger" onclick="resolveReport(${report.id}, 'RESOLVED')">Xử lý</button>
                    </div>
                `;
            } else {
                actions = `<span class="status-badge ${report.status === 'RESOLVED' ? 'success' : 'warning'}">${report.status === 'RESOLVED' ? 'Đã xử lý' : 'Đã bỏ qua'}</span>
                           <button class="btn-action primary" style="margin-left:5px;" title="Xem chi tiết" onclick="showModPostDetailModal(${targetId})"><i class="fa-solid fa-eye"></i></button>`;
            }
            return `
                <tr>
                    <td>#R-${report.id} <br> <small style="color: #65676b;">${escapeHtml(report.category || 'Khác')}</small></td>
                    <td>Bài viết (#${targetId}) <br> <small>Báo cáo bởi: ${report.reporter ? escapeHtml(report.reporter.fullName) : 'Ẩn danh'}</small></td>
                    <td title="${escapeHtml(report.reason || '')}">${content}${report.reason && report.reason.length > 36 ? '...' : ''}</td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');
    }

    // Render Comment Reports
    if (commentReports.length === 0) {
        commentTbody.innerHTML = '<tr><td colspan="4" class="table-loading">Không có báo cáo bình luận nào.</td></tr>';
    } else {
        commentTbody.innerHTML = commentReports.slice(0, 15).map(report => {
            const content = report.reason ? escapeHtml(report.reason.substring(0, 36)) : '(Không có lý do)';
            const targetId = report.comment ? report.comment.id : '?';
            const postId = report.comment && report.comment.postId ? report.comment.postId : 'null';
            let actions = '';
            if (report.status === 'PENDING') {
                actions = `
                    <div class="action-group">
                        <button class="btn-action primary" title="Xem chi tiết gốc" onclick="showModPostDetailModal(${postId}, ${targetId})"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn-action warning" onclick="resolveReport(${report.id}, 'DISMISSED')">Bỏ qua</button>
                        <button class="btn-action danger" onclick="resolveReport(${report.id}, 'RESOLVED')">Xử lý</button>
                    </div>
                `;
            } else {
                actions = `<span class="status-badge ${report.status === 'RESOLVED' ? 'success' : 'warning'}">${report.status === 'RESOLVED' ? 'Đã xử lý' : 'Đã bỏ qua'}</span>
                           <button class="btn-action primary" style="margin-left:5px;" title="Xem chi tiết" onclick="showModPostDetailModal(${postId}, ${targetId})"><i class="fa-solid fa-eye"></i></button>`;
            }
            return `
                <tr>
                    <td>#R-${report.id} <br> <small style="color: #65676b;">${escapeHtml(report.category || 'Khác')}</small></td>
                    <td>Bình luận (#${targetId}) <br> <small>Báo cáo bởi: ${report.reporter ? escapeHtml(report.reporter.fullName) : 'Ẩn danh'}</small></td>
                    <td title="${escapeHtml(report.reason || '')}">${content}${report.reason && report.reason.length > 36 ? '...' : ''}</td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');
    }
}

// Thêm sự kiện click cho các tab báo cáo
document.addEventListener('DOMContentLoaded', () => {
    const reportTabs = document.querySelectorAll('.report-tab-btn');
    reportTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            reportTabs.forEach(t => {
                t.classList.remove('active');
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--text-muted)';
            });
            tab.classList.add('active');
            tab.style.borderBottomColor = 'var(--primary)';
            tab.style.color = 'var(--primary)';
            
            const type = tab.getAttribute('data-report-type');
            if (type === 'POST') {
                document.getElementById('report-post-container').style.display = 'block';
                document.getElementById('report-comment-container').style.display = 'none';
            } else {
                document.getElementById('report-post-container').style.display = 'none';
                document.getElementById('report-comment-container').style.display = 'block';
            }
        });
    });
});

window.showModPostDetailModal = async function(postId, highlightCommentId = null) {
    if (!postId || postId === 'null') {
        alert("Không thể tìm thấy ID bài viết gốc.");
        return;
    }
    
    try {
        const res = await fetch(`/api/posts/${postId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            alert('Bài viết không tồn tại hoặc đã bị xóa.');
            return;
        }
        const post = await res.json();
        
        document.getElementById('mod-post-modal-author').textContent = post.authorName || 'Ẩn danh';
        const avatarUrl = post.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'User')}&background=00d1b2&color=fff`;
        document.getElementById('mod-post-modal-avatar').src = avatarUrl;
        document.getElementById('mod-post-modal-time').textContent = new Date(post.createdAt).toLocaleString('vi-VN');
        
        document.getElementById('mod-post-modal-content').textContent = post.content || '';
        
        const mediaContainer = document.getElementById('mod-post-modal-media');
        mediaContainer.innerHTML = '';
        if (post.imageUrl) {
            mediaContainer.innerHTML = `<img src="${post.imageUrl}" style="max-width: 100%; max-height: 400px; object-fit: contain;">`;
        } else if (post.videoUrl) {
            mediaContainer.innerHTML = `<video src="${post.videoUrl}" controls style="max-width: 100%; max-height: 400px;"></video>`;
        }
        
        if (highlightCommentId) {
            const commentNote = document.createElement('div');
            commentNote.style.padding = '10px';
            commentNote.style.background = 'rgba(240, 40, 73, 0.1)';
            commentNote.style.borderLeft = '3px solid #f02849';
            commentNote.style.marginTop = '15px';
            commentNote.style.fontSize = '14px';
            commentNote.innerHTML = `<strong>Lưu ý:</strong> Báo cáo này nhắm vào bình luận (ID: #${highlightCommentId}) trong bài viết trên. (Tính năng hiển thị chi tiết bình luận vi phạm đang được cập nhật).`;
            document.getElementById('mod-post-modal-content').appendChild(commentNote);
        }
        
        const modal = document.getElementById('mod-post-detail-modal');
        modal.classList.remove('profile-modal-hidden');
        modal.setAttribute('aria-hidden', 'false');
    } catch (err) {
        console.error("Lỗi xem chi tiết bài viết:", err);
    }
};

window.closeModPostDetailModal = function() {
    const modal = document.getElementById('mod-post-detail-modal');
    modal.classList.add('profile-modal-hidden');
    modal.setAttribute('aria-hidden', 'true');
    
    // Stop any playing video
    const video = modal.querySelector('video');
    if (video) video.pause();
};

window.resolveReport = async function(reportId, status) {
    let note = prompt("Nhập ghi chú cho báo cáo này (tùy chọn):");
    if (note === null) return; // user cancelled

    try {
        const res = await fetch(`/api/moderator/reports/${reportId}/status?status=${status}&adminNote=${encodeURIComponent(note)}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            alert('Đã cập nhật trạng thái báo cáo.');
            loadReports();
        } else {
            alert('Lỗi cập nhật trạng thái: ' + await res.text());
        }
    } catch (err) {
        console.error("Lỗi:", err);
    }
};

function renderUsersTable(users) {
    const tbody = document.getElementById('users-list');
    if (!tbody) return;

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="user-cell">
                    <img src="${user.avatar || 'https://ui-avatars.com/api/?name=User'}" width="35">
                    <span>${user.fullName}</span>
                </div>
            </td>
            <td>${escapeHtml(user.email || '(Trống)')}</td>
            <td>${user.status === 'BANNED' ? '<span class="text-danger">Đã khóa</span>' : 'Bình thường'}</td>
            <td>${escapeHtml(user.role || 'USER')}</td>
            <td>
                <div class="action-group">
                    <button class="btn-action warning" onclick="warnUser(${user.id})">Cảnh cáo</button>
                    <button class="btn-action danger" onclick="banUser(${user.id})">Khóa</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function loadNotifications() {
    const container = document.getElementById('notifications-list');
    if (!container) return;

    try {
        const res = await fetch('/api/notifications', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Không tải được thông báo');

        const notifications = await res.json();
        if (!Array.isArray(notifications) || notifications.length === 0) {
            container.innerHTML = '<div class="rail-empty">Không có thông báo mới.</div>';
            return;
        }

        container.innerHTML = notifications.slice(0, 12).map(item => `
            <div class="rail-item ${item.isRead ? '' : 'unread'}">
                <div class="rail-item-icon">
                    <i class="fa-solid fa-bell"></i>
                </div>
                <div class="rail-item-body">
                    <div class="rail-item-title">${escapeHtml(item.senderName || 'Hệ thống')}</div>
                    <div class="rail-item-text">${escapeHtml(item.message || '')}</div>
                    <div class="rail-item-meta">${new Date(item.createdAt).toLocaleString('vi-VN')}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error(error);
        container.innerHTML = '<div class="rail-empty">Không tải được thông báo.</div>';
    }
}

async function loadMessages() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    try {
        const res = await fetch('/api/messages/conversations', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Không tải được tin nhắn');

        const conversations = await res.json();
        if (!Array.isArray(conversations) || conversations.length === 0) {
            container.innerHTML = '<div class="rail-empty">Chưa có cuộc trò chuyện nào.</div>';
            return;
        }

        container.innerHTML = conversations.slice(0, 12).map(item => `
            <div class="rail-item">
                <img class="rail-avatar" src="${item.avatar || 'https://ui-avatars.com/api/?name=User'}" alt="Avatar">
                <div class="rail-item-body">
                    <div class="rail-item-title">${escapeHtml(item.fullName || 'Người dùng')}</div>
                    <div class="rail-item-text">Mở để xem lịch sử chat</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error(error);
        container.innerHTML = '<div class="rail-empty">Không tải được tin nhắn.</div>';
    }
}

async function markAllNotificationsRead() {
    try {
        const res = await fetch('/api/notifications/read-all', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            await loadNotifications();
        }
    } catch (error) {
        console.error(error);
    }
}

function syncDashboardStats() {
    dashboardState.processedToday = getTodayActionCount();

    const pendingEl = document.getElementById('stat-pending-count');
    const bannedEl = document.getElementById('stat-banned-count');
    const processedEl = document.getElementById('stat-processed-today');

    if (pendingEl) pendingEl.textContent = String(dashboardState.pending);
    if (bannedEl) bannedEl.textContent = String(dashboardState.banned);
    if (processedEl) processedEl.textContent = String(dashboardState.processedToday);

    const logActionsEl = document.getElementById('log-actions-today');
    const logPendingEl = document.getElementById('log-pending-posts');
    const logBannedEl = document.getElementById('log-banned-users');

    if (logActionsEl) logActionsEl.textContent = String(dashboardState.processedToday);
    if (logPendingEl) logPendingEl.textContent = String(dashboardState.pending);
    if (logBannedEl) logBannedEl.textContent = String(dashboardState.banned);

    initStatsChart(dashboardState.processedToday, dashboardState.pending, dashboardState.banned);
}

function renderLogTable() {
    const tbody = document.getElementById('logs-list');
    if (!tbody) return;

    const logs = getActionLogs();
    if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="table-loading">Chưa có thao tác nào trong hôm nay.</td></tr>';
        return;
    }

    tbody.innerHTML = logs.slice(0, 20).map(item => `
        <tr>
            <td>${new Date(item.time).toLocaleString('vi-VN')}</td>
            <td>${escapeHtml(item.action)}</td>
            <td>${escapeHtml(item.target)}</td>
        </tr>
    `).join('');
}

function getActionLogs() {
    try {
        const raw = localStorage.getItem(MOD_LOG_KEY);
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveActionLogs(logs) {
    localStorage.setItem(MOD_LOG_KEY, JSON.stringify(logs));
}

function appendActionLog(action, target) {
    const logs = getActionLogs();
    logs.unshift({
        time: new Date().toISOString(),
        action,
        target
    });
    saveActionLogs(logs.slice(0, 200));
    renderLogTable();
    syncDashboardStats();
}

function getTodayActionCount() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const prefix = `${yyyy}-${mm}-${dd}`;

    return getActionLogs().filter(item => String(item.time || '').startsWith(prefix)).length;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// 6. THAO TÁC ĐIỀU PHỐI (Actions)

window.deletePost = async (id) => {
    if (!confirm("Xóa bài viết này?")) return;
    const res = await fetch(`/api/moderator/posts/${id}`, { 
        method: 'DELETE', 
        headers: { 'Authorization': `Bearer ${token}` } 
    });
    if (res.ok) {
        appendActionLog('Xóa bài viết', `#P-${id}`);
        loadDashboardData();
    }
};

window.approvePost = (id) => {
    appendActionLog('Duyệt bài viết', `#P-${id}`);
    alert(`Đã ghi nhận duyệt bài viết #P-${id}`);
};

window.warnUser = async (id) => {
    if (!confirm("Cảnh cáo tài khoản này?")) return;
    const res = await fetch(`/api/moderator/users/${id}/warn`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
        appendActionLog('Cảnh cáo người dùng', `#USER-${id}`);
        loadFlaggedUsers();
    }
};

window.banUser = async (id) => {
    if (!confirm("Khóa tài khoản này?")) return;
    const res = await fetch(`/api/moderator/users/${id}/ban`, { 
        method: 'PUT', 
        headers: { 'Authorization': `Bearer ${token}` } 
    });
    if (res.ok) {
        appendActionLog('Khóa người dùng', `#USER-${id}`);
        loadFlaggedUsers();
    }
};

window.markReviewed = (id) => {
    appendActionLog('Đánh dấu đã xem báo cáo', `#R-${id}`);
};

window.logout = function() {
    localStorage.removeItem('token');
    window.location.href = '/index.html';
};

document.addEventListener('DOMContentLoaded', () => {
    const markAllBtn = document.getElementById('mark-all-notifications-read');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', markAllNotificationsRead);
    }
});