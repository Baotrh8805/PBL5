package com.pbl5.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Handler được gọi tự động bởi Spring Security khi đăng nhập OAuth2 (Google) thành công.
 * Kế thừa SimpleUrlAuthenticationSuccessHandler để tùy chỉnh hành vi sau khi xác thực thành công.
 *
 * Nhiệm vụ: Tạo JWT token sau khi Google xác thực xong, rồi redirect người dùng về frontend
 * kèm token trong URL (để frontend lấy và lưu vào localStorage/cookie).
 */
@Component
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    /** Provider dùng để tạo JWT token từ email */
    @Autowired
    private JwtTokenProvider tokenProvider;

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

        // Redirect người dùng về trang chủ của frontend, đính kèm token trong query param
        // Frontend sẽ đọc "oauth_token" từ URL và lưu vào bộ nhớ để gửi cùng các request sau
        getRedirectStrategy().sendRedirect(request, response, "/?oauth_token=" + token);
    }
}
