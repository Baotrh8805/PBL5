
window.addEventListener('resize', () => {
    document.querySelectorAll('.overlay-target').forEach(el => {
        if (window.drawMediaBoxes) window.drawMediaBoxes(el);
    });
});

function renderReviewPostsTable(posts) {
    const tbody = document.getElementById('review-posts-list');
    if (!tbody) return;

    const searchInput = document.getElementById('review-search-input');
    const filterSelect = document.getElementById('review-filter-select');
    const aiFilterSelect = document.getElementById('ai-filter-select');

    if (searchInput && !searchInput.dataset.listening) {
        searchInput.dataset.listening = "true";
        const refresh = () => renderReviewPostsTable(window.cache.posts);
        searchInput.addEventListener('input', refresh);
        filterSelect.addEventListener('change', () => {
            if (filterSelect.value === 'AI_REVIEWED') {
                aiFilterSelect.style.display = 'block';
            } else {
                aiFilterSelect.style.display = 'none';
            }
            refresh();
        });
        aiFilterSelect.addEventListener('change', refresh);
    }

    const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const filterVal = filterSelect ? filterSelect.value : 'PENDING_REVIEW';
    const aiFilterVal = aiFilterSelect ? aiFilterSelect.value : 'AI_ALL';

    let reviewPosts = posts.filter(post => {
        const postStatus = String(post.status || '').toUpperCase();
        let statusMatch = false;

        if (filterVal === 'ALL') {
            statusMatch = true;
        } else if (filterVal === 'PENDING_REVIEW') {
            statusMatch = postStatus === 'PENDING_REVIEW' && !post.processingModeratorId;
        } else if (filterVal === 'PROCESSING') {
            statusMatch = postStatus === 'PENDING_REVIEW' && !!post.processingModeratorId;
        } else if (filterVal === 'REVIEWED') {
            // Chỉ hiện các bài đã được MODERATOR (con người) duyệt/xóa
            statusMatch = postStatus !== 'PENDING_REVIEW' && !!post.reviewerName && post.reviewerName !== 'Hệ thống AI';
        } else if (filterVal === 'AI_REVIEWED') {
            const isAIRected = postStatus === 'AUTO_REJECTED';
            const isAIApproved = (postStatus === 'ACTIVE' || postStatus === 'PUBLISHED') && !post.reviewerName;

            if (aiFilterVal === 'AI_ALL') statusMatch = isAIRected || isAIApproved;
            else if (aiFilterVal === 'AI_APPROVED') statusMatch = isAIApproved;
            else if (aiFilterVal === 'AI_REJECTED') statusMatch = isAIRected;
        }

        if (!statusMatch) return false;

        // Chỉ hiện bài có độ vi phạm > 40 đối với các bài CHƯA DUYỆT (Flagged)
        // Các bài đã được AI hoặc Mod duyệt/xóa thì hiện hết để xem lại kết quả
        if (filterVal === 'PENDING_REVIEW' && getViolationRate(post) <= 40) return false;

        if (searchVal) {
            const idMatch = String(post.id) === searchVal || `p-${post.id}` === searchVal || `#p-${post.id}` === searchVal;
            const authorIdMatch = String(post.authorId) === searchVal;
            const authorNameMatch = (post.authorName || '').toLowerCase().includes(searchVal);
            if (!idMatch && !authorIdMatch && !authorNameMatch) return false;
        }

        return true;
    });

    reviewPosts = reviewPosts.sort((a, b) => {
        const rateA = getViolationRate(a);
        const rateB = getViolationRate(b);
        if (rateB !== rateA) {
            return rateB - rateA; // Mức độ giảm dần
        }
        // Thời gian: bài đăng càng sớm hiển thị trước (cũ hơn lên trước)
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }).slice(0, 30);

    const cards = reviewPosts.map(post => {
        const postStatus = String(post.status || '').toUpperCase();
        const violationRate = getViolationRate(post);
        const level = getSeverityLabel(violationRate);
        const mediaLabel = getMediaLabel(post);
        let contentPreview = "(Nội dung trống)";
        let evidencePreview = "Chưa có bằng chứng";
        let violationLabel = "Đang kiểm tra";
        let mediaPreview = "";
        let nsfwBox = "[]";
        let violenBox = "[]";
        let hateWords = "";

        try {
            contentPreview = getContentPreview(post);
            evidencePreview = getEvidencePreview(post);
            violationLabel = escapeHtml(post.violationLabel || getViolationLabelFromScore(post));
            mediaPreview = renderReviewMedia(post);
            nsfwBox = formatBoxValue(post.nsfwBox);
            violenBox = formatBoxValue(post.violenBox);
            hateWords = formatWordList(post.hateSpeechWord);
        } catch (err) {
            console.error("Lỗi khi xử lý dữ liệu bài viết:", post.id, err);
        }

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
                    <div class="review-score-bar" style="height: 8px; margin-bottom: 0;"><div class="review-score-fill danger" style="width: ${Math.min(100, violenScore * 100)}%;"></div></div>
                </div>
            `;
        }
        if (nsfwScore > 0) {
            scoreBarsHtml += `
                <div class="review-score-item" style="margin-bottom: 8px;">
                    <div class="review-score-header" style="font-size: 0.9rem; margin-bottom: 4px; display: flex; justify-content: space-between;"><span>Nội dung nhạy cảm</span><strong>${(nsfwScore * 100).toFixed(1)}%</strong></div>
                    <div class="review-score-bar" style="height: 8px; margin-bottom: 0;"><div class="review-score-fill warning" style="width: ${Math.min(100, nsfwScore * 100)}%;"></div></div>
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
                    <div class="review-score-bar" style="height: 8px; margin-bottom: 0;"><div class="review-score-fill ${fillClass}" style="width: ${Math.min(100, contentHateScore * 100)}%;"></div></div>
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
                    <div class="review-score-bar" style="height: 8px; margin-bottom: 0;"><div class="review-score-fill ${fillClass}" style="width: ${Math.min(100, videoHateScore * 100)}%;"></div></div>
                </div>
            `;
        }

        let lockedAlert = '';
        if (post.processingModeratorId && post.processingModeratorId !== currentModerator.id) {
            lockedAlert = `<div style="background: rgba(230, 126, 34, 0.1); border-left: 4px solid #e67e22; padding: 12px; margin-bottom: 15px; border-radius: 4px; color: #e67e22; font-size: 15px; font-weight: 600;"><i class="fa-solid fa-lock"></i> Đang được xử lý bởi: ${escapeHtml(post.processingModeratorName)}</div>`;
        }

        const isReviewed = postStatus !== 'PENDING_REVIEW';
        let reviewedHeaderHtml = '';
        if (isReviewed) {
            const isDeleted = postStatus === 'DELETED';
            const isRejected = postStatus === 'REJECTED' || postStatus === 'AUTO_REJECTED';
            let statusColor = isRejected ? '#ff4d4f' : '#00d1b2';
            let statusBg = isRejected ? 'rgba(255, 77, 79, 0.1)' : 'rgba(0, 209, 178, 0.1)';
            let statusIcon = isRejected ? 'fa-circle-xmark' : 'fa-circle-check';
            let statusText = postStatus === 'REJECTED' ? 'Xử lý: Xóa bài' : (postStatus === 'AUTO_REJECTED' ? 'Xử lý: Hệ thống tự động xóa' : 'Xử lý: Duyệt bài');

            if (isDeleted) {
                statusColor = '#8c8c8c';
                statusBg = 'rgba(140, 140, 140, 0.1)';
                statusIcon = 'fa-trash-can';
                statusText = 'Trạng thái: NGƯỜI DÙNG TỰ XÓA';
            }

            reviewedHeaderHtml = `
                <div class="reviewed-status-header" style="margin-bottom: 20px; padding: 16px; background: #18191a; border-radius: 12px; border: 2px solid ${statusColor}; display: flex; align-items: center; gap: 18px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                    <div style="font-size: 36px; color: ${statusColor}; display: flex; align-items: center; justify-content: center; width: 50px; height: 50px; background: ${statusBg}; border-radius: 50%;">
                        <i class="fa-solid ${statusIcon}"></i>
                    </div>
                    <div style="flex: 1;">
                        <div style="color: ${statusColor}; font-weight: 900; font-size: 20px; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 4px;">
                            ${statusText}
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 24px; font-size: 14px; color: #b0b3b8;">
                            <span><i class="fa-solid fa-user-shield" style="margin-right: 6px; opacity: 0.8;"></i>Moderator: <strong style="color: #e4e6eb; font-size: 15px;">${escapeHtml(post.reviewerName || 'Hệ thống AI')}</strong></span>
                            <span><i class="fa-solid fa-clock" style="margin-right: 6px; opacity: 0.8;"></i>Thời gian: <strong style="color: #e4e6eb; font-size: 15px;">${post.reviewedAt ? new Date(post.reviewedAt).toLocaleString('vi-VN') : 'Không rõ'}</strong></span>
                        </div>
                    </div>
                </div>
            `;
        }

        const hasMedia = !!(post.imageUrl || post.videoUrl);
        const cardClass = `review-post-card ${hasMedia ? 'has-media' : 'no-media'} ${isReviewed ? 'reviewed' : 'pending'}`;
        const severityBorderColor = (postStatus === 'REJECTED' || postStatus === 'AUTO_REJECTED') ? '#ff4d4f' : '#00d1b2';
        const severityColor = violationRate >= 75 ? '#ff4d4f' : (violationRate >= 50 ? '#faad14' : '#1cc88a');
        const severityStyle = isReviewed 
            ? `border-left: 6px solid ${severityBorderColor};` 
            : `border-left: 6px solid ${severityColor};`;

        return `
        <article class="${cardClass}" style="${severityStyle} position: relative; margin-bottom: 24px;">
            ${reviewedHeaderHtml}
            ${lockedAlert}
            
            <div class="review-card-grid">
                ${hasMedia ? `
                <!-- Column 1: Media Preview -->
                <div class="review-media-column">
                    <span class="review-media-tag-floating"><i class="fa-solid fa-photo-film"></i> ${mediaLabel}</span>
                    <div class="review-media-wrapper">
                        ${mediaPreview}
                    </div>
                </div>
                ` : ''}
                
                <!-- Column 2: Information & Controls Panel -->
                <div class="review-details-column">
                    <!-- Author & Post Header -->
                    <div class="review-author-row" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'User')}&background=F6DE50&color=1a1a1a" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);">
                            <div>
                                <div class="review-author-name" style="font-weight: 700; color: var(--text-primary); font-size: 14px;">${escapeHtml(post.authorName || 'Ẩn danh')}</div>
                                <div class="review-post-time-sub" style="font-size: 11px; color: var(--text-secondary);">${new Date(post.createdAt).toLocaleString('vi-VN')}</div>
                            </div>
                        </div>
                        <div class="review-post-id-badge" style="background: var(--bg-main); border: 1px solid var(--border-color); color: var(--text-secondary); padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">#P-${post.id}</div>
                    </div>
                    
                    <!-- Content & Evidence -->
                    <div class="review-text-boxes" style="margin-bottom: 15px;">
                         <div class="review-content-box-premium" style="margin-bottom: 10px;">
                              <div class="review-box-title" style="font-size: 11px; font-weight: 800; color: var(--mod-primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;"><i class="fa-solid fa-align-left"></i> Nội dung gốc</div>
                              <div class="review-box-content" style="font-size: 13.5px; color: var(--text-primary); line-height: 1.5; word-break: break-word;">${contentPreview}</div>
                         </div>
                         <div class="review-content-box-premium evidence-box">
                              <div class="review-box-title" style="font-size: 11px; font-weight: 800; color: var(--caution-color); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;"><i class="fa-solid fa-magnifying-glass-chart"></i> Bằng chứng vi phạm</div>
                              <div class="review-box-content" style="font-size: 13px; color: var(--text-primary); line-height: 1.5; word-break: break-word;">${evidencePreview}</div>
                         </div>
                    </div>

                    <!-- AI Analysis breakdown -->
                    <div class="review-scores-container" style="margin-bottom: 20px;">
                        <div class="review-box-title" style="font-size: 11px; font-weight: 800; color: var(--danger-color); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;"><i class="fa-solid fa-brain"></i> Điểm phân tích vi phạm AI</div>
                        <div class="review-scores-grid">
                             ${scoreBarsHtml || '<div style="font-size:12px; color:var(--text-secondary); font-style: italic;">Chưa ghi nhận điểm vi phạm từ AI.</div>'}
                        </div>
                    </div>
                    
                    <!-- Actions Group -->
                    <div class="review-actions-premium" style="margin-top: auto; padding-top: 15px; border-top: 1px dashed var(--border-color);">
                         <div class="action-btn-row" style="display: flex; gap: 8px; flex-wrap: wrap;">
                             ${postStatus === 'PENDING_REVIEW'
                             ? (!post.processingModeratorId || post.processingModeratorId == window.currentModerator.id
                                 ? `<button class="btn-action success" onclick="approvePost('${post.id}')" style="padding: 8px 16px; font-size: 13px; font-weight: 700; height: 36px; border-radius: 10px; display: inline-flex; align-items: center; gap: 6px; border: none; cursor: pointer; color: white; background: var(--success-color); transition: all 0.2s;"><i class="fa-solid fa-circle-check"></i> Duyệt bài</button>
                                            <button class="btn-action danger" onclick="deletePost(${post.id})" style="padding: 8px 16px; font-size: 13px; font-weight: 700; height: 36px; border-radius: 10px; display: inline-flex; align-items: center; gap: 6px; border: none; cursor: pointer; color: white; background: var(--danger-color); transition: all 0.2s;"><i class="fa-solid fa-trash-can"></i> Xóa bài</button>`
                                 : ''
                             )
                             : ''
                             }
                             <button class="btn-action detail" onclick="viewPostDetail('${post.id}')"><i class="fa-solid fa-circle-info"></i> Chi tiết</button>
                         </div>
                    </div>
                </div>
            </div>
        </article>
    `;

    }).join('');

    tbody.innerHTML = cards || '<div class="review-empty">Không có bài viết vi phạm nào đang chờ duyệt.</div>';
}

function getMediaLabel(post) {
    if (post.imageUrl && post.videoUrl) return 'Ảnh + Video';
    if (post.imageUrl) return 'Ảnh';
    if (post.videoUrl) return 'Video';
    return 'Bài viết thường';
}

function renderReviewMedia(post) {
    const media = [];
    const containerStyle = 'position: relative; display: inline-block; width: 100%; max-width: 100%; text-align: center; background: #000; overflow: hidden; border-radius: 8px; margin-bottom: 12px;';

    const nsfwBox = post.nsfwBox || '';
    const violenBox = post.violenBox || '';
    const nsfwScore = post.nsfwScore || 0;
    const violenScore = post.violenceScore || 0;
    const dataAttrs = `data-nsfw-box="${escapeHtml(nsfwBox)}" data-violen-box="${escapeHtml(violenBox)}" data-nsfw-score="${nsfwScore}" data-violen-score="${violenScore}"`;

    if (post.imageUrl) {
        media.push(`
            <div class="media-overlay-container" style="${containerStyle}" ${dataAttrs}>
                <img class="review-media overlay-target" src="${escapeHtml(post.imageUrl)}" style="max-height: 400px; width: 100%; object-fit: contain; margin: 0;" alt="Ảnh bài viết" onload="if(window.drawMediaBoxes) window.drawMediaBoxes(this)">
            </div>
        `);
    }

    if (post.videoUrl) {
        let vidUrl = escapeHtml(post.videoUrl);
        let frameLabel = '';

        if (post.highestScoreFrameSecond != null && post.highestScoreFrameSecond >= 0) {
            let frameIdx = post.highestScoreFrameSecond; // Re-purposed column
            let totalFrames = post.totalFramesAnalyzed; // Re-purposed column
            let fps = post.fps || 30; // Default to 30 if missing

            let timeInSec = Math.floor(frameIdx / fps);
            vidUrl += `#t=${timeInSec}`;

            let totalFramesText = totalFrames ? ` / ${totalFrames}` : '';
            frameLabel = `<div style="position: absolute; top: 12px; right: 12px; background: rgba(228, 30, 63, 0.9); color: #fff; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; z-index: 20; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"><i class="fa-solid fa-clock"></i> Khung hình ${frameIdx}${totalFramesText} (Giây thứ ${timeInSec})</div>`;
        }




        const isProcessing = !!post.processingModeratorId;

        media.push(`
            <div class="media-overlay-container" style="${containerStyle}" ${dataAttrs}>
                <video class="review-media overlay-target review-media-video" ${isProcessing ? 'controls' : ''} preload="metadata" playsinline style="max-height: 400px; width: 100%; object-fit: contain; margin: 0; ${isProcessing ? '' : 'pointer-events: none;'}" onloadedmetadata="if(window.drawMediaBoxes) window.drawMediaBoxes(this)">
                    <source src="${vidUrl}">
                    Trình duyệt của bạn không hỗ trợ video.
                </video>
                ${frameLabel}
            </div>
        `);
    }

    return media.length ? `<div>${media.join('')}</div>` : '';
}

