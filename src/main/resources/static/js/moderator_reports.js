let allReportsData = []; // Biến toàn cục lưu trữ dữ liệu gốc để lọc cục bộ

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
}

document.addEventListener('DOMContentLoaded', () => {
    const reportTabs = document.querySelectorAll('.report-tab-btn');
    reportTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            reportTabs.forEach(t => {
                t.classList.remove('active');
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--text-secondary)';
            });
            tab.classList.add('active');
            tab.style.borderBottomColor = 'var(--mod-primary)';
            tab.style.color = 'var(--mod-primary)';

            const type = tab.getAttribute('data-report-type');
            const pc = document.getElementById('report-post-container');
            const cc = document.getElementById('report-comment-container');
            
            if (type === 'POST') {
                if(pc) pc.style.display = 'block';
                if(cc) cc.style.display = 'none';
            } else {
                if(pc) pc.style.display = 'none';
                if(cc) cc.style.display = 'block';
            }
        });
    });
    
    loadReports();
});

async function loadReports() {
    try {
        const res = await fetch('/api/moderator/reports', {
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
        });
        if (res.ok) {
            allReportsData = await res.json(); // Lưu vào biến toàn cục
            updateReportStats(allReportsData);
            filterReports(); // Gọi lọc (mặc định hiển thị hết)
        } else {
            console.error("Không thể tải danh sách báo cáo vi phạm");
        }
    } catch (err) {
        console.error("Lỗi tải báo cáo:", err);
    }
}

function updateReportStats(reports) {
    if (!Array.isArray(reports)) return;
    
    const total = reports.length;
    const pending = reports.filter(r => (r.status || 'PENDING') === 'PENDING').length;
    const resolved = reports.filter(r => (r.status || 'PENDING') === 'RESOLVED').length;
    
    document.getElementById('report-stat-total').textContent = total;
    document.getElementById('report-stat-pending').textContent = pending;
    document.getElementById('report-stat-resolved').textContent = resolved;
}

function filterReports() {
    const query = document.getElementById('report-search-input').value.toLowerCase().trim();
    const status = document.getElementById('report-filter-status').value;
    
    let filtered = allReportsData;

    // 1. Lọc theo trạng thái
    if (status) {
        filtered = filtered.filter(r => (r.status || 'PENDING') === status);
    }

    // 2. Lọc theo từ khóa (ID hoặc Lý do hoặc Tên người báo cáo)
    if (query) {
        filtered = filtered.filter(r => {
            const idMatch = r.id.toString().includes(query);
            const reasonMatch = r.reason && r.reason.toLowerCase().includes(query);
            const reporterMatch = r.reporter && r.reporter.fullName.toLowerCase().includes(query);
            const categoryMatch = r.category && r.category.toLowerCase().includes(query);
            return idMatch || reasonMatch || reporterMatch || categoryMatch;
        });
    }

    renderReportsTable(filtered);
}

