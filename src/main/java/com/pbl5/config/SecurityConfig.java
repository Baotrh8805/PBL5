package com.pbl5.config;

import com.pbl5.security.CustomOAuth2UserService;
import com.pbl5.security.OAuth2AuthenticationSuccessHandler;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Cấu hình bảo mật trung tâm của ứng dụng (Spring Security).
 * Định nghĩa:
 *  - Thuật toán mã hóa mật khẩu (BCrypt)
 *  - Các URL được phép truy cập công khai vs yêu cầu đăng nhập
 *  - Cấu hình luồng đăng nhập OAuth2 (Google)
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /** Service xử lý thông tin người dùng từ Google OAuth2 */
    @Autowired
    private CustomOAuth2UserService customOAuth2UserService;

    /** Handler xử lý hành động sau khi đăng nhập Google thành công (tạo JWT, redirect) */
    @Autowired
    private OAuth2AuthenticationSuccessHandler oAuth2AuthenticationSuccessHandler;

    /**
     * Đăng ký Bean mã hóa mật khẩu sử dụng thuật toán BCrypt.
     * BCryptPasswordEncoder tự động tạo salt ngẫu nhiên và hash mật khẩu an toàn.
     * Bean này được inject vào AuthService để hash mật khẩu khi đăng ký và so sánh khi đăng nhập.
     *
     * @return PasswordEncoder sử dụng BCrypt
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Cấu hình chuỗi filter bảo mật (SecurityFilterChain) cho toàn bộ ứng dụng.
     *
     * Các cấu hình bao gồm:
     * 1. Tắt CSRF (vì dùng JWT thay vì session-based authentication)
     * 2. Phân quyền URL: một số endpoint public, còn lại yêu cầu đăng nhập
     * 3. Cấu hình OAuth2 Login với Google
     *
     * @param http Đối tượng HttpSecurity để cấu hình
     * @return SecurityFilterChain đã được build
     * @throws Exception Nếu có lỗi khi cấu hình
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // 1. Tắt CSRF vì chúng ta dùng JWT (stateless) thay vì cookie session
            .csrf(csrf -> csrf.disable())

            // 2. Cấu hình phân quyền truy cập URL
            .authorizeHttpRequests(auth -> auth
                // Các URL sau được phép truy cập mà không cần đăng nhập (public):
                // - /api/auth/**  → tất cả API auth (đăng ký, đăng nhập, ...)
                // - /auth/**      → trang xác thực phía web (verify, reset-password, ...)
                // - /             → trang chủ
                // - /index.html   → file HTML chính
                // - /css/**, /js/** → tài nguyên tĩnh (CSS, JavaScript)
                // - /error        → trang lỗi mặc định của Spring
                // - /api/friends/**, /api/messages/**, /ws/** -> các API chat/bạn bè
                .requestMatchers("/api/auth/**", "/auth/**", "/", "/index.html", "/css/**", "/js/**", "/error", "/login/oauth2/**", "/html/**", "/uploads/**", "/api/users/**", "/api/posts/**", "/api/upload/**", "/api/friends/**", "/api/messages/**", "/api/notifications/**", "/ws/**").permitAll()

                // Mọi request khác đều yêu cầu người dùng đã đăng nhập
                .anyRequest().authenticated()
            )

            // 3. Cấu hình OAuth2 Login (đăng nhập bằng Google)
            .oauth2Login(oauth2 -> oauth2
                // Chỉ định service tùy chỉnh để xử lý thông tin user từ Google
                .userInfoEndpoint(userInfo -> userInfo
                    .userService(customOAuth2UserService)
                )
                // Chỉ định handler sau khi đăng nhập Google thành công (tạo JWT và redirect)
                .successHandler(oAuth2AuthenticationSuccessHandler)
            );

        return http.build();
    }
}
