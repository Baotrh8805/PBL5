package com.pbl5.security;

import com.pbl5.model.LoginHistory;
import com.pbl5.model.User;
import com.pbl5.repository.LoginHistoryRepository;
import com.pbl5.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;

/**
 * Handler được gọi tự động bởi Spring Security khi đăng nhập OAuth2 (Google) thành công.
 * Kế thừa SimpleUrlAuthenticationSuccessHandler để tùy chỉnh hành vi sau khi xác thực thành công.
 *
 * Nhiệm vụ: Tạo JWT token sau khi Google xác thực xong, rồi redirect người dùng về frontend
 * kèm token trong URL (để frontend lấy và lưu vào localStorage/cookie).
 */
@Component
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LoginHistoryRepository loginHistoryRepository;

    /**
     * Được Spring Security gọi tự động sau khi OAuth2 login thành công.
     * Lấy email từ thông tin Google → tạo JWT → redirect về trang chủ frontend kèm token.
     *
     * @param request        HTTP request gốc
     * @param response       HTTP response dùng để thực hiện redirect
     * @param authentication Đối tượng chứa thông tin xác thực (principal là OAuth2User)
     * @throws IOException      Nếu lỗi khi thực hiện redirect
     * @throws ServletException Nếu lỗi servlet
     */
    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        // Lấy thông tin người dùng từ Google (đã được xử lý bởi CustomOAuth2UserService)
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();

        // Trích xuất email từ dữ liệu Google trả về
        String email = oAuth2User.getAttribute("email");

        // Tạo JWT token với email là subject – mặc định Ghi nhớ đăng nhập (30 ngày) cho OAuth2
        String token = tokenProvider.generateToken(email, true);

        // Lưu lịch sử đăng nhập Google
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) ip = request.getRemoteAddr();
        final String finalIp = ip;
        Optional<User> userOpt = userRepository.findByEmail(email);
        userOpt.ifPresent(user -> loginHistoryRepository.save(new LoginHistory(user, finalIp, "GOOGLE")));

        getRedirectStrategy().sendRedirect(request, response, "/?oauth_token=" + token);
    }
}