function renderReportsTable(reports) {
    const postTbody = document.getElementById('reports-post-list');
    const commentTbody = document.getElementById('reports-comment-list');
    if (!postTbody || !commentTbody) return;

    if (!Array.isArray(reports)) reports = [];

    const postReports = reports.filter(r => r.targetType === 'POST');
    const commentReports = reports.filter(r => r.targetType === 'COMMENT');

    document.getElementById('report-post-count').textContent = `Tìm thấy ${postReports.length} báo cáo bài viết`;
    document.getElementById('report-comment-count').textContent = `Tìm thấy ${commentReports.length} báo cáo bình luận`;

    const renderRow = (report) => {
        const isPost = report.targetType === 'POST';
        const targetObj = isPost ? report.post : report.comment;
        const targetId = targetObj ? targetObj.id : (isPost ? 'Bài viết gốc' : 'Bình luận gốc');
        const postId = isPost ? (targetObj ? targetObj.id : 'null') : (report.comment && report.comment.postId ? report.comment.postId : 'null');
        const reason = report.reason ? escapeHtml(report.reason) : '(Không có lý do)';
        const time = report.createdAt ? new Date(report.createdAt).toLocaleString('vi-VN') : '---';
        
        let statusBadge = '';
        const currentStatus = report.status || 'PENDING';

        if (currentStatus === 'PENDING') {
            statusBadge = `<span class="mod-badge mod-badge-pending">Đang chờ</span>`;
        } else if (currentStatus === 'RESOLVED') {
            statusBadge = `<span class="mod-badge mod-badge-resolved">Đã xử lý</span>`;
        } else {
            statusBadge = `<span class="mod-badge mod-badge-dismissed">Đã bỏ qua</span>`;
        }

        let actions = `
            <div class="action-group" style="display: flex; gap: 8px;">
                <button class="mod-btn-refresh" style="padding: 5px 12px; font-size: 12px; color: var(--mod-primary); border-color: var(--mod-primary);" onclick="openReportDetailModal(${report.id})">
                    Xem
                </button>
                <button class="mod-btn-refresh" style="padding: 5px 12px; font-size: 12px; color: var(--danger-color); border-color: var(--danger-color);" onclick="resolveReport(${report.id}, 'DISMISSED')">
                    Xóa
                </button>
            </div>
        `;

        const targetLabel = targetObj ? (isPost ? 'Bài viết' : 'Bình luận') : (isPost ? '<span style="color:red">Bài viết đã xóa</span>' : '<span style="color:red">Bình luận đã xóa</span>');
        const targetValue = targetObj ? `#${targetId}` : '---';

        return `
            <tr>
                <td><strong>#T-${report.id}</strong><div style="font-size:11px;color:#65676b;">${escapeHtml(report.category || 'Nội dung')}</div></td>
                <td>
                    <div style="font-weight:600;">${report.reporter ? escapeHtml(report.reporter.fullName) : 'Ẩn danh'}</div>
                    <div style="font-size:11px;color:#65676b;">ID: ${report.reporter ? report.reporter.id : '?'}</div>
                </td>
                <td>
                    <div style="font-weight:600;">${targetLabel}</div>
                    <div style="font-size:11px;color:#00d1b2;">${targetValue}</div>
                </td>
                <td><div style="max-width:180px; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${reason}">${reason}</div></td>
                <td><div style="font-size:12px;">${time}</div></td>
                <td>${statusBadge}</td>
                <td>${actions}</td>
            </tr>
        `;
    };

    // Render tables
    postTbody.innerHTML = postReports.length === 0 
        ? '<tr><td colspan="7" class="table-loading">Không có báo cáo nào.</td></tr>' 
        : postReports.map(renderRow).join('');

    commentTbody.innerHTML = commentReports.length === 0 
        ? '<tr><td colspan="7" class="table-loading">Không có báo cáo nào.</td></tr>' 
        : commentReports.map(renderRow).join('');
}

