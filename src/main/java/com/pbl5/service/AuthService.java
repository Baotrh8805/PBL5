package com.pbl5.service;

import com.pbl5.dto.LoginRequest;
import com.pbl5.dto.RegisterRequest;
import com.pbl5.enums.Provider;
import com.pbl5.enums.UserStatus;
import com.pbl5.model.User;
import com.pbl5.repository.UserRepository;
import com.pbl5.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.Optional;
import java.util.UUID;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.time.LocalDateTime;

/**
 * Service xử lý toàn bộ logic xác thực người dùng:
 * đăng ký, đăng nhập, xác thực email, quên mật khẩu, đặt lại mật khẩu.
 */
@Service
public class AuthService {

    /** Repository truy cập dữ liệu người dùng trong database */
    @Autowired
    private UserRepository userRepository;

    /** Dùng để mã hóa mật khẩu (BCrypt) trước khi lưu và kiểm tra khi đăng nhập */
    @Autowired
    private PasswordEncoder passwordEncoder;

    /** Dùng để tạo và xác thực JWT token */
    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    /** Dùng để gửi email xác thực và email quên mật khẩu */
    @Autowired
    private EmailService emailService;

    private static class PendingUser {
        RegisterRequest request;
        String otp;
        LocalDateTime expiryTime;
        public PendingUser(RegisterRequest request, String otp, LocalDateTime expiryTime) {
            this.request = request;
            this.otp = otp;
            this.expiryTime = expiryTime;
        }
    }
    
    // Lưu tạm các phiên đăng ký chưa xác thực
    private final Map<String, PendingUser> pendingUsers = new ConcurrentHashMap<>();

    /**
     * Xử lý đăng ký tài khoản mới (LOCAL provider).
     * Luồng: kiểm tra email trùng → tạo user → hash password → tạo mã xác thực → lưu DB → gửi email xác thực.
     *
     * @param request Dữ liệu đăng ký gồm: email, fullName, password
     * @throws RuntimeException nếu email đã được sử dụng
     */
    public void register(RegisterRequest request) {
        // Kiểm tra email đã tồn tại trong hệ thống chưa
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email đã được sử dụng");
        }
        
        if (request.getUsername() != null && userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Tên đăng nhập đã được sử dụng");
        }

        if (request.getPhoneNumber() != null && userRepository.existsByPhoneNumber(request.getPhoneNumber())) {
            throw new RuntimeException("Số điện thoại đã được sử dụng");
        }

        if (request.getFullName() == null || request.getFullName().trim().isEmpty()) {
            throw new RuntimeException("Tên hiển thị không được bỏ trống");
        }

        if (userRepository.existsByFullName(request.getFullName().trim())) {
            throw new RuntimeException("Tên hiển thị đã có người sử dụng. Vui lòng chọn tên khác!");
        }

        // Tạo mã PIN xác thực ngẫu nhiên 6 số
        String verifyCode = String.format("%06d", new java.util.Random().nextInt(999999));
        
        // Lưu vào RAM thay vì lưu DB
        PendingUser pendingUser = new PendingUser(request, verifyCode, LocalDateTime.now().plusSeconds(60));
        pendingUsers.put(request.getEmail(), pendingUser);

