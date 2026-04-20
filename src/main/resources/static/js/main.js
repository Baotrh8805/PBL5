const API_URL = '/api/auth';

function showSection(sectionId) {
    document.querySelectorAll('.form-section').forEach(sec => {
        sec.classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');
    hideNotification();

    // Update Top Right Navigation dynamically
    const navRight = document.getElementById('nav-right-actions');
    if (sectionId === 'login-section') {
        navRight.innerHTML = `<span>Bạn là người mới?</span> <button class="btn btn-outline" onclick="showSection('register-section')">Đăng ký</button>`;
    } else if (sectionId === 'register-section') {
        navRight.innerHTML = `<span>Đã có tài khoản?</span> <button class="btn btn-outline" onclick="showSection('login-section')">Đăng nhập</button>`;
    } else {
        navRight.innerHTML = `<button class="btn btn-outline" onclick="showSection('login-section')">Quay lại</button>`;
    }
}

let pinTimer = null;
let currentSeconds = 60;

function startPinCountdown() {
    clearInterval(pinTimer);
    currentSeconds = 60;
    const resendBtn = document.getElementById('btn-resend-pin');
    if (!resendBtn) return;
    
    resendBtn.disabled = true;
    resendBtn.innerText = `Gửi lại mã (${currentSeconds}s)`;
    
    pinTimer = setInterval(() => {
        currentSeconds--;
        if (currentSeconds <= 0) {
            clearInterval(pinTimer);
            resendBtn.disabled = false;
            resendBtn.innerText = 'Gửi lại mã';
        } else {
            resendBtn.innerText = `Gửi lại mã (${currentSeconds}s)`;
        }
    }, 1000);
}

function togglePassword(inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        iconElement.classList.remove('fa-eye');
        iconElement.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        iconElement.classList.remove('fa-eye-slash');
        iconElement.classList.add('fa-eye');
    }
}

function showNotification(message, isError = false) {
    const notif = document.getElementById('notification');
    const icon = isError ? '<i class="fa-solid fa-circle-exclamation"></i>' : '<i class="fa-solid fa-circle-check"></i>';
    notif.innerHTML = `${icon} <span>${message}</span>`;
    notif.className = isError ? 'error-msg' : 'success-msg';
    notif.classList.remove('hidden');
}

function hideNotification() {
    document.getElementById('notification').classList.add('hidden');
}

// --- REAL-TIME VALIDATION LOGIC ---
function validateField(id, regex, emptyMsg, invalidMsg, matchingId = null) {
    const el = document.getElementById(id);
    const errEl = el.closest('.input-group').querySelector('.error-msg');
    const icon = el.closest('.input-with-icon')?.querySelector('.success-icon');
    
    function setValid(isValid, msg) {
        if(isValid) {
            el.classList.remove('input-error');
            el.classList.add('input-success');
            if (errEl) errEl.textContent = '';
            if(icon) icon.classList.remove('hidden');
        } else {
            el.classList.remove('input-success');
            el.classList.add('input-error');
            if (errEl) errEl.textContent = msg;
            if(icon) icon.classList.add('hidden');
        }
        return isValid;
    }

    if (el.value.trim() === '') {
        return setValid(false, emptyMsg);
    }
    if (regex && !regex.test(el.value)) {
        return setValid(false, invalidMsg);
    }
    if (matchingId) {
        const matchEl = document.getElementById(matchingId);
        if (el.value !== matchEl.value) {
            return setValid(false, invalidMsg);
        }
    }
    return setValid(true, '');
}

// Attach listeners
document.getElementById('reg-username')?.addEventListener('input', () => validateField('reg-username', /^[a-zA-Z0-9_]{4,15}$/, 'Tên đăng nhập không được bỏ trống', 'Từ 4-15 ký tự, không chứa ký tự đặc biệt.'));
document.getElementById('reg-email')?.addEventListener('input', () => validateField('reg-email', /^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Email không được bỏ trống', 'Định dạng email không hợp lệ.'));
document.getElementById('reg-password')?.addEventListener('input', () => {
    validateField('reg-password', /^.{6,}$/, 'Mật khẩu không được bỏ trống', 'Mật khẩu phải dài ít nhất 6 ký tự.');
    if (document.getElementById('reg-confirm-password').value !== '') {
        validateField('reg-confirm-password', null, 'Xác nhận mật khẩu không được bỏ trống', 'Mật khẩu không khớp.', 'reg-password');
    }
});
document.getElementById('reg-confirm-password')?.addEventListener('input', () => validateField('reg-confirm-password', null, 'Xác nhận mật khẩu không được bỏ trống', 'Mật khẩu không khớp.', 'reg-password'));
document.getElementById('reg-name')?.addEventListener('input', () => validateField('reg-name', /^.+$/, 'Họ và tên không được bỏ trống', 'Họ và tên không hợp lệ.'));
document.getElementById('reg-phone')?.addEventListener('input', () => validateField('reg-phone', /^\d{10}$/, 'Số điện thoại không được bỏ trống', 'Số điện thoại phải bao gồm đúng 10 chữ số.'));

document.getElementById('reg-dob')?.addEventListener('change', () => validateField('reg-dob', /^(19\d{2}|200\d|201[0-5])-\d{2}-\d{2}$/, 'Vui lòng chọn ngày sinh', 'Năm sinh phải chọn dưới năm 2016.'));

document.getElementById('reg-gender')?.addEventListener('change', () => validateField('reg-gender', /^.+$/, 'Vui lòng chọn giới...', 'Vui lòng chọn giới tính'));

window.nextStep = function(currentStep) {
    let isValid = true;
    if (currentStep === 1) {
        isValid &= validateField('reg-username', /^[a-zA-Z0-9_]{4,15}$/, 'Tên đăng nhập không được bỏ trống', 'Từ 4-15 ký tự, không chứa ký tự đặc biệt.');
        isValid &= validateField('reg-email', /^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Email không được bỏ trống', 'Định dạng email không hợp lệ.');
        isValid &= validateField('reg-password', /^.{6,}$/, 'Mật khẩu không được bỏ trống', 'Mật khẩu phải dài ít nhất 6 ký tự.');
        isValid &= validateField('reg-confirm-password', null, 'Xác nhận mật khẩu không được bỏ trống', 'Mật khẩu không khớp.', 'reg-password');
    } else if (currentStep === 2) {
        isValid &= validateField('reg-name', /^.+$/, 'Họ và tên không được bỏ trống', 'Họ và tên không hợp lệ.');
        isValid &= validateField('reg-phone', /^\d{10}$/, 'Số điện thoại không được bỏ trống', 'Số điện thoại phải bao gồm đúng 10 chữ số.');
        isValid &= validateField('reg-dob', /^(19\d{2}|200\d|201[0-5])-\d{2}-\d{2}$/, 'Vui lòng chọn ngày sinh', 'Năm sinh phải chọn dưới năm 2016.');
        isValid &= validateField('reg-gender', /^.+$/, 'Vui lòng chọn giới...', 'Vui lòng chọn giới tính');
    }
    
    if (!isValid) return;

    document.getElementById(`reg-step-${currentStep}`).classList.add('hidden');
    document.getElementById(`reg-step-${currentStep + 1}`).classList.remove('hidden');
    if (currentStep === 1) document.getElementById('reg-subtitle').innerText = 'Bước 2: Thông tin cá nhân';
    if (currentStep === 2) document.getElementById('reg-subtitle').innerText = 'Bước 3: Xác nhận điều khoản';
}

window.prevStep = function(currentStep) {
    document.getElementById(`reg-step-${currentStep}`).classList.add('hidden');
    document.getElementById(`reg-step-${currentStep - 1}`).classList.remove('hidden');
    if (currentStep === 2) document.getElementById('reg-subtitle').innerText = 'Bước 1: Thông tin cơ bản';
    if (currentStep === 3) document.getElementById('reg-subtitle').innerText = 'Bước 2: Thông tin cá nhân';
}

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!document.getElementById('reg-terms').checked) {
        document.getElementById('reg-terms').closest('.checkbox-group').nextElementSibling.textContent = 'Bạn phải đồng ý với điều khoản.';
        return;
    } else {
        document.getElementById('reg-terms').closest('.checkbox-group').nextElementSibling.textContent = '';
    }

    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const fullName = document.getElementById('reg-name').value;
    const gender = document.getElementById('reg-gender').value;
    const phoneNumber = document.getElementById('reg-phone').value;
    const dateOfBirth = document.getElementById('reg-dob').value;

    const btnSubmit = document.getElementById('btn-submit-reg');
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Đang xử lý...';

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, fullName, gender, phoneNumber, dateOfBirth })
        });
        const data = await res.json();
        
        btnSubmit.disabled = false;
        btnSubmit.innerText = 'Tạo tài khoản';
        
        if (!res.ok) throw new Error(data.message || 'Lỗi đăng ký');
        
        // Đăng ký thành công, nhảy qua màn hình nhập PIN
        hideNotification();
        document.getElementById('verify-email-display').innerText = email;
        startPinCountdown();
        showSection('verify-pin-section');
        
    } catch (err) {
        btnSubmit.disabled = false;
        btnSubmit.innerText = 'Tạo tài khoản';
        showNotification(err.message, true);
    }
});

