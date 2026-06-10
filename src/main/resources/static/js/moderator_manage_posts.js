function renderManagePostsFeed(posts) {
    const container = document.getElementById('manage-posts-feed');
    if (!container) return;

    // Search & Filter listeners
    const searchInput = document.getElementById('manage-search-input');
    const typeFilter = document.getElementById('manage-type-filter');
    const visibilityFilter = document.getElementById('manage-visibility-filter');

    if (searchInput && !searchInput.dataset.listening) {
        searchInput.dataset.listening = "true";
        const update = () => renderManagePostsFeed(window.cache.posts);
        searchInput.addEventListener('input', update);
        if (typeFilter) typeFilter.addEventListener('change', update);
        if (visibilityFilter) visibilityFilter.addEventListener('change', update);
    }

    const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const typeVal = typeFilter ? typeFilter.value : 'ALL';
    const visibilityVal = visibilityFilter ? visibilityFilter.value : 'ALL';

    let filteredPosts = posts.filter(post => {
        // Search
        let searchMatch = true;
        if (searchVal) {
            const idMatch = String(post.id) == searchVal || `p-${post.id}` == searchVal || `#p-${post.id}` == searchVal;
            const authorIdMatch = String(post.authorId) === searchVal || `u-${post.authorId}` === searchVal;
            const authorNameMatch = (post.authorName || '').toLowerCase().includes(searchVal);
            searchMatch = idMatch || authorIdMatch || authorNameMatch;
        }

        // Type
        let typeMatch = true;
        const postStatus = String(post.status || '').toUpperCase();
        if (typeVal === 'NORMAL') {
            // Bài viết bình thường là những bài AI xác định an toàn (ACTIVE)
            typeMatch = postStatus === 'ACTIVE';
        } else if (typeVal === 'REVIEW') {
            // Bài viết kiểm tra bao gồm tất cả các bài có trong tab Duyệt bài viết 
            // (Chờ duyệt, Đã duyệt, Đã xóa/Gỡ)
            typeMatch = postStatus !== 'ACTIVE';
        }

        // Visibility
        let visibilityMatch = true;
        if (visibilityVal !== 'ALL') visibilityMatch = post.visibility === visibilityVal;

        return searchMatch && typeMatch && visibilityMatch;
    });

    const cards = filteredPosts.slice(0, 100).map(post => {
        const authorAvatar = post.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'User')}&background=F6DE50&color=1a1a1a`;
        const postTime = typeof timeSince === 'function' ? timeSince(post.createdAt) : 'Vừa xong';
        
        let mediaHtml = '';
        if (post.imageUrl) mediaHtml += `<div class="post-media-container" style="margin-bottom: 12px; text-align: center; background: #000; border-radius: 8px; overflow: hidden;"><img src="${escapeHtml(post.imageUrl)}" style="max-height: 400px; width: 100%; object-fit: contain; display: block; margin: 0 auto;"></div>`;
        if (post.videoUrl) mediaHtml += `<div class="post-media-container" style="margin-bottom: 12px; text-align: center; background: #000; border-radius: 8px; overflow: hidden;"><video src="${escapeHtml(post.videoUrl)}" controls style="max-height: 400px; width: 100%; object-fit: contain; display: block; margin: 0 auto;"></video></div>`;

        const postStatus = String(post.status || '').toUpperCase();
        const isRejected = postStatus === 'REJECTED' || postStatus === 'AUTO_REJECTED';
        const isDeleted = postStatus === 'DELETED';
        const isPending = postStatus === 'PENDING_REVIEW';
        
        let statusLabel = '';
        if (isDeleted) statusLabel = `<span style="font-size: 11px; color: #8c8c8c; font-weight: 800; background: rgba(140, 140, 140, 0.1); padding: 2px 8px; border-radius: 4px; margin-left: 10px; border: 1px solid #8c8c8c;">NGƯỜI DÙNG XÓA</span>`;
        else if (isRejected) statusLabel = `<span style="font-size: 11px; color: #ff4d4f; font-weight: 800; background: rgba(255, 77, 79, 0.1); padding: 2px 8px; border-radius: 4px; margin-left: 10px; border: 1px solid #ff4d4f;">ĐÃ GỠ</span>`;
        else if (!isPending) statusLabel = `<span style="font-size: 11px; color: #00d1b2; font-weight: 800; background: rgba(0, 209, 178, 0.1); padding: 2px 8px; border-radius: 4px; margin-left: 10px; border: 1px solid #00d1b2;">ĐÃ DUYỆT</span>`;

        let auditHtml = '';
        if (post.reviewerName) {
            auditHtml = `<div style="margin-bottom: 15px; font-size: 13px; color: #00d1b2; font-weight: 600; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-user-check"></i> Được duyệt bởi ${escapeHtml(post.reviewerName)}</div>`;
        }

        let actionButtons = '';
        if (isDeleted) {
            actionButtons = '';
        } else if (isRejected) {
            actionButtons = `<button class="btn-action success" onclick="restorePost('${post.id}')" style="padding: 8px 16px; font-size: 14px; font-weight: 600;"><i class="fa-solid fa-rotate-left"></i> Khôi phục</button>`;
        } else {
            actionButtons = `
                ${isPending ? `<button class="btn-action success" onclick="approvePost('${post.id}')" style="padding: 8px 16px; font-size: 14px; font-weight: 600;">Duyệt</button>` : ''}
                <button class="btn-action danger" onclick="deletePost('${post.id}')" style="padding: 8px 16px; font-size: 14px; font-weight: 600;">Xóa bài</button>
            `;
        }

        return `
            <article class="card post" style="margin-bottom: 30px; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <div class="post-header" style="display: flex; align-items: center; gap: 15px; margin-bottom: 18px;">
                    <img src="${authorAvatar}" alt="Avatar" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid #e4e6eb;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 5px;">
                            <h4 style="margin: 0; font-size: 17px; font-weight: 700; color: #1c1e21;">${escapeHtml(post.authorName || 'Ẩn danh')} <span style="font-weight: 400; color: #65676b; font-size: 13px;">(ID: ${post.authorId || '?'})</span></h4>
                            ${statusLabel}
                        </div>
                        <div style="font-size: 13px; color: #65676b; margin-top: 4px; display: flex; align-items: center; gap: 10px;">
                            <span><i class="fa-solid fa-hashtag"></i> P-${post.id}</span>
                            <span>•</span>
                            <span><i class="fa-solid fa-clock"></i> ${postTime}</span>
                            <span>•</span>
                            <span>${post.visibility === 'PUBLIC' ? '<i class="fa-solid fa-earth-americas"></i>' : (post.visibility === 'FRIENDS' ? '<i class="fa-solid fa-user-group"></i>' : '<i class="fa-solid fa-lock"></i>')}</span>
                        </div>
                    </div>
                    <div class="post-actions" style="display: flex; gap: 10px;">
                        ${actionButtons}
                    </div>
                </div>

                <div class="post-content" style="margin-bottom: 15px; font-size: 16px; line-height: 1.6; color: #1c1e21; white-space: pre-wrap;">${escapeHtml(post.content || '(Nội dung trống)')}</div>
                
                ${mediaHtml}
                
                ${auditHtml}

                <div class="post-footer" style="padding-top: 15px; border-top: 1px solid #e4e6eb; display: flex; gap: 30px; color: #65676b; font-size: 14px; align-items: center;">
                    <span title="Lượt thích"><i class="fa-solid fa-thumbs-up" style="color: #3498db;"></i> <strong>${post.likeCount || 0}</strong></span>
                    <span title="Bình luận"><i class="fa-solid fa-comment" style="color: #00d1b2;"></i> <strong>${post.commentCount || 0}</strong></span>
                    <button class="btn-action detail" style="margin-left: auto; position: relative; z-index: 999;" onclick="viewPostDetail('${post.id}')">
                        <i class="fa-solid fa-circle-info"></i> Xem chi tiết
                    </button>
                </div>
            </article>
        `;
    }).join('');

    container.innerHTML = cards || '<div class="review-empty">Không tìm thấy bài viết nào phù hợp với bộ lọc hiện tại.</div>';
}

window.hidePostAdmin = async function(id) {
    showCustomConfirm('Ẩn bài viết', 'Bạn có chắc chắn muốn ẨN bài viết này? Bài viết sẽ không hiển thị trên bảng tin công cộng nhưng không tính điểm vi phạm cho người dùng.', async () => {
        try {
            const res = await fetch(`/api/moderator/posts/${id}/hide`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
            });
            if (res.ok) {
                showCustomAlert('Thành công', 'Đã ẩn bài viết thành công.', 'success');
                if (typeof loadDashboardData === 'function') loadDashboardData();
            } else {
                const msg = await res.text();
                showCustomAlert('Lỗi', msg || 'Lỗi khi ẩn bài viết.', 'error');
            }
        } catch (e) {
            console.error(e);
            showCustomAlert('Lỗi kết nối', 'Không thể kết nối đến máy chủ.', 'error');
        }
    });
};

window.restorePost = async function(id) {
    showCustomConfirm('Khôi phục bài viết', 'Bạn có chắc chắn muốn KHÔI PHỤC bài viết này? Người dùng sẽ được TRỪ 1 điểm vi phạm vì bài viết đã được xác định là hợp lệ.', async () => {
        try {
            const res = await fetch(`/api/moderator/posts/${id}/restore`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${window.token || localStorage.getItem('token')}` }
            });
            if (res.ok) {
                showCustomAlert('Thành công', 'Đã khôi phục bài viết và trừ điểm vi phạm thành công.', 'success');
                if (typeof loadDashboardData === 'function') loadDashboardData();
            } else {
                const msg = await res.text();
                showCustomAlert('Lỗi', msg || 'Lỗi khi khôi phục bài viết.', 'error');
            }
        } catch (e) {
            console.error(e);
            showCustomAlert('Lỗi kết nối', 'Không thể kết nối đến máy chủ.', 'error');
        }
    });
};