window.drawMediaBoxes = function (mediaEl) {
    const container = mediaEl.closest('.media-overlay-container');
    if (!container) return;

    container.querySelectorAll('.dynamic-box').forEach(el => el.remove());

    const nsfwBoxStr = container.getAttribute('data-nsfw-box');
    const violenBoxStr = container.getAttribute('data-violen-box');
    const nsfwScore = parseFloat(container.getAttribute('data-nsfw-score')) || 0;
    const violenScore = parseFloat(container.getAttribute('data-violen-score')) || 0;

    let intrinsicW = mediaEl.videoWidth || mediaEl.naturalWidth;
    let intrinsicH = mediaEl.videoHeight || mediaEl.naturalHeight;

    if (!intrinsicW || !intrinsicH) return;

    const renderedW = mediaEl.offsetWidth;
    const renderedH = mediaEl.offsetHeight;

    const intrinsicRatio = intrinsicW / intrinsicH;
    const renderedRatio = renderedW / renderedH;

    let displayW, displayH, offsetX = 0, offsetY = 0;

    if (intrinsicRatio > renderedRatio) {
        displayW = renderedW;
        displayH = renderedW / intrinsicRatio;
        offsetY = (renderedH - displayH) / 2;
    } else {
        displayH = renderedH;
        displayW = renderedH * intrinsicRatio;
        offsetX = (renderedW - displayW) / 2;
    }

    offsetX += mediaEl.offsetLeft;
    offsetY += mediaEl.offsetTop;

    const drawBox = (boxStr, score, label) => {
        if (!boxStr || boxStr === 'null') return;
        try {
            const parsed = JSON.parse(boxStr);
            let x1, y1, x2, y2;

            if (Array.isArray(parsed) && parsed.length >= 4) {
                [x1, y1, x2, y2] = parsed;
            } else if (parsed && typeof parsed === 'object') {
                x1 = parsed.x1 ?? parsed.left ?? 0;
                y1 = parsed.y1 ?? parsed.top ?? 0;
                x2 = parsed.x2 ?? parsed.right ?? 0;
                y2 = parsed.y2 ?? parsed.bottom ?? 0;
            } else {
                return;
            }

            const scaleX = displayW / intrinsicW;
            const scaleY = displayH / intrinsicH;

            const finalX = offsetX + (x1 * scaleX);
            const finalY = offsetY + (y1 * scaleY);
            const finalW = (x2 - x1) * scaleX;
            const finalH = (y2 - y1) * scaleY;

            const boxDiv = document.createElement('div');
            boxDiv.className = 'dynamic-box';
            boxDiv.style.position = 'absolute';
            boxDiv.style.left = finalX + 'px';
            boxDiv.style.top = finalY + 'px';
            boxDiv.style.width = finalW + 'px';
            boxDiv.style.height = finalH + 'px';
            boxDiv.style.border = '3px solid #ff4d4f';
            boxDiv.style.boxSizing = 'border-box';
            boxDiv.style.pointerEvents = 'none';
            boxDiv.style.zIndex = '15';

            const labelDiv = document.createElement('div');
            labelDiv.style.position = 'absolute';
            labelDiv.style.top = '-25px';
            labelDiv.style.left = '-3px';
            labelDiv.style.background = '#ff4d4f';
            labelDiv.style.color = 'white';
            labelDiv.style.padding = '2px 6px';
            labelDiv.style.fontSize = '12px';
            labelDiv.style.fontWeight = 'bold';
            labelDiv.style.whiteSpace = 'nowrap';
            const scorePercent = (score <= 1 ? score * 100 : score).toFixed(1);
            labelDiv.innerText = `${label} ${scorePercent}%`;

            boxDiv.appendChild(labelDiv);
            container.appendChild(boxDiv);
        } catch (e) { }
    };

    drawBox(nsfwBoxStr, nsfwScore, 'NSFW');
    drawBox(violenBoxStr, violenScore, 'Bạo lực');
};

