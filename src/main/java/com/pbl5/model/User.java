package com.pbl5.model;

import com.pbl5.enums.Provider;
import com.pbl5.enums.Role;
import com.pbl5.enums.UserStatus;
import jakarta.persistence.*;

/**
 * Entity đại diện cho bảng "users" trong cơ sở dữ liệu.
 * Lưu trữ thông tin tài khoản người dùng, bao gồm đăng ký LOCAL và đăng nhập qua Google OAuth2.
 */
@Entity
@Table(name = "users")
public class User {

    /** Khóa chính, tự động tăng (auto increment) */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Email của người dùng – phải là duy nhất và không được để trống */
    @Column(unique = true, nullable = false)
    private String email;

    /** Tên hiển thị của người dùng (Không được trùng lặp và không được để trống) */
    @Column(nullable = false, unique = true)
    private String fullName;

    /** Mật khẩu đã được mã hóa (BCrypt). Có thể null nếu đăng nhập bằng Google OAuth2 */
    private String password;

    /** Tên đăng nhập (username). Có thể null nếu đăng nhập bằng Google */
    @Column(unique = true, nullable = true)
    private String username;

    /** Giới tính */
    @Column(nullable = true)
    private String gender;

    /** Tiểu sử */
    @Column(length = 255)
    private String bio;

    /** Mối quan hệ */
    @Column(length = 100)
    private String relationshipStatus;

    /** Số điện thoại */
    @Column(unique = true, nullable = true)
    private String phoneNumber;

    /** Ngày sinh */
    @Column(nullable = true)
    private java.time.LocalDate dateOfBirth;

    /**
     * Nhà cung cấp xác thực: LOCAL (đăng ký thủ công) hoặc GOOGLE (OAuth2).
     * Lưu dưới dạng chuỗi trong database.
     */
    @Enumerated(EnumType.STRING)
    private Provider provider;

    /**
     * Trạng thái tài khoản: INACTIVE (chưa xác thực), ACTIVE (đang hoạt động),
     * BANNED (bị khoá), WARNING (cảnh báo).
     * Lưu dưới dạng chuỗi trong database.
     */
    @Enumerated(EnumType.STRING)
    private UserStatus status;

    /** Vai trò của người dùng: USER, MODERATOR, ADMIN */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(255) default 'USER'")
    private Role role = Role.USER;

    /** Mã UUID dùng để xác thực email khi đăng ký tài khoản. Sẽ bị xóa sau khi xác thực xong. */
    private String verificationCode;

    /** Token UUID dùng để đặt lại mật khẩu. Sẽ bị xóa sau khi đặt lại thành công. */
    private String resetPasswordToken;

    @Column(length = 500)
    private String avatar;

    @Column(length = 500)
    private String cover;

    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }

    public String getCover() { return cover; }
    public void setCover(String cover) { this.cover = cover; }

    // ==================== Getters và Setters ====================

    /** Trả về ID của người dùng */
    public Long getId() { return id; }

    /** Gán ID cho người dùng */
    public void setId(Long id) { this.id = id; }

    /** Trả về email của người dùng */
    public String getEmail() { return email; }

    /** Gán email cho người dùng */
    public void setEmail(String email) { this.email = email; }

    /** Trả về họ tên đầy đủ */
    public String getFullName() { return fullName; }

    /** Gán họ tên đầy đủ */
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getUsername() { return username; }

    public void setUsername(String username) { this.username = username; }

    public String getGender() { return gender; }

    public void setGender(String gender) { this.gender = gender; }

    public String getBio() { return bio; }

    public void setBio(String bio) { this.bio = bio; }

    public String getRelationshipStatus() { return relationshipStatus; }

    public void setRelationshipStatus(String relationshipStatus) { this.relationshipStatus = relationshipStatus; }

    public String getPhoneNumber() { return phoneNumber; }

    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public java.time.LocalDate getDateOfBirth() { return dateOfBirth; }

    public void setDateOfBirth(java.time.LocalDate dateOfBirth) { this.dateOfBirth = dateOfBirth; }

    /** Trả về mật khẩu đã mã hóa */
    public String getPassword() { return password; }

    /** Gán mật khẩu đã mã hóa */
    public void setPassword(String password) { this.password = password; }

    /** Trả về nhà cung cấp xác thực (LOCAL / GOOGLE) */
    public Provider getProvider() { return provider; }

    /** Gán nhà cung cấp xác thực */
    public void setProvider(Provider provider) { this.provider = provider; }

    /** Trả về trạng thái tài khoản */
    public UserStatus getStatus() { return status; }

    /** Gán trạng thái tài khoản */
    public void setStatus(UserStatus status) { this.status = status; }

    public Role getRole() { return role; }

    public void setRole(Role role) { this.role = role; }

    /** Trả về mã xác thực email */
    public String getVerificationCode() { return verificationCode; }

    /** Gán mã xác thực email */
    public void setVerificationCode(String verificationCode) { this.verificationCode = verificationCode; }

    /** Trả về token đặt lại mật khẩu */
    public String getResetPasswordToken() { return resetPasswordToken; }

    /** Gán token đặt lại mật khẩu */
    public void setResetPasswordToken(String resetPasswordToken) { this.resetPasswordToken = resetPasswordToken; }

    // ==================== Domain Business Logic Methods ====================

    /** 
     * Đặt lại mật khẩu. Cập nhật state nội bộ thay vì gọi setter thô 
     */
    public void setMatKhauMoi(String encodedPassword) {
        if (this.status == UserStatus.BANNED) {
            throw new IllegalStateException("Không thể đổi mật khẩu, tài khoản đang bị cấm!");
        }
        this.password = encodedPassword;
    }

    /** Khoá tài khoản (Ban) */
    public void khoaTaiKhoan() {
        this.status = UserStatus.BANNED;
    }

    /** Mở khoá tài khoản */
    public void moKhoaTaiKhoan() {
        this.status = UserStatus.ACTIVE;
    }
}
