cat << 'JS_EOF' >> src/main/resources/static/js/profile.js

// === CHỈNH SỬA TRANG CÁ NHÂN ===
let currentProfileData = null;

const originalFillProfileData = fillProfileData;
fillProfileData = function(user, isCurrentUser) {
    if(isCurrentUser) currentProfileData = user;
    
    if (user.cover) {
        document.querySelector('.profile-cover').style.backgroundImage = `url(${user.cover})`;
    }
    
    originalFillProfileData(user, isCurrentUser);
};

function openEditProfileModal() {
    if(!currentProfileData) return;
    document.getElementById('edit-fullname').value = currentProfileData.fullName || '';
    document.getElementById('edit-bio').value = currentProfileData.bio || '';
    document.getElementById('edit-relationship').value = currentProfileData.relationshipStatus || 'Độc thân';
    document.getElementById('edit-phone').value = currentProfileData.phoneNumber || '';
    
    if(currentProfileData.dateOfBirth) {
        let dob = new Date(currentProfileData.dateOfBirth);
        let yyyy = dob.getFullYear();
        let mm = String(dob.getMonth() + 1).padStart(2, '0');
        let dd = String(dob.getDate()).padStart(2, '0');
        document.getElementById('edit-dob').value = `${yyyy}-${mm}-${dd}`;
    }
    
    document.getElementById('edit-gender').value = currentProfileData.gender || 'Nam';
    
    document.getElementById('edit-profile-modal').style.display = 'flex';
}

function closeEditProfileModal() {
    document.getElementById('edit-profile-modal').style.display = 'none';
}

async function saveProfileChanges() {
    const token = localStorage.getItem('token');
    
    const req = {
        fullName: document.getElementById('edit-fullname').value.trim(),
        bio: document.getElementById('edit-bio').value.trim(),
        relationshipStatus: document.getElementById('edit-relationship').value,
        phoneNumber: document.getElementById('edit-phone').value.trim(),
        dateOfBirth: document.getElementById('edit-dob').value,
        gender: document.getElementById('edit-gender').value
    };
    
    try {
        const res = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req)
        });
        
        if (res.ok) {
            alert('Cập nhật thông tin thành công!');
            location.reload();
        } else {
            const err = await res.text();
            alert('Lỗi cập nhật: ' + err);
        }
    } catch(e) {
        console.error(e);
        alert('Đã xảy ra lỗi!');
    }
}

async function uploadImage(type, ev) {
    const file = ev.target.files[0];
    if(!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const token = localStorage.getItem('token');
        const uploadRes = await fetch('/api/upload/image', {
            method: 'POST',
            body: formData
        });
        
        if(!uploadRes.ok) {
            alert('Lỗi khi tải ảnh lên!');
            return;
        }
        
        const uploadData = await uploadRes.json();
        const imageUrl = uploadData.imageUrl;
        
        // Update user profile
        const updateRes = await fetch(`/api/users/profile/${type}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ [type]: imageUrl })
        });
        
        if (updateRes.ok) {
            location.reload();
        } else {
            alert(`Lỗi cập nhật ${type}`);
        }
    } catch(e) {
        console.error(e);
    }
}
JS_EOF