document.getElementById('verify-pin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('pin-code').value;
    const email = document.getElementById('verify-email-display').innerText;

    try {
        const res = await fetch(`${API_URL}/verify?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`);
        const data = await res.text();
        if (!res.ok) throw new Error(data || 'Mã PIN sai hoặc đã hết hạn');
        
        // Hiện msg rồi nhảy sang Login
        showSection('login-section');
        showNotification("Xác thực tài khoản thành công! Vui lòng đăng nhập.", false);
        
    } catch (err) {
        showNotification(err.message, true);
    }
});

// Xử lý gửi lại mã PIN
window.handleResendPin = async function() {
    const email = document.getElementById('verify-email-display').innerText;
    if (!email) return;
    
    const resendBtn = document.getElementById('btn-resend-pin');
    resendBtn.disabled = true;
    resendBtn.innerText = 'Đang gửi...';
    
    try {
        const res = await fetch(`${API_URL}/resend-pin?email=${encodeURIComponent(email)}`, { method: 'POST' });
        const data = await res.text();
        if (!res.ok) throw new Error(data || 'Không thể gửi lại mã');
        
        showNotification(data, false);
        startPinCountdown();
    } catch (err) {
        showNotification(err.message, true);
        resendBtn.disabled = false;
        resendBtn.innerText = 'Gửi lại mã';
    }
};

