package com.pbl5.security;

import com.pbl5.model.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.Collection;
import java.util.Collections;

/**
 * Lớp bọc (wrapper) quanh entity User, implement interface UserDetails của Spring Security.
 * Spring Security yêu cầu đối tượng có kiểu UserDetails để xử lý xác thực và phân quyền.
 * Lớp này làm cầu nối giữa model User của hệ thống và hệ thống bảo mật Spring.
 */
public class CustomUserDetails implements UserDetails {

    /** Entity User gốc từ database */
    private final User user;

    /**
     * Constructor nhận vào entity User.
     *
     * @param user Đối tượng User từ database
     */
    public CustomUserDetails(User user) {
        this.user = user;
    }

    /**
     * Trả về entity User gốc.
     * Dùng khi cần truy cập dữ liệu đặc thù của User mà UserDetails không có (ví dụ: fullName, provider).
     *
     * @return Entity User
     */
    public User getUser() {
        return user;
    }

    /**
     * Trả về danh sách quyền (roles/permissions) của người dùng.
     * Hiện tại hệ thống chưa phân quyền cụ thể → trả về danh sách rỗng.
     *
     * @return Danh sách GrantedAuthority rỗng
     */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return Collections.emptyList();
    }

    /**
     * Trả về mật khẩu đã hash của người dùng.
     * Spring Security dùng để so sánh với mật khẩu nhập vào khi đăng nhập.
     *
     * @return Chuỗi mật khẩu đã mã hóa BCrypt
     */
    @Override
    public String getPassword() {
        return user.getPassword();
    }

    /**
     * Trả về "username" theo định nghĩa của Spring Security – ở đây dùng email làm định danh.
     *
     * @return Email của người dùng
     */
    @Override
    public String getUsername() {
        return user.getEmail();
    }

    /**
     * Kiểm tra tài khoản có hết hạn không.
     * Hệ thống hiện tại không có chức năng hết hạn tài khoản → luôn trả về true (chưa hết hạn).
     */
    @Override
    public boolean isAccountNonExpired() { return true; }

    /**
     * Kiểm tra tài khoản có bị khóa không.
     * Hệ thống dùng field status để kiểm tra → luôn trả về true ở đây.
     * (Logic khóa tài khoản được xử lý thủ công trong AuthService)
     */
    @Override
    public boolean isAccountNonLocked() { return true; }

    /**
     * Kiểm tra thông tin xác thực (password) có hết hạn không.
     * Hệ thống không dùng chức năng này → luôn trả về true.
     */
    @Override
    public boolean isCredentialsNonExpired() { return true; }

    /**
     * Kiểm tra tài khoản có được kích hoạt không.
     * Trả về true chỉ khi trạng thái tài khoản là ACTIVE.
     * Spring Security dùng kết quả này khi xác thực – nếu false, đăng nhập sẽ thất bại.
     *
     * @return true nếu user có status = ACTIVE
     */
    @Override
    public boolean isEnabled() {
        return user.getStatus() == com.pbl5.enums.UserStatus.ACTIVE;
    }
}