        // Gửi email xác thực chứa mã PIN cho người dùng
        emailService.sendVerificationEmail(request.getEmail(), verifyCode);
    }

    /**
     * Xử lý đăng nhập bằng email và mật khẩu.
     * Luồng: tìm user → kiểm tra mật khẩu → kiểm tra trạng thái → trả về JWT token.
     *
     * @param request Dữ liệu đăng nhập gồm: email, password
     * @return JWT token dạng chuỗi nếu đăng nhập thành công
     * @throws RuntimeException nếu email/mật khẩu sai hoặc tài khoản không hợp lệ
     */
    public String login(LoginRequest request) {
        // Biến email trong LoginRequest lúc này có thể chứa Email hoặc Username
        String identifier = request.getEmail();

        // Tìm user theo email hoặc username
        User user = userRepository.findByEmailOrUsername(identifier, identifier)
                .orElseThrow(() -> new RuntimeException("Tài khoản hoặc mật khẩu không chính xác"));

        // Nếu user tạo trực tiếp vòng qua Google (không có mật khẩu) thì chặn, yêu cầu xài lại Google.
        // Còn nếu có password thì cứ đăng nhập bình thường!
        if (user.getPassword() == null || user.getPassword().isEmpty()) {
            throw new RuntimeException("Tài khoản này được đăng ký bằng Google. Vui lòng sử dụng nút Google để đăng nhập.");
        }

        // So sánh mật khẩu người dùng nhập với mật khẩu đã hash trong DB
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Tài khoản hoặc mật khẩu không chính xác");
        }

        // Kiểm tra trạng thái tài khoản
        if (user.getStatus() == UserStatus.INACTIVE) {
            // Tài khoản chưa xác thực email
            throw new RuntimeException("Tài khoản chưa được kích hoạt, vui lòng kiểm tra email.");
        } else if (user.getStatus() == UserStatus.BANNED) {
            // Tài khoản bị khoá bởi admin
            throw new RuntimeException("Từ chối truy cập: Tài khoản đã bị khoá.");
        }
        // Lưu ý: UserStatus.WARNING vẫn được phép đăng nhập bình thường

        // Đăng nhập thành công → tạo và trả về JWT token với subject là email và hạn sử dụng tương ứng
        return jwtTokenProvider.generateToken(user.getEmail(), request.isRememberMe());
    }

    public void verifyEmail(String email, String code) {
        PendingUser pendingUser = pendingUsers.get(email);
        if (pendingUser == null) {
            throw new RuntimeException("Không tìm thấy phiên đăng ký hoặc đã bị hủy.");
        }

        if (LocalDateTime.now().isAfter(pendingUser.expiryTime)) {
            throw new RuntimeException("Mã PIN đã hết hạn. Vui lòng nhấn 'Gửi lại mã'.");
        }

        if (!pendingUser.otp.equals(code)) {
            throw new RuntimeException("Mã PIN không chính xác.");
        }

        RegisterRequest request = pendingUser.request;
        // Kiểm tra lại lần cuối trước khi save DB
        if (userRepository.existsByEmail(request.getEmail())) {
            pendingUsers.remove(email);
            throw new RuntimeException("Email đã được sử dụng bởi người khác trong quá trình chờ.");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setFullName(request.getFullName());
        user.setUsername(request.getUsername());
        user.setGender(request.getGender());
        user.setPhoneNumber(request.getPhoneNumber());
        user.setDateOfBirth(request.getDateOfBirth());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setProvider(Provider.LOCAL);
        user.setStatus(UserStatus.ACTIVE);

        userRepository.save(user);
        pendingUsers.remove(email);
    }

    /**
     * Gửi lại mã PIN
     */
    public void resendPin(String email) {
        PendingUser pendingUser = pendingUsers.get(email);
        if (pendingUser == null) {
            throw new RuntimeException("Không tìm thấy phiên đăng ký nào cho email này.");
        }

        String newOtp = String.format("%06d", new java.util.Random().nextInt(999999));
        pendingUser.otp = newOtp;
        pendingUser.expiryTime = LocalDateTime.now().plusSeconds(60);
        pendingUsers.put(email, pendingUser);

        emailService.sendVerificationEmail(email, newOtp);
    }

    /**
     * Xử lý yêu cầu quên mật khẩu.
     * Tạo token đặt lại mật khẩu (UUID), lưu vào DB, rồi gửi link qua email.
     *
     * @param email Địa chỉ email của tài khoản cần đặt lại mật khẩu
     * @throws RuntimeException nếu email không tồn tại trong hệ thống
     */
    public void forgotPassword(String email) {
        // Tìm user theo email
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Email không tồn tại"));

        // Tạo mã PIN (6 chữ số) ngẫu nhiên thay vì UUID
        String resetToken = String.format("%06d", new java.util.Random().nextInt(999999));
        user.setResetPasswordToken(resetToken);
        userRepository.save(user);

        // Gửi email chứa mã PIN
        emailService.sendResetPasswordEmail(user.getEmail(), resetToken);
    }

    /**
     * Đặt lại mật khẩu mới cho người dùng dựa trên reset token hợp lệ.
     * Sau khi đặt lại thành công, token bị xóa khỏi DB để không dùng lại được.
     *
     * @param token       Token UUID lấy từ link email đặt lại mật khẩu
     * @param newPassword Mật khẩu mới người dùng muốn đặt (plaintext – sẽ được hash)
     * @throws RuntimeException nếu token không hợp lệ hoặc không tìm thấy user
     */
    public void resetPassword(String token, String newPassword) {
        // Tìm user theo reset token
        User user = userRepository.findByResetPasswordToken(token)
                .orElseThrow(() -> new RuntimeException("Mã đổi mật khẩu không hợp lệ"));

        // Hash mật khẩu mới trước khi lưu
        user.setPassword(passwordEncoder.encode(newPassword));

        // Xóa token sau khi dùng để ngăn tái sử dụng
        user.setResetPasswordToken(null);
        userRepository.save(user);
    }
}
