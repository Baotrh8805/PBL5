package com.pbl5;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.beans.factory.annotation.Autowired;
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

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
        System.out.println("\n");
        System.out.println("==========================================================");
        System.out.println("🚀 MÁY CHỦ JAVA SPRING BOOT ĐÃ CHẠY THÀNH CÔNG RỰC RỠ! 🚀");
        System.out.println("🌐 Địa chỉ nội bộ Mac:  http://localhost:8080");
        System.out.println("🌐 Tên miền trên mạng lan: https://pbl5-omru.onrender.com  "
                            );

        System.out.println("==========================================================\n");
    }

    @Override
    public void run(String... args) throws Exception {
        System.out.println("Đang kiểm tra kết nối tới PostgreSQL...");
        try (Connection connection = dataSource.getConnection()) {
            System.out.println("✅ HOAN HÔ! Đã kết nối PostgreSQL thành công!");
            System.out.println("✅ Metadata Database: " + connection.getMetaData().getDatabaseProductName() + " " + connection.getMetaData().getDatabaseProductVersion());
        } catch (Exception e) {
            System.out.println("❌ LỖI: Không thể kết nối tới PostgreSQL. Hãy kiểm tra lại username/password/url trong application.properties!");
            System.out.println("Chi tiết lỗi: " + e.getMessage());
        }
    }
}

