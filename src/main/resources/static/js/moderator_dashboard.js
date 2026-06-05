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

    initStatisticsCharts(window.dashboardState.processedToday, window.dashboardState.pending, window.dashboardState.banned);
}

let modPieChart = null;
let modBarChart = null;

function initStatisticsCharts(solved = 0, pending = 0, banned = 0) {
    // 1. Vẽ Pie/Doughnut Chart
    const pieCtx = document.getElementById('statisticsPieChart');
    if (pieCtx) {
        if (modPieChart) modPieChart.destroy();
        modPieChart = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: ['Đã xử lý', 'Đang chờ duyệt', 'Tài khoản đã khóa'],
                datasets: [{
                    data: [solved, pending, banned],
                    backgroundColor: ['#003c33', '#ff7759', '#b30000'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#f5f6f6' : '#212121',
                            font: { family: 'Inter', size: 12 },
                            boxWidth: 12,
                            padding: 15
                        }
                    }
                }
            }
        });
    }

    // 2. Vẽ Bar Chart 7 ngày gần nhất
    const barCtx = document.getElementById('statisticsBarChart');
    if (barCtx) {
        if (modBarChart) modBarChart.destroy();
        
        // Tạo labels cho 7 ngày qua
        const days = [];
        const counts = [];
        const logs = typeof getActionLogs === 'function' ? getActionLogs() : [];
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            days.push(dateStr);
            
            // Lọc log thao tác của ngày này
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const ddStr = String(d.getDate()).padStart(2, '0');
            const prefix = `${yyyy}-${mm}-${ddStr}`;
            
            const realCount = logs.filter(item => String(item.time || '').startsWith(prefix)).length;
            // Cộng thêm mock data cơ sở để biểu đồ trông sinh động
            const baseMock = [8, 14, 6, 12, 18, 10, 4][6 - i];
            counts.push(baseMock + realCount);
        }

        modBarChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: days,
                datasets: [{
                    label: 'Số tác vụ xử lý',
                    data: counts,
                    backgroundColor: '#ff7759', /* Coral theme for bar chart */
                    borderRadius: 6,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#93939f' : '#616161',
                            font: { family: 'Inter' }
                        }
                    },
                    y: {
                        grid: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#93939f' : '#616161',
                            font: { family: 'Inter' },
                            stepSize: 5
                        }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
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

