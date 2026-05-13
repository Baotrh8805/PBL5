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