function getContentPreview(post) {
    const rawContent = (post && post.content) || '';
    if (!rawContent) return '(Nội dung trống)';

    let trimmed = String(rawContent).trim();
    if (trimmed.length > 180) {
        trimmed = trimmed.slice(0, 180) + '...';
    }

    let html = escapeHtml(trimmed);

    // Bôi vàng chữ phát hiện vi phạm
    if (post.hateSpeechWord) {
        const tokens = post.hateSpeechWord.split(' ');
        const violatingWords = [];
        tokens.forEach(t => {
            const match = t.match(/(.*)\[(B-T|I-T)\]$/);
            if (match && match[1]) violatingWords.push(match[1]);
        });

        const uniqueWords = [...new Set(violatingWords)];
        uniqueWords.forEach(word => {
            // giu: global, case-insensitive, unicode boundaries
            const reg = new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}])(${escapeRegExp(word)})(?=[^\\p{L}\\p{M}\\p{N}]|$)`, 'giu');
            html = html.replace(reg, '$1<span style="background-color: yellow; color: black; font-weight: bold;">$2</span>');
        });
    }

    return html;
}

function getEvidencePreview(post) {
    if (!post) return '<span style="color: #b0b3b8; font-style: italic;">Không có vi phạm</span>';

    let hateData = post.hateSpeechWord;
    // Chuyển null/undefined thành chuỗi rỗng
    if (hateData === null || hateData === undefined || hateData === 'null') hateData = '';
    hateData = hateData.trim();

    // Hàm format token: xóa nhãn và bôi vàng
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
                    return `<span style="background-color: yellow; color: black; font-weight: bold; padding: 0 2px; border-radius: 2px;">${escapeHtml(word)}</span>`;
                }
                return escapeHtml(word);
            }
            return escapeHtml(t.replace(/^["']|["']$/g, ''));
        }).join(' ');

        return hasTag ? html : ''; // Trả về rỗng nếu không có tag vi phạm nào
    };

    // 1. Kiểm tra định dạng mới (Video:)(Content:)
    if (hateData.includes('(Video:)') || hateData.includes('(Content:)')) {
        const vMatch = hateData.match(/\(Video:\)(.*?)(?=\s*\(Content:\)|$)/);
        const cMatch = hateData.match(/\(Content:\)(.*)/);
        const videoText = vMatch ? vMatch[1].trim() : '';
        const contentText = cMatch ? cMatch[1].trim() : '';

        const vFormatted = formatTokens(videoText);
        const cFormatted = formatTokens(contentText);

        const sections = [];
        if (vFormatted) sections.push(`<div style="margin-bottom:5px;"><strong style="color:#ffba08;">(Video):</strong> ${vFormatted}</div>`);
        if (cFormatted) sections.push(`<div><strong style="color:#ffba08;">(Content):</strong> ${cFormatted}</div>`);

        if (sections.length > 0) return sections.join('');
    } else if (hateData) {
        // 2. Tương thích ngược với định dạng cũ (không có prefix)
        const formatted = formatTokens(hateData);
        if (formatted) return formatted;
    }

    // 3. Kiểm tra bằng chứng vi phạm khác (NSFW/Violence) - KHÔNG lấy từ post.content
    const otherEvidence = (post.violationEvidence || '').trim();
    if (otherEvidence && otherEvidence !== 'null' && otherEvidence !== post.content) {
        return escapeHtml(otherEvidence);
    }

    // 4. Mặc định là không có vi phạm
    return '<span style="color: #b0b3b8; font-style: italic;">Không có vi phạm</span>';
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
    const scores = [
        post.bestScore, 
        post.nsfwScore, 
        post.violenceScore, 
        post.hateSpeechScore,
        post.hateSpeechContentScore,
        post.hateSpeechVideoScore
    ].map(value => Number(value || 0));

    const maxScore = Math.max(...scores, 0);
    return maxScore <= 1 ? maxScore * 100 : maxScore;
}

async function startProcessingViolation(postId) {
    try {
        const res = await fetch(`/api/moderator/posts/${postId}/start-processing`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const message = await res.text();
            showCustomAlert('Lỗi', message || 'Không thể bắt đầu xử lý vi phạm.', 'error');
            return;
        }

        appendActionLog('Bắt đầu xử lý vi phạm', `#VP-${postId}`);
        await loadDashboardData();
    } catch (error) {
        console.error(error);
        showCustomAlert('Lỗi', 'Không thể bắt đầu xử lý vi phạm.', 'error');
    }
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

