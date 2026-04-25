package com.pbl5.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.security.Key;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import jakarta.annotation.PostConstruct;

/**
 * Component xử lý JWT (JSON Web Token):
 * - Tạo token sau khi đăng nhập thành công
 * - Giải mã token để lấy thông tin người dùng
 * - Xác thực token có hợp lệ hay không
 */
@Component
public class JwtTokenProvider {

    /**
     * Lấy khóa bí mật từ application.properties
     */
    @Value("${jwt.secret}")
    private String jwtSecret;

    private Key key;

    @PostConstruct
    public void init() {
        // Chuyển chuỗi secret thành Key để dùng cho thuật toán HS512
        this.key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    /** Thời gian sống của token ngắn hạn: 1 giờ */
    private final long jwtExpirationInMs = 3600000L;
    
    /** Thời gian sống của token dài hạn: 30 ngày */
    private final long jwtRememberMeExpirationInMs = 2592000000L;

    /**
     * Tạo JWT token từ email người dùng.
     * @param email Email được dùng làm "subject" trong JWT payload
     * @param isRememberMe Cờ xác định có tạo token 30 ngày hay không
     * @return Chuỗi JWT
     */
    public String generateToken(String email, boolean isRememberMe) {
        Date now = new Date();

        // Tính thời điểm hết hạn tùy vào tuỳ chọn Ghi nhớ đăng nhập
        long expirationTime = isRememberMe ? jwtRememberMeExpirationInMs : jwtExpirationInMs;
        Date expiryDate = new Date(now.getTime() + expirationTime);

        return Jwts.builder()
                .setSubject(email)           // Lưu email vào trường subject của payload
                .setIssuedAt(new Date())     // Thời điểm token được tạo
                .setExpiration(expiryDate)   // Thời điểm token hết hạn
                .signWith(key)               // Ký token bằng secret key (HS512)
                .compact();                  // Tạo chuỗi JWT cuối cùng
    }

    /**
     * Giải mã JWT token để lấy email (subject) của người dùng.
     * Dùng để biết request này thuộc về user nào khi nhận được token từ client.
     *
     * @param token Chuỗi JWT từ header Authorization của request
     * @return Email (subject) được lưu trong payload của token
     * @throws io.jsonwebtoken.JwtException nếu token không hợp lệ hoặc đã hết hạn
     */
    public String getEmailFromJWT(String token) {
        // Parse và xác thực token, sau đó lấy phần body (payload/claims)
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(key)          // Cần cùng key để verify chữ ký
                .build()
                .parseClaimsJws(token)
                .getBody();

        // Lấy "subject" chính là email đã gán lúc generateToken
        return claims.getSubject();
    }

    /**
     * Xác thực JWT token có hợp lệ hay không.
     * Token hợp lệ khi: chữ ký đúng, chưa bị giả mạo, và chưa hết hạn.
     *
     * @param authToken Chuỗi JWT cần kiểm tra
     * @return true nếu token hợp lệ, false nếu token lỗi/hết hạn/bị giả mạo
     */
    public boolean validateToken(String authToken) {
        try {
            // Nếu parse thành công → token hợp lệ
            Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(authToken);
            return true;
        } catch (Exception ex) {
            // Có thể là ExpiredJwtException, MalformedJwtException, SignatureException, ...
            return false;
        }
    }
}
