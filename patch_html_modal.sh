cat << 'HTML_EOF' >> src/main/resources/static/html/profile.html

<!-- Modal Edit Profile -->
<div id="edit-profile-modal" class="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:2000; align-items:center; justify-content:center;">
    <div class="modal-content" style="background:#fff; width:450px; border-radius:10px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,0.2);">
        <h2 style="margin-bottom: 20px; text-align:center;">Chỉnh sửa Trang Cá Nhân</h2>
        
        <div style="margin-bottom:15px;">
            <label style="display:block; font-weight:bold; margin-bottom:5px;">Họ và Tên</label>
            <input type="text" id="edit-fullname" class="post-input" style="width:100%; border:1px solid #ccc; padding:10px; border-radius:5px;">
        </div>
        
        <div style="margin-bottom:15px;">
            <label style="display:block; font-weight:bold; margin-bottom:5px;">Tiểu sử (Bio)</label>
            <textarea id="edit-bio" class="post-input" style="width:100%; border:1px solid #ccc; padding:10px; border-radius:5px; height:80px;"></textarea>
        </div>
        
        <div style="margin-bottom:15px;">
            <label style="display:block; font-weight:bold; margin-bottom:5px;">Tình trạng mối quan hệ</label>
            <select id="edit-relationship" class="post-input" style="width:100%; border:1px solid #ccc; padding:10px; border-radius:5px;">
                <option value="Độc thân">Độc thân</option>
                <option value="Đang hẹn hò">Đang hẹn hò</option>
                <option value="Đã kết hôn">Đã kết hôn</option>
                <option value="Phức tạp">Phức tạp</option>
            </select>
        </div>
        
        <div style="margin-bottom:15px;">
            <label style="display:block; font-weight:bold; margin-bottom:5px;">Số điện thoại</label>
            <input type="text" id="edit-phone" class="post-input" style="width:100%; border:1px solid #ccc; padding:10px; border-radius:5px;">
        </div>
        
        <div style="margin-bottom:15px;">
            <label style="display:block; font-weight:bold; margin-bottom:5px;">Ngày sinh</label>
            <input type="date" id="edit-dob" class="post-input" style="width:100%; border:1px solid #ccc; padding:10px; border-radius:5px;">
        </div>
        
        <div style="margin-bottom:20px;">
            <label style="display:block; font-weight:bold; margin-bottom:5px;">Giới tính</label>
            <select id="edit-gender" class="post-input" style="width:100%; border:1px solid #ccc; padding:10px; border-radius:5px;">
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
            </select>
        </div>
        
        <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button onclick="closeEditProfileModal()" style="padding:10px 15px; border:none; background:#e4e6eb; border-radius:5px; cursor:pointer;">Hủy</button>
            <button onclick="saveProfileChanges()" style="padding:10px 15px; border:none; background:#0866ff; color:white; border-radius:5px; cursor:pointer;">Lưu thay đổi</button>
        </div>
    </div>
</div>

HTML_EOF
