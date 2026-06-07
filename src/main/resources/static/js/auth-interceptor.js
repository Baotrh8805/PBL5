// --- Global Fetch Interceptor for 401 ---
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/?error=banned';
        // Reject promise để code phía sau (nếu có loading) sẽ vào catch/finally và tắt loading
        return Promise.reject(new Error('Unauthorized')); 
    }
    return response;
};
// ----------------------------------------

// --- Theme Loader & Manager ---
(function() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

window.toggleTheme = function() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update theme toggle icons across the page if any
    updateThemeToggleIcons();
};

window.updateThemeToggleIcons = function() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const toggleBtns = document.querySelectorAll('#theme-toggle-btn i');
    toggleBtns.forEach(icon => {
        if (currentTheme === 'dark') {
            icon.className = 'fa-solid fa-sun';
            icon.style.color = '#f59e0b';
        } else {
            icon.className = 'fa-solid fa-moon';
            icon.style.color = '';
        }
    });
};

// Auto update icons when page loads
document.addEventListener('DOMContentLoaded', () => {
    updateThemeToggleIcons();
});
