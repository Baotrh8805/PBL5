let modChart = null;

function syncDashboardStats() {
    console.log("Đang đồng bộ thống kê Dashboard...", window.dashboardState);
    if (!window.dashboardState) return;

    window.dashboardState.processedToday = getTodayActionCount();

    const pendingEl = document.getElementById('stat-pending-count');
    const bannedEl = document.getElementById('stat-banned-count');
    const processedEl = document.getElementById('stat-processed-today');

    if (pendingEl) pendingEl.textContent = String(window.dashboardState.pending);
    if (bannedEl) bannedEl.textContent = String(window.dashboardState.banned);
    if (processedEl) processedEl.textContent = String(window.dashboardState.processedToday);

    const logActionsEl = document.getElementById('log-actions-today');
    const logPendingEl = document.getElementById('log-pending-posts');
    const logBannedEl = document.getElementById('log-banned-users');

    if (logActionsEl) logActionsEl.textContent = String(window.dashboardState.processedToday);
    if (logPendingEl) logPendingEl.textContent = String(window.dashboardState.pending);
    if (logBannedEl) logBannedEl.textContent = String(window.dashboardState.banned);

    initStatsChart(window.dashboardState.processedToday, window.dashboardState.pending, window.dashboardState.banned);
}

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

function renderPostsTable(posts, elementId) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;

    const pendingPosts = posts
        .filter(post => String(post.status || '').toUpperCase() === 'PENDING_REVIEW' && getViolationRate(post) >= 40)
        .sort((a, b) => getViolationRate(b) - getViolationRate(a))
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
                ${post.processingModeratorId
                ? `<span style="color: #e67e22; font-size: 13px; font-weight: bold;"><i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý</span>`
                : `<button class="btn-action warning" style="font-size: 12px; padding: 4px 8px;" onclick="viewPostDetail(${post.id})">Xem chi tiết</button>`}
            </td>
            <td>${escapeHtml(reviewer || '(Chưa có)')}</td>
        </tr>
    `;
    }).join('') || '<tr><td colspan="7" class="table-loading">Không có vi phạm nào đang xử lý.</td></tr>';
}

function getTodayActionCount() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const prefix = `${yyyy}-${mm}-${dd}`;

    return getActionLogs().filter(item => String(item.time || '').startsWith(prefix)).length;
}