window.openReportDetailModal = function(reportId) {
    console.log("--- openReportDetailModal called with ID:", reportId);
    
    if (!allReportsData || allReportsData.length === 0) {
        console.warn("allReportsData is empty, trying to load...");
    }

    const report = allReportsData.find(r => r.id === reportId);
    if (!report) {
        console.error("Report not found for ID:", reportId);
        window.showToast("Không tìm thấy dữ liệu báo cáo này. Thử làm mới trang.", "error");
        return;
    }

    const modal = document.getElementById('mod-report-detail-modal');
    if (!modal) {
        console.error("CRITICAL: Modal 'mod-report-detail-modal' not found in DOM!");
        alert("Lỗi hệ thống: Không tìm thấy khung hiển thị báo cáo.");
        return;
    }
    
    // Đảm bảo Modal hiện lên bằng mọi giá
    modal.style.display = 'flex';
    modal.classList.remove('profile-modal-hidden');
    modal.setAttribute('aria-hidden', 'false');

    // Reporter Info
    const reporter = report.reporter || { fullName: 'Ẩn danh', id: '?', avatar: '' };
    document.getElementById('rd-reporter-name').textContent = reporter.fullName;
    document.getElementById('rd-reporter-id').textContent = `ID: ${reporter.id}`;
    document.getElementById('rd-reporter-avatar').src = reporter.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reporter.fullName)}&background=00d1b2&color=fff`;

    // Report Info
    document.getElementById('rd-category-badge').textContent = report.category || 'Nội dung';
    document.getElementById('rd-category-badge').className = `mod-badge mod-badge-pending`; 
    document.getElementById('rd-reason').textContent = report.reason || '(Không có lý do)';
    const reportDate = report.createdAt ? new Date(report.createdAt).toLocaleString('vi-VN') : '---';
    document.getElementById('rd-time').innerHTML = `<i class="fa-regular fa-clock"></i> Gửi lúc: ${reportDate}`;

    // Target Info
    const isPost = report.targetType === 'POST';
    const targetObj = isPost ? report.post : report.comment;
    const targetId = targetObj ? targetObj.id : '?';
    const postId = isPost ? (targetObj ? targetObj.id : 'null') : (report.comment && report.comment.postId ? report.comment.postId : 'null');
    
    document.getElementById('rd-target-type').textContent = isPost ? 'Bài viết' : 'Bình luận';
    document.getElementById('rd-target-id').textContent = `Mã số: #${targetId}`;
    
    // Tự động tải nội dung để xem trước
    fetchAndRenderReportedContent(isPost, targetObj, postId);

    // Action Buttons in Modal
    const dismissBtn = document.getElementById('rd-dismiss-btn');
    const resolveBtn = document.getElementById('rd-resolve-btn');
    
    if (report.status === 'PENDING') {
        dismissBtn.style.display = 'block';
        resolveBtn.style.display = 'block';
        dismissBtn.onclick = () => { resolveReport(report.id, 'DISMISSED'); window.closeReportDetailModal(); };
        resolveBtn.onclick = () => { resolveReport(report.id, 'RESOLVED'); window.closeReportDetailModal(); };
    } else {
        dismissBtn.style.display = 'none';
        resolveBtn.style.display = 'none';
    }
};

window.closeReportDetailModal = function() {
    console.log("Closing modal...");
    const modal = document.getElementById('mod-report-detail-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('profile-modal-hidden');
        modal.setAttribute('aria-hidden', 'true');
    }
};

