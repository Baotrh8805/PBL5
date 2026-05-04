package com.pbl5.config;

import com.pbl5.enums.Provider;
import com.pbl5.enums.Role;
import com.pbl5.enums.UserStatus;
import com.pbl5.model.User;
import com.pbl5.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Bean
    public CommandLineRunner initDefaultModerator() {
        return args -> {
            // Kiểm tra xem đã có tài khoản moderator chưa
            String modEmail = "moderator@gmail.com";
            if (userRepository.findByEmail(modEmail).isEmpty()) {
                User modUser = new User();
                modUser.setEmail(modEmail);
                modUser.setFullName("Moderator Test");
                modUser.setUsername("moderator_test");
                // Pass mặc định là: 123456
                modUser.setPassword(passwordEncoder.encode("123456"));
                modUser.setRole(Role.MODERATOR);
                modUser.setStatus(UserStatus.ACTIVE);
                modUser.setProvider(Provider.LOCAL);

                userRepository.save(modUser);
                System.out.println("------------------------------------------------------");
                System.out.println("Đã tự động tạo tài khoản Moderator mặc định!");
                System.out.println("Email: " + modEmail);
                System.out.println("Mật khẩu: 123456");
                System.out.println("------------------------------------------------------");
            }
        };
    }

    @Bean
    public CommandLineRunner cleanupDeprecatedModerationColumns() {
        return args -> {
            try {
                jdbcTemplate.execute("ALTER TABLE posts DROP COLUMN IF EXISTS violation_evidence");
                jdbcTemplate.execute("ALTER TABLE posts DROP COLUMN IF EXISTS violation_label");
                jdbcTemplate.execute("ALTER TABLE posts DROP COLUMN IF EXISTS violation_media_type");
                jdbcTemplate.execute("ALTER TABLE posts DROP COLUMN IF EXISTS violation_detected");
            } catch (Exception e) {
                System.out.println("Không thể dọn các cột moderation cũ: " + e.getMessage());
            }
        };
    }
}
