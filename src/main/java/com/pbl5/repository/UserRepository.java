package com.pbl5.repository;

import com.pbl5.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository cho entity User.
 * Kế thừa JpaRepository nên đã sẵn có các phương thức CRUD cơ bản
 * (save, findById, findAll, delete, ...) mà không cần viết thêm.
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    
    /**
     * Tìm một User theo địa chỉ email.
     *
     * @param email Địa chỉ email
     * @return Optional<User>
     */
    Optional<User> findByEmail(String email);

    /**
     * Tìm một User theo địa chỉ email hoặc tên đăng nhập.
     *
     * @param email Địa chỉ email
     * @param username Tên đăng nhập
     * @return Optional<User>
     */
    Optional<User> findByEmailOrUsername(String email, String username);

    /**
     * Tìm một User theo mã xác thực email (verificationCode).
     * Dùng khi người dùng click vào link xác thực trong email đăng ký.
     *
     * @param verificationCode Mã UUID được gửi trong email xác thực
     * @return Optional<User> – có giá trị nếu tìm thấy
     */
    Optional<User> findByVerificationCode(String verificationCode);

    /**
     * Tìm một User theo token đặt lại mật khẩu (resetPasswordToken).
     * Dùng khi người dùng click vào link khôi phục mật khẩu trong email.
     *
     * @param resetPasswordToken Token UUID được gửi trong email khôi phục mật khẩu
     * @return Optional<User> – có giá trị nếu tìm thấy
     */
    Optional<User> findByResetPasswordToken(String resetPasswordToken);

    /**
     * Kiểm tra xem email đã được đăng ký trong hệ thống chưa.
     * Dùng khi người dùng đăng ký tài khoản mới để tránh trùng lặp.
     *
     * @param email Địa chỉ email cần kiểm tra
     * @return true nếu email đã tồn tại, false nếu chưa
     */
    boolean existsByEmail(String email);

    boolean existsByUsername(String username);
    
    boolean existsByPhoneNumber(String phoneNumber);

    /**
     * Kiểm tra xem fullName (Tên hiển thị) đã được ai đó sử dụng chưa.
     */
    boolean existsByFullName(String fullName);
}
