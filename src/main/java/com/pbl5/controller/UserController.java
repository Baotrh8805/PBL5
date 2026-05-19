package com.pbl5.controller;

import com.pbl5.dto.OnboardingRequest;
import com.pbl5.dto.ProfileUpdateRequest;
import com.pbl5.security.JwtTokenProvider;
import com.pbl5.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    private String authenticateAndGetEmail(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token)) return null;
        return tokenProvider.getEmailFromJWT(token);
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getUserProfile(@RequestHeader(value="Authorization", required=false) String authHeader) {
        String email = authenticateAndGetEmail(authHeader);
        if (email == null) return ResponseEntity.status(401).body("Chưa đăng nhập hoặc Token không hợp lệ");

        try {
            Map<String, Object> profile = userService.getUserProfile(email);
            return ResponseEntity.ok(profile);
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(e.getMessage());
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getUserById(@PathVariable Long id, @RequestHeader(value="Authorization", required=false) String authHeader) {
        String email = authenticateAndGetEmail(authHeader);
        if (email == null) return ResponseEntity.status(401).body("Chưa đăng nhập hoặc Token không hợp lệ");

        try {
            Map<String, Object> profile = userService.getUserById(id, email);
            return ResponseEntity.ok(profile);
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(e.getMessage());
        }
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchUsers(@RequestParam("q") String query, @RequestHeader(value="Authorization", required=false) String authHeader) {
        String email = authenticateAndGetEmail(authHeader);
        if (email == null) return ResponseEntity.status(401).body("Chưa đăng nhập hoặc Token không hợp lệ");

        try {
            return ResponseEntity.ok(userService.searchUsers(query, email));
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(e.getMessage());
        }
    }

    @PutMapping("/onboarding")
    public ResponseEntity<?> updateOnboarding(
            @RequestHeader(value="Authorization", required=false) String authHeader,
            @RequestBody OnboardingRequest request) {

        String email = authenticateAndGetEmail(authHeader);
        if (email == null) return ResponseEntity.status(401).body("Chưa đăng nhập hoặc Token không hợp lệ");

        try {
            userService.updateOnboarding(email, request);
            return ResponseEntity.ok(Map.of("message", "Cập nhật thông tin thành công!"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(e.getMessage());
        }
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @RequestHeader(value="Authorization", required=false) String authHeader,
            @RequestBody ProfileUpdateRequest request) {

        String email = authenticateAndGetEmail(authHeader);
        if (email == null) return ResponseEntity.status(401).body("Chưa đăng nhập hoặc Token không hợp lệ");

        try {
            userService.updateProfile(email, request);
            return ResponseEntity.ok(Map.of("message", "Cập nhật thông tin thành công!"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(e.getMessage());
        }
    }

    @PutMapping("/profile/avatar")
    public ResponseEntity<?> updateAvatar(
            @RequestHeader(value="Authorization", required=false) String authHeader,
            @RequestBody Map<String, String> request) {
        
        String email = authenticateAndGetEmail(authHeader);
        if (email == null) return ResponseEntity.status(401).body("Chưa đăng nhập hoặc Token không hợp lệ");

        try {
            String updatedAvatar = userService.updateAvatar(email, request.get("avatar"));
            return ResponseEntity.ok(Map.of("message", "Cập nhật ảnh đại diện thành công!", "avatar", updatedAvatar));
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(e.getMessage());
        }
    }

    @PutMapping("/profile/cover")
    public ResponseEntity<?> updateCover(
            @RequestHeader(value="Authorization", required=false) String authHeader,
            @RequestBody Map<String, String> request) {
        
        String email = authenticateAndGetEmail(authHeader);
        if (email == null) return ResponseEntity.status(401).body("Chưa đăng nhập hoặc Token không hợp lệ");

        try {
            String updatedCover = userService.updateCover(email, request.get("cover"));
            return ResponseEntity.ok(Map.of("message", "Cập nhật ảnh bìa thành công!", "cover", updatedCover));
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(e.getMessage());
        }
    }
}
