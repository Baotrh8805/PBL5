package com.pbl5.controller;

import com.pbl5.enums.UserStatus;
import com.pbl5.model.Post;
import com.pbl5.model.User;
import com.pbl5.repository.CommentRepository;
import com.pbl5.repository.PostRepository;
import com.pbl5.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

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
                    map.put("visibility", p.getVisibility());
                    map.put("createdAt", p.getCreatedAt());
                    map.put("authorId", p.getUser().getId());
                    map.put("authorName", p.getUser().getFullName());
                    map.put("likeCount", p.getLikes().size());
                    map.put("commentCount", p.getComments().size());
                    return map;
                }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /** Xoá bài viết vi phạm */
    @DeleteMapping("/posts/{id}")
    public ResponseEntity<?> deletePost(@PathVariable Long id) {
        if (!postRepository.existsById(id)) {
            return ResponseEntity.status(404).body("Không tìm thấy bài viết");
        }
        postRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Đã xoá bài viết ID " + id));
    }

    /** Xoá bình luận vi phạm */
    @DeleteMapping("/comments/{id}")
    public ResponseEntity<?> deleteComment(@PathVariable Long id) {
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
    public ResponseEntity<?> warnUser(@PathVariable Long id) {
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
    public ResponseEntity<?> banUser(@PathVariable Long id) {
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
    public ResponseEntity<?> unbanUser(@PathVariable Long id) {
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
    public ResponseEntity<?> getPostsByUser(@PathVariable Long id) {
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
}
