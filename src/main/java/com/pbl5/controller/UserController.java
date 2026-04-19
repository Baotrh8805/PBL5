package com.pbl5.controller;

import com.pbl5.model.User;
import com.pbl5.repository.UserRepository;
import com.pbl5.security.JwtTokenProvider;
import com.pbl5.dto.OnboardingRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @GetMapping("/profile")
    public ResponseEntity<?> getUserProfile(@RequestHeader(value="Authorization", required=false) String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).body("Chưa đăng nhập (Token trống hoặc lỗi định dạng)");
        }
        
        String token = authHeader.substring(7); // Lấy token thật sự
        if (!tokenProvider.validateToken(token)) {
            return ResponseEntity.status(401).body("Token không hợp lệ hoặc đã hết hạn");
        }

        String email = tokenProvider.getEmailFromJWT(token); // JWT email is the subject
        Optional<User> userOpt = userRepository.findByEmail(email);
        
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            Map<String, Object> profile = new HashMap<>();
            profile.put("id", user.getId());
            profile.put("email", user.getEmail());
            profile.put("fullName", user.getFullName());
            profile.put("phoneNumber", user.getPhoneNumber()); // Thêm dòng này để kiểm tra Onboarding
            profile.put("dateOfBirth", user.getDateOfBirth()); // Thêm dòng này để kiểm tra Onboarding
            profile.put("gender", user.getGender());           // Thêm dòng này
            profile.put("bio", user.getBio());
            profile.put("relationshipStatus", user.getRelationshipStatus());

            // If they don't have an avatar logic yet, pass a blank string to trigger JS avatar creation
            profile.put("avatar", "");
            profile.put("status", user.getStatus());
            
            return ResponseEntity.ok(profile);
        }
        
        return ResponseEntity.status(404).body("Không tìm thấy người dùng");
    }

    @PutMapping("/onboarding")
    public ResponseEntity<?> updateOnboarding(
            @RequestHeader(value="Authorization", required=false) String authHeader,
            @RequestBody OnboardingRequest request) {

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).body("Chưa đăng nhập (Token trống hoặc lỗi định dạng)");
        }

        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token)) {
            return ResponseEntity.status(401).body("Token không hợp lệ hoặc đã hết hạn");
        }

        String email = tokenProvider.getEmailFromJWT(token);
        Optional<User> userOpt = userRepository.findByEmail(email);

        if (userOpt.isPresent()) {
            User user = userOpt.get();
            
            // Validate Tên hiển thị (FullName) không được bỏ trống
            if (request.getFullName() == null || request.getFullName().trim().isEmpty()) {
                return ResponseEntity.status(400).body(Map.of("message", "Tên hiển thị không được bỏ trống"));
            }

            // Kiểm tra Tên hiển thị có bị trùng lặp không (Loại trừ bản thân)
            if (!request.getFullName().equals(user.getFullName()) && userRepository.existsByFullName(request.getFullName())) {
                return ResponseEntity.status(400).body(Map.of("message", "Tên hiển thị này đã có người sử dụng. Vui lòng chọn tên khác."));
            }

            // Kiểm tra Số điện thoại có bị trùng không
            if (request.getPhoneNumber() != null && !request.getPhoneNumber().equals(user.getPhoneNumber()) && userRepository.existsByPhoneNumber(request.getPhoneNumber())) {
                return ResponseEntity.status(400).body(Map.of("message", "Số điện thoại này đã được sử dụng. Vui lòng nhập số khác."));
            }
            
            // Cập nhật các trường
            user.setFullName(request.getFullName().trim());
            user.setPhoneNumber(request.getPhoneNumber());
            user.setDateOfBirth(request.getDateOfBirth());
            user.setGender(request.getGender());

            userRepository.save(user);

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Cập nhật thông tin thành công!");
            return ResponseEntity.ok(response);
        }

        return ResponseEntity.status(404).body("Không tìm thấy người dùng");
    }
}
