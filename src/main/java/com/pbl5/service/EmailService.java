package com.pbl5.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Service xử lý việc gửi email tự động.
 * Sử dụng JavaMailSender của Spring để gửi email thông qua SMTP.
 */
@Service
public class EmailService {

    /** Bean gửi email, được cấu hình trong application.properties (host, port, username, password) */
    @Autowired
    private JavaMailSender mailSender;

    /**
     * Gửi email xác thực tài khoản cho người dùng mới đăng ký.
     * Email chứa một đường link gồm verificationCode (UUID) để người dùng click kích hoạt tài khoản.
     *
     * @param to    Địa chỉ email người nhận (email đăng ký của người dùng)
     * @param token Mã UUID ngẫu nhiên được dùng để xác thực (lưu trong DB)
     */
    public void sendVerificationEmail(String to, String token) {
        String subject = "Mã xác thực tài khoản LC Network";

        String message = "Chào mừng bạn đến với LC Network!\n\n"
                       + "Mã xác thực (PIN) của bạn là: " + token + "\n\n"
                       + "Vui lòng nhập mã này trên trang web để hoàn tất quá trình đăng ký.\n"
                       + "Trân trọng,\nĐội ngũ LC Network.";

        // Tạo và cấu hình đối tượng email
        SimpleMailMessage email = new SimpleMailMessage();
        email.setTo(to);
        email.setSubject(subject);
        email.setText(message);

        // Gửi email qua JavaMailSender
        mailSender.send(email);
    }

    /**
     * Gửi email đặt lại mật khẩu khi người dùng quên mật khẩu.
     * Email chứa một mã PIN 6 số để người dùng nhập đặt lại mật khẩu.
     *
     * @param to    Địa chỉ email người nhận
     * @param token Mã PIN ngẫu nhiên để đặt lại mật khẩu (lưu trong DB)
     */
    public void sendResetPasswordEmail(String to, String token) {
        String subject = "Đặt lại mật khẩu";

        String message = "Mã xác nhận (PIN) để khôi phục mật khẩu của bạn là: " + token + "\n\n"
                       + "Vui lòng nhập mã này vào trang Đặt lại mật khẩu để tiếp tục. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.";

        // Tạo và cấu hình đối tượng email
        SimpleMailMessage email = new SimpleMailMessage();
        email.setTo(to);
        email.setSubject(subject);
        email.setText(message);

        // Gửi email qua JavaMailSender
        mailSender.send(email);
    }
}
