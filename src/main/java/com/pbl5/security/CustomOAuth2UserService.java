package com.pbl5.security;

import com.pbl5.enums.Provider;
import com.pbl5.enums.Role;
import com.pbl5.enums.UserStatus;
import com.pbl5.model.User;
import com.pbl5.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Service tùy chỉnh cho đăng nhập OAuth2 (Google).
 * Kế thừa DefaultOAuth2UserService và override phương thức loadUser()
 * để thêm logic lưu/cập nhật thông tin người dùng vào database sau khi Google xác thực thành công.
 *
 * Luồng OAuth2: Google xác thực → Spring gọi loadUser() → ta xử lý user trong DB → trả về OAuth2User.
 */
@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    /** Repository để kiểm tra và lưu thông tin user vào database */
    @Autowired
    private UserRepository userRepository;

    /**
     * Được Spring Security gọi tự động sau khi Google xác thực thành công và trả về access token.
     * Phương thức này lấy thông tin người dùng từ Google, sau đó:
     *  - Nếu user đã tồn tại trong DB: cập nhật provider thành GOOGLE nếu cần.
     *  - Nếu user chưa tồn tại: tạo tài khoản mới với status ACTIVE (không cần xác thực email).
     *
     * @param userRequest Yêu cầu OAuth2 chứa access token từ Google
     * @return OAuth2User – thông tin người dùng từ Google (để Spring Security tiếp tục xử lý)
     * @throws OAuth2AuthenticationException nếu xảy ra lỗi khi tải thông tin từ Google
     */
    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        // Gọi implementation gốc để tải thông tin người dùng từ Google API
        OAuth2User oAuth2User = super.loadUser(userRequest);

        // Lấy email và tên từ dữ liệu Google trả về
        String email = oAuth2User.getAttribute("email");
        String name = oAuth2User.getAttribute("name");

        // Kiểm tra user đã tồn tại trong DB chưa (dựa trên email)
        Optional<User> userOptional = userRepository.findByEmail(email);

        if (userOptional.isPresent()) {
            // TH1: User đã có tài khoản (LOCAL hoặc GOOGLE)
            User user = userOptional.get();
            
            // Nếu người dùng đăng nhập Google lúc tài khoản LOCAL đang chờ mã PIN,
            // ta tin tưởng Google và kích hoạt tài khoản cho họ luôn.
            if (user.getStatus() == UserStatus.INACTIVE) {
                user.setStatus(UserStatus.ACTIVE);
                user.setVerificationCode(null); // Xóa mã cấp phát
                userRepository.save(user);
            }
            
            // LƯU Ý QUAN TRỌNG: KHÔNG đổi user.setProvider() thành GOOGLE ở đây.
            // Nhờ vậy, nếu họ là LOCAL, họ vẫn giữ quyền đăng nhập bằng mật khẩu.
            
        } else {
            // TH2: User chưa từng đăng ký → tạo tài khoản mới từ dữ liệu Google
            User newUser = new User();
            newUser.setEmail(email);

            // Xử lý chống trùng lặp Tên hiển thị khi đăng nhập Google
            String uniqueName = name;
            int counter = 1;
            while (userRepository.existsByFullName(uniqueName)) {
                uniqueName = name + " " + counter;
                counter++;
            }
            newUser.setFullName(uniqueName);
            
            newUser.setProvider(Provider.GOOGLE);
            newUser.setRole(Role.USER);

            // Tài khoản Google không cần xác thực email → đặt luôn status ACTIVE
            newUser.setStatus(UserStatus.ACTIVE);

            // Đặt verificationCode = "OAUTH2" để phân biệt với tài khoản LOCAL chưa xác thực
            newUser.setVerificationCode("OAUTH2");
            userRepository.save(newUser);
        }

        // Trả về đối tượng OAuth2User gốc để Spring Security tiếp tục xử lý luồng xác thực
        return oAuth2User;
    }
}