async function fetchAndRenderReportedContent(isPost, targetObj, postId) {
    const bodyEl = document.getElementById('rd-content-body');
    const mediaEl = document.getElementById('rd-content-media');
    const ocrEl = document.getElementById('rd-ocr-content');
    
    // Reset AI scores
    const aiScores = {
        nsfw: document.getElementById('rd-ai-nsfw'),
        violence: document.getElementById('rd-ai-violence'),
        hate: document.getElementById('rd-ai-hate')
    };
    Object.values(aiScores).forEach(el => {
        el.textContent = '0%';
        el.style.color = '#00d1b2';
    });

    if (!targetObj || postId === 'null') {
        bodyEl.innerHTML = `<div style="color: #ef4444; font-weight: 600;"><i class="fa-solid fa-triangle-exclamation"></i> Nội dung gốc đã bị người dùng xóa hoặc không tồn tại.</div>`;
        mediaEl.style.display = 'none';
        ocrEl.textContent = 'Không có bằng chứng do nội dung đã xóa.';
        return;
    }

    bodyEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải nội dung...`;
    mediaEl.style.display = 'none';
    mediaEl.innerHTML = '';
    ocrEl.textContent = 'Đang phân tích bằng chứng...';

    try {
        const res = await fetch(`/api/posts/${postId}`, {
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
        });
        
        if (!res.ok) {
            bodyEl.innerHTML = `<div style="color: #ef4444; font-weight: 600;">Nội dung bài viết gốc không khả dụng.</div>`;
            return;
        }

        const post = await res.json();
        
        // Populate IDs
        document.getElementById('rd-target-id').textContent = `#${post.id}`;
        
        // Populate Author Profile
        const author = post.user || { fullName: 'Ẩn danh', id: '?', avatar: '' };
        document.getElementById('rd-author-name').textContent = author.fullName;
        document.getElementById('rd-author-id-badge').textContent = `ID: ${author.id}`;
        document.getElementById('rd-author-avatar').src = author.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(author.fullName)}&background=f14668&color=fff`;

        // Populate AI Scores
        const updateAiScore = (el, score) => {
            const val = Math.round((score || 0) * 100);
            el.textContent = `${val}%`;
            if (val >= 50) el.style.color = '#f14668'; // Red for high risk
            else el.style.color = '#00d1b2'; // Green for low risk
        };

        updateAiScore(aiScores.nsfw, post.nsfwScore);
        updateAiScore(aiScores.violence, post.violenceScore);
        updateAiScore(aiScores.hate, post.hateSpeechScore);

        // Populate OCR Evidence
        ocrEl.textContent = post.ocrContent || 'Không phát hiện vi phạm chữ viết trong hình ảnh/video.';
        if (post.ocrContent) ocrEl.style.color = '#c53030';

        if (isPost) {
            bodyEl.textContent = post.content || '(Không có nội dung văn bản)';
            if (post.imageUrl) {
                mediaEl.style.display = 'block';
                mediaEl.innerHTML = `<img src="${post.imageUrl}" style="max-width: 100%; max-height: 200px; object-fit: contain; margin-top: 10px; border-radius: 4px;">`;
            } else if (post.videoUrl) {
                mediaEl.style.display = 'block';
                mediaEl.innerHTML = `<video src="${post.videoUrl}" controls style="max-width: 100%; max-height: 200px; margin-top: 10px; border-radius: 4px;"></video>`;
            }
        } else {
            // Là bình luận, targetObj chính là comment
            bodyEl.innerHTML = `
                <div style="margin-bottom: 10px; padding: 10px; background: #fffbeb; border-radius: 6px; border-left: 3px solid #f59e0b;">
                    <strong>Bình luận bị báo cáo:</strong><br>
                    ${escapeHtml(targetObj.content || '')}
                </div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    Nằm trong bài viết: <em>${escapeHtml(post.content ? post.content.substring(0, 50) : '')}...</em>
                </div>
            `;
        }
    } catch (err) {
        console.error("Lỗi fetch nội dung báo cáo:", err);
        bodyEl.innerHTML = `<div style="color: #ef4444;">Lỗi khi tải nội dung.</div>`;
    }
}

window.showModPostDetailModal = async function (postId, highlightCommentId = null) {
    if (!postId || postId === 'null') {
        window.showToast("Không thể tìm thấy ID bài viết gốc.", 'error');
        return;
    }
    // Sử dụng hàm viewPostDetail có sẵn trong moderator_core.js để đồng bộ
    if (typeof window.viewPostDetail === 'function') {
        window.viewPostDetail(postId);
        
        // Nếu là báo cáo comment, hiển thị thông báo bổ sung sau khi modal mở
        if (highlightCommentId) {
            setTimeout(() => {
                window.showToast(`Báo cáo nhắm vào bình luận #${highlightCommentId} trong bài viết này.`, "info");
            }, 500);
        }
    } else {
        console.warn("viewPostDetail not found in core.");
    }
};

window.resolveReport = async function (reportId, status) {
    let note = prompt("Nhập ghi chú xử lý (tùy chọn):");
    if (note === null) return; 

    try {
        const res = await fetch(`/api/moderator/reports/${reportId}/status?status=${status}&adminNote=${encodeURIComponent(note)}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
        });
        if (res.ok) {
            window.showToast('Đã cập nhật trạng thái báo cáo.', 'success');
            loadReports();
        } else {
            window.showToast('Lỗi cập nhật trạng thái.', 'error');
        }
    } catch (err) {
        console.error("Lỗi:", err);
    }
}





