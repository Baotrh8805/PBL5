package com.pbl5.controller;

import com.pbl5.enums.PostStatus;
import com.pbl5.enums.UserStatus;
import com.pbl5.model.Post;
import com.pbl5.model.User;
import com.pbl5.repository.CommentRepository;
import com.pbl5.repository.PostRepository;
import com.pbl5.repository.UserRepository;
import com.pbl5.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Controller dành cho Moderator và Admin.
 * Tập trung vào kiểm duyệt nội dung: bài viết, bình luận, cảnh báo user.
 */
@RestController
@RequestMapping("/api/moderator")
@PreAuthorize("hasAnyRole('MODERATOR', 'ADMIN')")
public class ModeratorController {

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    // ==================== KIỂM DUYỆT BÀI VIẾT ====================

    /** Lấy tất cả bài viết (để xem xét nội dung) */
    @GetMapping("/posts")
    public ResponseEntity<?> getAllPosts() {
        List<Map<String, Object>> result = postRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(p -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", p.getId());
                    map.put("content", p.getContent());
                    map.put("imageUrl", p.getImageUrl());
                    map.put("videoUrl", p.getVideoUrl());
                    map.put("visibility", p.getVisibility());
                    map.put("createdAt", p.getCreatedAt());
                    map.put("status", p.getStatus());
                    map.put("bestScore", p.getBestScore());
                    map.put("nsfwScore", p.getNsfwScore());
                    map.put("violenceScore", p.getViolenceScore());
                    map.put("hateSpeechScore", p.getHateSpeechScore());
                    map.put("violationDetected", p.getStatus() == PostStatus.PENDING_REVIEW);
                    map.put("violationLabel", resolveViolationLabel(p));
                    map.put("violationMediaType", resolveMediaType(p));
                    map.put("nsfwBox", p.getNsfwBox());
                    map.put("violenBox", p.getViolenBox());
                    map.put("hateSpeechWord", p.getHateSpeechWord());
                    map.put("violationEvidence", buildViolationEvidence(p));
                    map.put("violationRate", p.getViolationRate());
                    map.put("authorId", p.getUser().getId());
                    map.put("authorName", p.getUser().getFullName());
                    map.put("moderationStartedAt", p.getModerationStartedAt());
                    map.put("processingModeratorId",
                            p.getProcessingModerator() != null ? p.getProcessingModerator().getId() : null);
                    map.put("processingModeratorName",
                            p.getProcessingModerator() != null ? p.getProcessingModerator().getFullName() : null);
                    map.put("likeCount", p.getLikes().size());
                    map.put("commentCount", p.getComments().size());
                    return map;
                }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /** Moderator bấm bắt đầu xử lý một vi phạm */
    @PostMapping("/posts/{id}/start-processing")
    public ResponseEntity<?> startProcessingPost(@PathVariable long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User moderator = getAuthenticatedUser(authHeader);
        if (moderator == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        Optional<Post> postOpt = postRepository.findById(id);
        if (postOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Không tìm thấy bài viết");
        }

        Post post = postOpt.get();
        if (post.getStatus() != PostStatus.PENDING_REVIEW) {
            return ResponseEntity.status(400).body("Bài viết không nằm trong danh sách chờ duyệt");
        }

        if (post.getModerationStartedAt() == null) {
            post.setModerationStartedAt(LocalDateTime.now());
            post.setProcessingModerator(moderator);
            postRepository.save(post);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("postId", post.getId());
        response.put("moderationStartedAt", post.getModerationStartedAt());
        response.put("processingModeratorName",
                post.getProcessingModerator() != null ? post.getProcessingModerator().getFullName() : null);
        return ResponseEntity.ok(response);
    }

    /** Xoá bài viết vi phạm */
    @DeleteMapping("/posts/{id}")
    public ResponseEntity<?> deletePost(@PathVariable long id) {
        if (!postRepository.existsById(id)) {
            return ResponseEntity.status(404).body("Không tìm thấy bài viết");
        }
        postRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Đã xoá bài viết ID " + id));
    }

    /** Xoá bình luận vi phạm */
    @DeleteMapping("/comments/{id}")
    public ResponseEntity<?> deleteComment(@PathVariable long id) {
        if (!commentRepository.existsById(id)) {
            return ResponseEntity.status(404).body("Không tìm thấy bình luận");
        }
        commentRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Đã xoá bình luận ID " + id));
    }

    // ==================== KIỂM DUYỆT NGƯỜI DÙNG ====================

    /** Lấy danh sách người dùng (chỉ thông tin cơ bản) */
    @GetMapping("/users")
    public ResponseEntity<?> getUsers() {
        List<Map<String, Object>> users = userRepository.findAll().stream().map(u -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", u.getId());
            map.put("fullName", u.getFullName());
            map.put("email", u.getEmail());
            map.put("status", u.getStatus());
            map.put("role", u.getRole());
            map.put("avatar", u.getAvatar());
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    /** Cảnh báo người dùng vi phạm lần đầu (đặt status = WARNING) */
    @PutMapping("/users/{id}/warn")
    public ResponseEntity<?> warnUser(@PathVariable long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy người dùng");

        User user = userOpt.get();
        user.setStatus(UserStatus.WARNING);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã gửi cảnh báo đến người dùng ID " + id));
    }

    /** Khoá người dùng (đặt status = BANNED) */
    @PutMapping("/users/{id}/ban")
    public ResponseEntity<?> banUser(@PathVariable long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy người dùng");

        User user = userOpt.get();
        user.setStatus(UserStatus.BANNED);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã khoá người dùng ID " + id));
    }

    /** Mở khoá người dùng (đặt status = ACTIVE) */
    @PutMapping("/users/{id}/unban")
    public ResponseEntity<?> unbanUser(@PathVariable long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy người dùng");

        User user = userOpt.get();
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã gỡ phạt người dùng ID " + id));
    }

    /** Xem bài viết của một người dùng cụ thể */
    @GetMapping("/users/{id}/posts")
    public ResponseEntity<?> getPostsByUser(@PathVariable long id) {
        if (!userRepository.existsById(id)) {
            return ResponseEntity.status(404).body("Không tìm thấy người dùng");
        }
        List<Post> posts = postRepository.findByUserIdOrderByCreatedAtDesc(id);
        List<Map<String, Object>> result = posts.stream().map(p -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", p.getId());
            map.put("content", p.getContent());
            map.put("imageUrl", p.getImageUrl());
            map.put("visibility", p.getVisibility());
            map.put("createdAt", p.getCreatedAt());
            map.put("likeCount", p.getLikes().size());
            map.put("commentCount", p.getComments().size());
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

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

    private String resolveMediaType(Post post) {
        boolean hasImage = post.getImageUrl() != null && !post.getImageUrl().trim().isEmpty();
        boolean hasVideo = post.getVideoUrl() != null && !post.getVideoUrl().trim().isEmpty();

        if (hasImage && hasVideo) {
            return "mixed";
        }
        if (hasImage) {
            return "image";
        }
        if (hasVideo) {
            return "video";
        }
        return "text";
    }

    private String resolveViolationLabel(Post post) {
        double nsfw = post.getNsfwScore() != null ? post.getNsfwScore() : 0.0;
        double violence = post.getViolenceScore() != null ? post.getViolenceScore() : 0.0;
        double hateSpeech = post.getHateSpeechScore() != null ? post.getHateSpeechScore() : 0.0;

        if (nsfw < 0.30 && violence < 0.30 && hateSpeech < 0.30) {
            return "Không vi phạm";
        }
        if (nsfw >= violence && nsfw >= hateSpeech) {
            return "Nội dung nhạy cảm";
        }
        if (violence >= hateSpeech) {
            return "Bạo lực";
        }
        return "Ngôn từ thù ghét";
    }

    private String buildViolationEvidence(Post post) {
        String content = post.getContent();
        if (content != null && !content.trim().isEmpty()) {
            String trimmed = content.trim();
            return trimmed.length() <= 500 ? trimmed : trimmed.substring(0, 500) + "...";
        }
        return "Phát hiện vi phạm trên " + resolveMediaType(post);
    }
}
