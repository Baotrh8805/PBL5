package com.pbl5;

import com.pbl5.enums.Provider;
import com.pbl5.enums.Role;
import com.pbl5.enums.UserStatus;
import com.pbl5.model.User;
import com.pbl5.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import javax.sql.DataSource;
import java.sql.Connection;
import jakarta.annotation.PostConstruct;
import java.util.TimeZone;

@SpringBootApplication
public class Application implements CommandLineRunner {

    @Autowired
    private DataSource dataSource;

    @PostConstruct
    public void init() {
        // Thiết lập múi giờ mặc định cho toàn bộ ứng dụng là giờ Việt Nam
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
    }

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // ===== CẤU HÌNH TÀI KHOẢN ADMIN =====
    private static final String ADMIN_USERNAME = "admin";
    private static final String ADMIN_PASSWORD = "Admin@123";
    private static final String ADMIN_EMAIL    = "admin@lcnetwork.com";
    private static final String ADMIN_FULLNAME = "Administrator";

    public static void main(String[] args) {
        // Thiết lập múi giờ từ lúc ứng dụng mới bắt đầu khởi động
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
        SpringApplication.run(Application.class, args);
        System.out.println("\n");
        System.out.println("==========================================================");
        System.out.println("🚀 MÁY CHỦ JAVA SPRING BOOT ĐÃ CHẠY THÀNH CÔNG RỰC RỠ! 🚀");
        System.out.println("🌐 Địa chỉ nội bộ Mac:  http://localhost:8080 / gõ ipconfig getifaddr en0");
        System.out.println("🌐 Tên miền trên mạng lan: https://pbl5-omru.onrender.com");
        System.out.println("==========================================================\n");
    }

    @Override
    public void run(String... args) throws Exception {
        // Kiểm tra kết nối PostgreSQL
        System.out.println("Đang kiểm tra kết nối tới PostgreSQL...");
        try (Connection connection = dataSource.getConnection()) {
            System.out.println("✅ Đã kết nối PostgreSQL thành công!");
            System.out.println("✅ Database: " + connection.getMetaData().getDatabaseProductName()
                    + " " + connection.getMetaData().getDatabaseProductVersion());
        } catch (Exception e) {
            System.out.println("❌ LỖI kết nối PostgreSQL: " + e.getMessage());
        }

        // Tạo tài khoản admin mặc định nếu chưa tồn tại
        boolean adminExists = userRepository.findAll().stream()
                .anyMatch(u -> u.getRole() == Role.ADMIN);

        if (!adminExists) {
            User admin = new User();
            admin.setUsername(ADMIN_USERNAME);
            admin.setPassword(passwordEncoder.encode(ADMIN_PASSWORD));
            admin.setEmail(ADMIN_EMAIL);
            admin.setFullName(ADMIN_FULLNAME);
            admin.setRole(Role.ADMIN);
            admin.setStatus(UserStatus.ACTIVE);
            admin.setProvider(Provider.LOCAL);
            userRepository.save(admin);

            System.out.println("==========================================================");
            System.out.println("✅ Tài khoản Admin đã được tạo:");
            System.out.println("   Username : " + ADMIN_USERNAME);
            System.out.println("   Password : " + ADMIN_PASSWORD);
            System.out.println("   Email    : " + ADMIN_EMAIL);
            System.out.println("==========================================================");
        } else {
            System.out.println("✅ Tài khoản Admin đã tồn tại, bỏ qua khởi tạo.");
        }
    }
}

