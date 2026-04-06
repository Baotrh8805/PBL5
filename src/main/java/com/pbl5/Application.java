package com.pbl5;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.beans.factory.annotation.Autowired;
import javax.sql.DataSource;
import java.sql.Connection;

@SpringBootApplication
public class Application implements CommandLineRunner {

    @Autowired
    private DataSource dataSource;

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
        System.out.println("\n");
        System.out.println("==========================================================");
        System.out.println("🚀 MÁY CHỦ JAVA SPRING BOOT ĐÃ CHẠY THÀNH CÔNG RỰC RỠ! 🚀");
        System.out.println("🌐 Địa chỉ nội bộ Mac:  http://localhost:8080");
        System.out.println("🌐 Địa chỉ ip trên mạng lan:  hãy gõ ipconfig getifaddr en0 \n sẽ hiện ra ip hiện tại của máy trên mạng lan  "
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