window.handleReviewUpdate = function (update) {
    console.log("Review update received:", update);
    const { type, postId, processingModeratorId, processingModeratorName, status } = update;
    const myId = window.myUserId || (window.currentModerator ? window.currentModerator.id : null);

    if (!window.cache || !window.cache.posts) return;

    const postIdx = window.cache.posts.findIndex(p => p.id == postId);

    if (type === 'REVIEW_STARTED') {
        if (postIdx !== -1) {
            window.cache.posts[postIdx].processingModeratorId = processingModeratorId;
            window.cache.posts[postIdx].processingModeratorName = processingModeratorName;
        }
        if (typeof loadDashboardData === 'function') {
            loadDashboardData();
        } else {
            renderReviewPostsTable(window.cache.posts);
        }
    } else if (type === 'REVIEW_CANCELLED') {
        if (postIdx !== -1) {
            window.cache.posts[postIdx].processingModeratorId = null;
            window.cache.posts[postIdx].processingModeratorName = null;
        }
        if (typeof loadDashboardData === 'function') {
            loadDashboardData();
        } else {
            renderReviewPostsTable(window.cache.posts);
        }
    } else if (type === 'REVIEW_COMPLETED') {
        if (postIdx !== -1) {
            window.cache.posts[postIdx].status = status;
            window.cache.posts[postIdx].processingModeratorId = null;
            window.cache.posts[postIdx].reviewedAt = new Date().toISOString();
            window.cache.posts[postIdx].reviewerName = processingModeratorName;
        }
        if (typeof loadDashboardData === 'function') {
            loadDashboardData();
        } else {
            renderReviewPostsTable(window.cache.posts);
        }

        // Nếu mình đang mở modal bài này, và không phải mình là người vừa xử lý xong
        if (window.currentViewedPostId == postId && processingModeratorId != myId) {
            if (typeof window.closeModPostDetailModal === 'function') {
                window.postActionTaken = true; // Để không gọi cancel-processing khi đóng modal
                window.closeModPostDetailModal();
                showCustomAlert('Thông báo', `Bài viết này đã được xử lý bởi ${processingModeratorName || 'Moderator khác'}.`, 'info');
            }
        }
    }
};
