package com.pbl5.controller;

import com.pbl5.enums.PostStatus;
import com.pbl5.enums.Provider;
import com.pbl5.enums.ReportStatus;
import com.pbl5.enums.Role;
import com.pbl5.enums.UserStatus;
import com.pbl5.model.LoginHistory;
import com.pbl5.model.Notification;
import com.pbl5.model.Post;
import com.pbl5.model.User;
import com.pbl5.repository.CommentRepository;
import com.pbl5.repository.LikeRepository;
import com.pbl5.repository.LoginHistoryRepository;
import com.pbl5.repository.NotificationRepository;
import com.pbl5.repository.PostRepository;
import com.pbl5.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import com.pbl5.model.Comment;
import com.pbl5.model.Report;

/**
 * Controller dành riêng cho Admin.
 * Tất cả endpoint yêu cầu role ADMIN (đã cấu hình trong SecurityConfig).
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private LikeRepository likeRepository;

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private LoginHistoryRepository loginHistoryRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private com.pbl5.repository.ReportRepository reportRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    // ==================== QUẢN LÝ NGƯỜI DÙNG ====================

    /** Lấy danh sách người dùng (không bao gồm kiểm duyệt viên) */
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        List<Map<String, Object>> users = userRepository.findByRole(Role.USER).stream()
                .map(u -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", u.getId());
                    map.put("email", u.getEmail());
                    map.put("fullName", u.getFullName());
                    map.put("username", u.getUsername());
                    map.put("role", u.getRole());
                    map.put("status", u.getStatus());
                    map.put("provider", u.getProvider());
                    map.put("avatar", u.getAvatar());
                    return map;
                }).collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    /** Lấy thông tin chi tiết một người dùng theo ID */
    @GetMapping("/users/{id}")
    public ResponseEntity<?> getUserById(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy người dùng");

        User u = userOpt.get();
        Map<String, Object> map = new HashMap<>();
        map.put("id", u.getId());
        map.put("email", u.getEmail());
        map.put("fullName", u.getFullName());
        map.put("username", u.getUsername());
        map.put("gender", u.getGender());
        map.put("bio", u.getBio());
        map.put("phoneNumber", u.getPhoneNumber());
        map.put("dateOfBirth", u.getDateOfBirth());
        map.put("role", u.getRole());
        map.put("status", u.getStatus());
        map.put("provider", u.getProvider());
        map.put("avatar", u.getAvatar());
        return ResponseEntity.ok(map);
    }

    /** Khoá tài khoản người dùng (đặt status = BANNED) */
    @PutMapping("/users/{id}/ban")
    public ResponseEntity<?> banUser(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy người dùng");

        User user = userOpt.get();
        if (user.getRole() == Role.ADMIN) {
            return ResponseEntity.status(403).body("Không thể khoá tài khoản Admin khác");
        }
        user.setStatus(UserStatus.BANNED);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã khoá tài khoản người dùng ID " + id));
    }

    /** Mở khoá tài khoản người dùng (đặt status = ACTIVE) */
    @PutMapping("/users/{id}/unban")
    public ResponseEntity<?> unbanUser(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy người dùng");

        User user = userOpt.get();
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã mở khoá tài khoản người dùng ID " + id));
    }

    /** Cảnh báo người dùng (đặt status = WARNING) */
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

    /** Thay đổi role của người dùng (USER / MODERATOR / ADMIN) */
    @PutMapping("/users/{id}/role")
    public ResponseEntity<?> changeRole(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy người dùng");

        String roleStr = body.get("role");
        if (roleStr == null)
            return ResponseEntity.status(400).body("Thiếu trường 'role'");

        Role newRole;
        try {
            newRole = Role.valueOf(roleStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body("Role không hợp lệ. Chỉ chấp nhận: USER, MODERATOR, ADMIN");
        }

        User user = userOpt.get();
        user.setRole(newRole);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã cập nhật role thành " + newRole + " cho người dùng ID " + id));
    }

    /** Xoá tài khoản người dùng */
    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy người dùng");

        User user = userOpt.get();
        if (user.getRole() == Role.ADMIN) {
            return ResponseEntity.status(403).body("Không thể xoá tài khoản Admin");
        }
        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Đã xoá tài khoản người dùng ID " + id));
    }

    // ==================== QUẢN LÝ BÀI VIẾT ====================

    /**
     * Lấy danh sách bài viết — hỗ trợ phân trang.
     * Dùng batch COUNT query thay vì lazy-load likes/comments collections → loại bỏ
     * N+1.
     * Không trả comments trong danh sách (chỉ trả khi xem chi tiết).
     */
    @GetMapping("/posts")
    public ResponseEntity<?> getAllPosts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<Post> postPage = postRepository.findAllByOrderByCreatedAtDesc(pageable);
        List<Post> posts = postPage.getContent();

        // Batch COUNT: 2 queries thay vì 2×N queries
        List<Long> postIds = posts.stream().map(Post::getId).collect(Collectors.toList());

        Map<Long, Long> likeCounts = new HashMap<>();
        Map<Long, Long> commentCounts = new HashMap<>();

        if (!postIds.isEmpty()) {
            likeRepository.countLikesByPostIds(postIds)
                    .forEach(row -> likeCounts.put((Long) row[0], (Long) row[1]));
            commentRepository.countCommentsByPostIds(postIds)
                    .forEach(row -> commentCounts.put((Long) row[0], (Long) row[1]));
        }

        List<Map<String, Object>> result = posts.stream().map(p -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", p.getId());
            map.put("content", p.getContent());
            map.put("imageUrl", p.getImageUrl());
            map.put("visibility", p.getVisibility());
            map.put("createdAt", p.getCreatedAt());
            map.put("likeCount", likeCounts.getOrDefault(p.getId(), 0L));
            map.put("commentCount", commentCounts.getOrDefault(p.getId(), 0L));
            map.put("bestScore", p.getBestScore());
            map.put("nsfwScore", p.getNsfwScore());
            map.put("violenceScore", p.getViolenceScore());
            map.put("hateSpeechScore", p.getHateSpeechScore());
            map.put("status", p.getStatus());
            if (p.getUser() != null) {
                Map<String, Object> user = new HashMap<>();
                user.put("id", p.getUser().getId());
                user.put("fullName", p.getUser().getFullName());
                user.put("avatar", p.getUser().getAvatar());
                user.put("email", p.getUser().getEmail());
                map.put("user", user);
            }
            return map;
        }).collect(Collectors.toList());

        // Trả về dạng paged response để frontend biết tổng số và trang
        Map<String, Object> response = new HashMap<>();
        response.put("content", result);
        response.put("totalElements", postPage.getTotalElements());
        response.put("totalPages", postPage.getTotalPages());
        response.put("currentPage", page);
        response.put("pageSize", size);
        return ResponseEntity.ok(response);
    }

    /**
     * Lấy chi tiết một bài viết (bao gồm comments) — dùng khi mở modal.
     * Tách riêng khỏi danh sách để không phải load comments cho mọi bài.
     */
    @GetMapping("/posts/{id}")
    public ResponseEntity<?> getPostById(@PathVariable Long id) {
        Optional<Post> postOpt = postRepository.findById(id);
        if (postOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy bài viết");

        Post p = postOpt.get();
        Map<String, Object> map = new HashMap<>();
        map.put("id", p.getId());
        map.put("content", p.getContent());
        map.put("imageUrl", p.getImageUrl());
        map.put("videoUrl", p.getVideoUrl());
        map.put("visibility", p.getVisibility());
        map.put("createdAt", p.getCreatedAt());
        map.put("likeCount", likeRepository.countByPostId(id));
        map.put("commentCount", commentRepository.countByPostId(id));
        map.put("bestScore", p.getBestScore());
        map.put("nsfwScore", p.getNsfwScore());
        map.put("violenceScore", p.getViolenceScore());
        map.put("hateSpeechScore", p.getHateSpeechScore());
        map.put("status", p.getStatus());
        if (p.getUser() != null) {
            Map<String, Object> user = new HashMap<>();
            user.put("id", p.getUser().getId());
            user.put("fullName", p.getUser().getFullName());
            user.put("avatar", p.getUser().getAvatar());
            user.put("email", p.getUser().getEmail());
            map.put("user", user);
        }
        if (p.getComments() != null) {
            List<Map<String, Object>> comments = p.getComments().stream().map(c -> {
                Map<String, Object> cm = new HashMap<>();
                cm.put("id", c.getId());
                cm.put("content", c.getContent());
                cm.put("createdAt", c.getCreatedAt());
                if (c.getUser() != null) {
                    Map<String, Object> cu = new HashMap<>();
                    cu.put("id", c.getUser().getId());
                    cu.put("fullName", c.getUser().getFullName());
                    cu.put("avatar", c.getUser().getAvatar());
                    cm.put("user", cu);
                }
                return cm;
            }).collect(Collectors.toList());
            map.put("comments", comments);
        }
        return ResponseEntity.ok(map);
    }

    /**
     * Gỡ bài viết thay vì xóa vĩnh viễn (để hiển thị trạng thái bị gỡ cho tác giả)
     */
    @DeleteMapping("/posts/{id}")
    public ResponseEntity<?> deletePost(@PathVariable Long id) {
        Post post = postRepository.findById(id).orElse(null);
        if (post == null) {
            return ResponseEntity.status(404).body("Không tìm thấy bài viết");
        }

        List<Report> reports = reportRepository.findByPost(post);
        for (Report r : reports) {
            r.setStatus(com.pbl5.enums.ReportStatus.RESOLVED);
            r.setAdminNote("Bài viết đã bị gỡ bỏ do vi phạm.");
            reportRepository.save(r);
            createNotification(r.getUser(), null, "REPORT_RESOLVED",
                    "Báo cáo của bạn về một bài viết vi phạm đã được xử lý bằng cách gỡ bỏ bài viết. Cảm ơn bạn!", "/");
        }

        createNotification(post.getUser(), null, "REPORT_WARNING",
                "Bài viết của bạn đã bị gỡ khỏi hệ thống do vi phạm tiêu chuẩn cộng đồng.", "/");

        // Gán trạng thái AUTO_REJECTED để bài viết vẫn còn trong DB nhưng bị ẩn/đánh
        // dấu "đã bị gỡ"
        post.setStatus(com.pbl5.enums.PostStatus.AUTO_REJECTED);
        postRepository.save(post);

        return ResponseEntity.ok(Map.of("message", "Đã gỡ bài viết ID " + id));
    }

    /** Xóa bình luận theo ID */
    @DeleteMapping("/comments/{id}")
    public ResponseEntity<?> deleteComment(@PathVariable Long id) {
        Comment comment = commentRepository.findById(id).orElse(null);
        if (comment == null) {
            return ResponseEntity.status(404).body("Không tìm thấy bình luận");
        }

        List<Report> reports = reportRepository.findByComment(comment);
        for (Report r : reports) {
            r.setComment(null);
            r.setStatus(com.pbl5.enums.ReportStatus.RESOLVED);
            r.setAdminNote("Bình luận đã bị quản trị viên xóa do vi phạm.");
            reportRepository.save(r);
            createNotification(r.getUser(), null, "REPORT_RESOLVED",
                    "Báo cáo của bạn về một bình luận vi phạm đã được xử lý bằng cách xóa bình luận. Cảm ơn bạn!", "/");
        }

        createNotification(comment.getUser(), null, "REPORT_WARNING",
                "Bình luận của bạn đã bị quản trị viên xóa do vi phạm tiêu chuẩn cộng đồng.", "/");

        commentRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Đã xoá bình luận ID " + id));
    }

    // ==================== LỊCH SỬ ĐĂNG NHẬP ====================

    /** Lấy lịch sử đăng nhập của một người dùng */
    @GetMapping("/users/{id}/login-history")
    public ResponseEntity<?> getLoginHistory(@PathVariable Long id) {
        if (!userRepository.existsById(id)) {
            return ResponseEntity.status(404).body("Không tìm thấy người dùng");
        }
        List<Map<String, Object>> history = loginHistoryRepository
                .findByUserIdOrderByLoginAtDesc(id)
                .stream().map(h -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", h.getId());
                    map.put("loginAt", h.getLoginAt());
                    map.put("ipAddress", h.getIpAddress());
                    map.put("provider", h.getProvider());
                    return map;
                }).collect(Collectors.toList());
        return ResponseEntity.ok(history);
    }

    // ==================== QUẢN LÝ KIỂM DUYỆT VIÊN ====================

    /** Lấy danh sách tất cả kiểm duyệt viên */
    @GetMapping("/moderators")
    public ResponseEntity<?> getAllModerators() {
        List<Map<String, Object>> moderators = userRepository.findByRole(Role.MODERATOR).stream().map(u -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", u.getId());
            map.put("email", u.getEmail());
            map.put("fullName", u.getFullName());
            map.put("username", u.getUsername());
            map.put("status", u.getStatus());
            map.put("provider", u.getProvider());
            map.put("avatar", u.getAvatar());
            map.put("phoneNumber", u.getPhoneNumber());
            map.put("gender", u.getGender());
            map.put("dateOfBirth", u.getDateOfBirth());
            map.put("bio", u.getBio());
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(moderators);
    }

    /** Lấy thông tin chi tiết một kiểm duyệt viên theo ID */
    @GetMapping("/moderators/{id}")
    public ResponseEntity<?> getModeratorById(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy kiểm duyệt viên");
        User u = userOpt.get();
        if (u.getRole() != Role.MODERATOR)
            return ResponseEntity.status(400).body("Người dùng này không phải kiểm duyệt viên");

        Map<String, Object> map = new HashMap<>();
        map.put("id", u.getId());
        map.put("email", u.getEmail());
        map.put("fullName", u.getFullName());
        map.put("username", u.getUsername());
        map.put("gender", u.getGender());
        map.put("bio", u.getBio());
        map.put("phoneNumber", u.getPhoneNumber());
        map.put("dateOfBirth", u.getDateOfBirth());
        map.put("status", u.getStatus());
        map.put("provider", u.getProvider());
        map.put("avatar", u.getAvatar());
        return ResponseEntity.ok(map);
    }

    /** Tạo tài khoản kiểm duyệt viên mới */
    @PostMapping("/moderators")
    public ResponseEntity<?> createModerator(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String fullName = body.get("fullName");
        String password = body.get("password");
        String username = body.get("username");

        if (email == null || email.isBlank())
            return ResponseEntity.status(400).body("Email không được để trống");
        if (fullName == null || fullName.isBlank())
            return ResponseEntity.status(400).body("Tên hiển thị không được để trống");
        if (password == null || password.length() < 6)
            return ResponseEntity.status(400).body("Mật khẩu phải có ít nhất 6 ký tự");

        if (userRepository.existsByEmail(email))
            return ResponseEntity.status(409).body("Email đã được sử dụng");
        if (userRepository.existsByFullName(fullName))
            return ResponseEntity.status(409).body("Tên hiển thị đã được sử dụng");
        if (username != null && !username.isBlank() && userRepository.existsByUsername(username)) {
            return ResponseEntity.status(409).body("Tên đăng nhập đã được sử dụng");
        }

        User moderator = new User();
        moderator.setEmail(email);
        moderator.setFullName(fullName);
        moderator.setPassword(passwordEncoder.encode(password));
        moderator.setUsername(username != null && !username.isBlank() ? username : null);
        moderator.setRole(Role.MODERATOR);
        moderator.setStatus(UserStatus.ACTIVE);
        moderator.setProvider(Provider.LOCAL);
        userRepository.save(moderator);

        return ResponseEntity.ok(Map.of("message", "Đã tạo tài khoản kiểm duyệt viên thành công"));
    }

    /** Cập nhật thông tin kiểm duyệt viên */
    @PutMapping("/moderators/{id}")
    public ResponseEntity<?> updateModerator(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy kiểm duyệt viên");
        User user = userOpt.get();
        if (user.getRole() != Role.MODERATOR)
            return ResponseEntity.status(400).body("Người dùng này không phải kiểm duyệt viên");

        String email = body.get("email");
        String phoneNumber = body.get("phoneNumber");
        String gender = body.get("gender");
        String dateOfBirth = body.get("dateOfBirth");

        if (email != null && !email.isBlank()) {
            if (!email.equals(user.getEmail()) && userRepository.existsByEmail(email)) {
                return ResponseEntity.status(409).body("Email đã được sử dụng bởi tài khoản khác");
            }
            user.setEmail(email.trim());
        }
        if (phoneNumber != null) {
            String phone = phoneNumber.isBlank() ? null : phoneNumber.trim();
            if (phone != null && !phone.equals(user.getPhoneNumber()) && userRepository.existsByPhoneNumber(phone)) {
                return ResponseEntity.status(409).body("Số điện thoại đã được sử dụng bởi tài khoản khác");
            }
            user.setPhoneNumber(phone);
        }
        if (gender != null)
            user.setGender(gender.isBlank() ? null : gender.trim());
        if (dateOfBirth != null) {
            user.setDateOfBirth(dateOfBirth.isBlank() ? null : java.time.LocalDate.parse(dateOfBirth));
        }

        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã cập nhật thông tin kiểm duyệt viên ID " + id));
    }

    /** Khoá tài khoản kiểm duyệt viên */
    @PutMapping("/moderators/{id}/lock")
    public ResponseEntity<?> lockModerator(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy kiểm duyệt viên");
        User user = userOpt.get();
        if (user.getRole() != Role.MODERATOR)
            return ResponseEntity.status(400).body("Người dùng này không phải kiểm duyệt viên");
        user.setStatus(UserStatus.BANNED);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã khoá tài khoản kiểm duyệt viên ID " + id));
    }

    /** Kích hoạt lại tài khoản kiểm duyệt viên */
    @PutMapping("/moderators/{id}/activate")
    public ResponseEntity<?> activateModerator(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy kiểm duyệt viên");
        User user = userOpt.get();
        if (user.getRole() != Role.MODERATOR)
            return ResponseEntity.status(400).body("Người dùng này không phải kiểm duyệt viên");
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã kích hoạt lại tài khoản kiểm duyệt viên ID " + id));
    }

    /** Xoá tài khoản kiểm duyệt viên */
    @DeleteMapping("/moderators/{id}")
    public ResponseEntity<?> deleteModerator(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy kiểm duyệt viên");
        User user = userOpt.get();
        if (user.getRole() != Role.MODERATOR)
            return ResponseEntity.status(400).body("Người dùng này không phải kiểm duyệt viên");
        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Đã xoá tài khoản kiểm duyệt viên ID " + id));
    }

    // ==================== QUẢN LÝ BÁO CÁO (REPORTS) ====================

    /** Lấy danh sách tất cả báo cáo */
    @GetMapping("/reports")
    public ResponseEntity<?> getAllReports() {
        List<Map<String, Object>> reports = reportRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(r -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", r.getId());
                    map.put("reason", r.getReason());
                    map.put("status", r.getStatus() != null ? r.getStatus().name() : "PENDING");
                    map.put("category", r.getCategory() != null ? r.getCategory().name() : "OTHER");
                    map.put("createdAt", r.getCreatedAt());
                    map.put("adminNote", r.getAdminNote());
                    map.put("resolvedAt", r.getResolvedAt());
                    // Loại báo cáo: POST hoặc COMMENT
                    map.put("targetType", r.getComment() != null ? "COMMENT" : "POST");

                    if (r.getUser() != null) {
                        Map<String, Object> reporterMap = new HashMap<>();
                        reporterMap.put("id", r.getUser().getId());
                        reporterMap.put("fullName", r.getUser().getFullName());
                        reporterMap.put("avatar", r.getUser().getAvatar() != null ? r.getUser().getAvatar() : "");
                        map.put("reporter", reporterMap);
                    }

                    if (r.getPost() != null) {
                        Map<String, Object> postMap = new HashMap<>();
                        postMap.put("id", r.getPost().getId());
                        postMap.put("content", r.getPost().getContent());
                        postMap.put("imageUrl", r.getPost().getImageUrl());
                        if (r.getPost().getUser() != null) {
                            postMap.put("authorName", r.getPost().getUser().getFullName());
                        }
                        map.put("post", postMap);
                    }

                    if (r.getComment() != null) {
                        Map<String, Object> commentMap = new HashMap<>();
                        commentMap.put("id", r.getComment().getId());
                        commentMap.put("content", r.getComment().getContent());
                        if (r.getComment().getUser() != null) {
                            commentMap.put("authorName", r.getComment().getUser().getFullName());
                        }
                        map.put("comment", commentMap);
                    }

                    if (r.getResolvedBy() != null) {
                        map.put("resolvedByName", r.getResolvedBy().getFullName());
                    }
                    return map;
                }).collect(Collectors.toList());
        return ResponseEntity.ok(reports);
    }

    /**
     * Xử lý báo cáo: RESOLVED hoặc DISMISSED.
     * RESOLVED: ẩn bài viết (PENDING_REVIEW) + cảnh cáo user vi phạm (WARNING)
     * + thông báo cho reporter + thông báo cho user vi phạm.
     * DISMISSED: đánh dấu đã xem, thông báo reporter rằng không vi phạm.
     */
    @PutMapping("/reports/{id}/status")
    public ResponseEntity<?> updateReportStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Optional<com.pbl5.model.Report> reportOpt = reportRepository.findById(id);
        if (reportOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy báo cáo");

        String statusStr = body.get("status");
        ReportStatus status;
        try {
            status = ReportStatus.valueOf(statusStr);
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Trạng thái không hợp lệ. Chỉ chấp nhận: RESOLVED, DISMISSED");
        }
        if (status != ReportStatus.RESOLVED && status != ReportStatus.DISMISSED) {
            return ResponseEntity.status(400).body("Trạng thái không hợp lệ. Chỉ chấp nhận: RESOLVED, DISMISSED");
        }

        com.pbl5.model.Report report = reportOpt.get();
        report.setStatus(status);
        report.setResolvedAt(LocalDateTime.now());

        // Ghi chú admin (nếu có)
        String adminNote = body.get("adminNote");
        if (adminNote != null && !adminNote.isBlank()) {
            report.setAdminNote(adminNote.trim());
        }

        reportRepository.save(report);

        if (status == ReportStatus.RESOLVED) {
            // === ẨN BÀI VIẾT VI PHẠM ===
            if (report.getPost() != null) {
                Post violatingPost = report.getPost();
                violatingPost.setStatus(PostStatus.PENDING_REVIEW);
                postRepository.save(violatingPost);

                // Cảnh cáo chủ bài viết
                User violator = violatingPost.getUser();
                if (violator != null && violator.getStatus() != UserStatus.BANNED) {
                    violator.setStatus(UserStatus.WARNING);
                    userRepository.save(violator);

                    // Thông báo cho user vi phạm
                    createNotification(violator, null, "REPORT_WARNING",
                            "Bài viết của bạn đã bị ẩn do vi phạm quy tắc cộng đồng.",
                            null);
                }
            }

            // === ẨN COMMENT VI PHẠM (xoá comment) ===
            if (report.getComment() != null) {
                com.pbl5.model.Comment violatingComment = report.getComment();
                User commentAuthor = violatingComment.getUser();
                if (commentAuthor != null && commentAuthor.getStatus() != UserStatus.BANNED) {
                    commentAuthor.setStatus(UserStatus.WARNING);
                    userRepository.save(commentAuthor);

                    createNotification(commentAuthor, null, "REPORT_WARNING",
                            "Bình luận của bạn đã bị xoá do vi phạm quy tắc cộng đồng.",
                            null);
                }
            }

            // Thông báo cho reporter
            if (report.getUser() != null) {
                createNotification(report.getUser(), null, "REPORT_RESOLVED",
                        "Báo cáo của bạn đã được xử lý. Nội dung vi phạm đã bị ẩn. Cảm ơn bạn đã giúp cộng đồng!",
                        null);
            }
        } else if (status == ReportStatus.DISMISSED) {
            // Thông báo cho reporter
            if (report.getUser() != null) {
                createNotification(report.getUser(), null, "REPORT_DISMISSED",
                        "Báo cáo của bạn đã được xem xét. Nội dung không vi phạm quy tắc cộng đồng.",
                        null);
            }
        }

        return ResponseEntity.ok(Map.of("message", "Đã cập nhật trạng thái báo cáo ID " + id + " thành " + statusStr));
    }

    /** Xoá báo cáo */
    @DeleteMapping("/reports/{id}")
    public ResponseEntity<?> deleteReport(@PathVariable Long id) {
        if (!reportRepository.existsById(id))
            return ResponseEntity.status(404).body("Không tìm thấy báo cáo");
        reportRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Đã xoá báo cáo ID " + id));
    }

    /** Tạo thông báo hệ thống */
    private void createNotification(User recipient, User sender, String type, String message, String link) {
        Notification notif = new Notification();
        notif.setUser(recipient);
        notif.setSender(sender);
        notif.setType(type);
        notif.setMessage(message);
        notif.setLink(link);
        notificationRepository.save(notif);
    }

    // ==================== THỐNG KÊ ====================

    /** Thống kê tổng quan hệ thống */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        long totalUsers = userRepository.count();
        long totalPosts = postRepository.count();
        long bannedUsers = userRepository.countByStatus(UserStatus.BANNED);
        long moderators = userRepository.countByRole(Role.MODERATOR);
        long pendingReports = reportRepository.countByStatus(ReportStatus.PENDING);

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", totalUsers);
        stats.put("totalPosts", totalPosts);
        stats.put("bannedUsers", bannedUsers);
        stats.put("moderators", moderators);
        stats.put("pendingReports", pendingReports);
        return ResponseEntity.ok(stats);
    }
}
