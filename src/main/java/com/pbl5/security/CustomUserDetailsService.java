package com.pbl5.security;

import com.pbl5.model.User;
import com.pbl5.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Service tùy chỉnh để Spring Security tải thông tin người dùng từ database.
 * Implement interface UserDetailsService – Spring Security gọi loadUserByUsername()
 * trong quá trình xác thực (authentication) khi người dùng đăng nhập.
 *
 * Trong dự án này, "username" chính là email của người dùng.
 */
@Service
public class CustomUserDetailsService implements UserDetailsService {

    /** Repository truy cập dữ liệu người dùng */
    @Autowired
    UserRepository userRepository;

    /**
     * Tải thông tin người dùng từ database dựa vào email (được dùng làm "username").
     * Spring Security gọi hàm này tự động khi cần xác thực người dùng.
     *
     * @param email Email của người dùng cần tải thông tin (Spring truyền vào dưới tên "username")
     * @return Đối tượng UserDetails chứa thông tin xác thực của người dùng
     * @throws UsernameNotFoundException nếu không tìm thấy người dùng với email đó
     */
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        // Tìm user theo email trong DB; ném exception nếu không tìm thấy
        User user = userRepository.findByEmail(email).orElseThrow(
            () -> new UsernameNotFoundException("Không tìm thấy người dùng với email: " + email)
        );

        // Bọc entity User vào CustomUserDetails để Spring Security có thể sử dụng
        return new CustomUserDetails(user);
    }
}
