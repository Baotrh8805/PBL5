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