// ================= ORIGINAL LOGIC =================


document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Lỗi đăng nhập');

        localStorage.setItem('token', data.token);
        if (data.role === 'ADMIN') {
            window.location.href = '/html/admin.html';
        } else {
            window.location.href = '/html/home.html';
        }
    } catch (err) {
        showNotification(err.message, true);
    }
});

document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;

    try {
        const res = await fetch(`${API_URL}/forgot-password?email=${encodeURIComponent(email)}`, { method: 'POST' });
        const data = await res.text();
        if (!res.ok) throw new Error(data || 'Lỗi gửi yêu cầu');
        showNotification("Mã PIN khôi phục đã được gửi vào email của bạn!");
        // Chuyển sang form đặt lại mật khẩu để nhập mã PIN
        showSection('reset-password-section');
    } catch (err) {
        showNotification(err.message, true);
    }
});

document.getElementById('reset-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('reset-pin').value;
    const newPassword = document.getElementById('new-password').value;

    try {
        const res = await fetch(`${API_URL}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });
        const data = await res.text();
        if (!res.ok) throw new Error(data || 'Lỗi đổi mật khẩu');
        
        showNotification(data);
        setTimeout(() => showSection('login-section'), 2000);
    } catch (err) {
        showNotification(err.message, true);
    }
});

window.logout = function() {
    localStorage.removeItem('token');
    showSection('login-section');
    showNotification('Đã đăng xuất thành công.');
};

window.onload = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.has('code')) {
        try {
            const res = await fetch(`${API_URL}/verify?code=${urlParams.get('code')}`);
            const data = await res.text();
            showNotification(res.ok ? data : data, !res.ok);
            // Xóa query param code khỏi url sau khi xác thực
            window.history.replaceState({}, document.title, window.location.pathname);
            
        } catch (err) {
            showNotification('Lỗi xác thực email', true);
        }
    }
    
    if (urlParams.has('oauth_token')) {
        const t = urlParams.get('oauth_token');
        localStorage.setItem('token', t);
        window.history.replaceState({}, document.title, window.location.pathname);
        await redirectByRole(t);
    } else if (urlParams.has('token')) {
        document.getElementById('reset-token').value = urlParams.get('token');
        showSection('reset-password-section');
    } else if (localStorage.getItem('token')) {
        await redirectByRole(localStorage.getItem('token'));
    }
};

async function redirectByRole(token) {
    try {
        const res = await fetch('/api/users/profile', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) {
            localStorage.removeItem('token');
            return;
        }
        const profile = await res.json();
        const role = typeof profile.role === 'object' ? profile.role?.name ?? profile.role : profile.role;
        if (role === 'ADMIN') {
            window.location.href = '/html/admin.html';
        } else if (role === 'MODERATOR') {
            window.location.href = '/html/home.html';
        } else {
            window.location.href = '/html/home.html';
        }
    } catch (e) {
        window.location.href = '/html/home.html';
    }
}
