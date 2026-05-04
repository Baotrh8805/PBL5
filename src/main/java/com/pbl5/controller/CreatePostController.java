package com.pbl5.controller;

import com.pbl5.dto.CreatePostRequest;
import com.pbl5.dto.PostResponse;
import com.pbl5.model.User;
import com.pbl5.repository.UserRepository;
import com.pbl5.security.JwtTokenProvider;
import com.pbl5.service.PostService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controller riêng cho việc đăng bài mới với kiểm tra nội dung AI
 */
@RestController
@RequestMapping("/api/posts/create")
public class CreatePostController {

    @Autowired
    private PostService postService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    /**
     * Tạo bài đăng mới
     * - Đăng bài ngay để người dùng có trải nghiệm tức thì
     * - Kiểm duyệt nội dung chạy nền và có thể xóa bài nếu vi phạm nặng
     */
    @PostMapping
    public ResponseEntity<?> createPost(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody CreatePostRequest request) {

        // Lấy user từ token
        User user = getAuthenticatedUser(authHeader);
        if (user == null) {
            return ResponseEntity.status(401).body("Chưa đăng nhập.");
        }

        // Chỉ từ chối khi cả nội dung lẫn media đều trống
        boolean hasContent = request.getContent() != null && !request.getContent().trim().isEmpty();
        boolean hasMedia = (request.getImageUrl() != null && !request.getImageUrl().trim().isEmpty())
                || (request.getVideoUrl() != null && !request.getVideoUrl().trim().isEmpty());
        if (!hasContent && !hasMedia) {
            return ResponseEntity.badRequest().body("Nội dung bài đăng không được trống.");
        }

        // Tạo bài đăng ngay, kiểm duyệt thực hiện bất đồng bộ ở tầng service
        PostResponse postResponse = postService.createPost(user, request);

        return ResponseEntity.ok(postResponse);
    }

    /**
     * Helper method để lấy user từ token
     */
    private User getAuthenticatedUser(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token)) {
            return null;
        }
        String email = tokenProvider.getEmailFromJWT(token);
        return userRepository.findByEmail(email).orElse(null);
    }
}
