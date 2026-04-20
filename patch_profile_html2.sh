sed -i '' '/<!-- Onboarding Modal/i\
        <!-- Edit Profile Modal -->\
        <div id="edit-profile-modal" class="modal-overlay" style="display: none;">\
            <div class="modal-content light-mode">\
                <div class="modal-header">\
                    <h2>Chỉnh sửa trang cá nhân</h2>\
                    <button class="close-modal" onclick="closeEditProfileModal()">\
                        <i class="fa-solid fa-xmark"></i>\
                    </button>\
                </div>\
                \
                <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">\
                    <div style="margin-bottom: 15px;">\
                        <label style="display:block; font-weight:600; margin-bottom:5px;">Tên hiển thị</label>\
                        <input type="text" id="edit-fullname" class="post-input" style="width:100%; border:1px solid #ddd; padding:8px; border-radius:5px;" />\
                    </div>\
                    <div style="margin-bottom: 15px;">\
                        <label style="display:block; font-weight:600; margin-bottom:5px;">Tiểu sử</label>\
                        <textarea id="edit-bio" class="post-input" rows="3" style="width:100%; border:1px solid #ddd; padding:8px; border-radius:5px;"></textarea>\
                    </div>\
                    <div style="margin-bottom: 15px;">\
                        <label style="display:block; font-weight:600; margin-bottom:5px;">Mối quan hệ</label>\
                        <select id="edit-relationship" class="post-input" style="width:100%; border:1px solid #ddd; padding:8px; border-radius:5px;">\
                            <option value="Độc thân">Độc thân</option>\
                            <option value="Hẹn hò">Hẹn hò</option>\
                            <option value="Đã kết hôn">Đã kết hôn</option>\
                            <option value="Phức tạp">Phức tạp</option>\
                        </select>\
                    </div>\
                    <div style="margin-bottom: 15px;">\
                        <label style="display:block; font-weight:600; margin-bottom:5px;">Số điện thoại</label>\
                        <input type="text" id="edit-phone" class="post-input" style="width:100%; border:1px solid #ddd; padding:8px; border-radius:5px;" />\
                    </div>\
                    <div style="margin-bottom: 15px;">\
                        <label style="display:block; font-weight:600; margin-bottom:5px;">Ngày sinh</label>\
                        <input type="date" id="edit-dob" class="post-input" style="width:100%; border:1px solid #ddd; padding:8px; border-radius:5px;" />\
                    </div>\
                    <div style="margin-bottom: 15px;">\
                        <label style="display:block; font-weight:600; margin-bottom:5px;">Giới tính</label>\
                        <select id="edit-gender" class="post-input" style="width:100%; border:1px solid #ddd; padding:8px; border-radius:5px;">\
                            <option value="Nam">Nam</option>\
                            <option value="Nữ">Nữ</option>\
                            <option value="Khác">Khác</option>\
                        </select>\
                    </div>\
                    <button class="modal-submit-btn active" style="width:100%; margin-top:10px;" onclick="saveProfileChanges()">Lưu thay đổi</button>\
                </div>\
            </div>\
        </div>\
\
' src/main/resources/static/html/profile.html
