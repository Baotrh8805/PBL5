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
import com.pbl5.repository.CommentLikeRepository;
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
import com.pbl5.security.JwtTokenProvider;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

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

    @Autowired
    private CommentLikeRepository commentLikeRepository;

    @Autowired
    private com.pbl5.repository.BookmarkRepository bookmarkRepository;

    @Autowired
    private com.pbl5.repository.HiddenPostRepository hiddenPostRepository;

    @Autowired
    private com.pbl5.repository.FriendshipRepository friendshipRepository;

    @Autowired
    private com.pbl5.repository.MessageRepository messageRepository;

    @Autowired
    private com.pbl5.repository.ChatGroupRepository chatGroupRepository;

    @Autowired
    private com.pbl5.repository.GroupReadStatusRepository groupReadStatusRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @PersistenceContext
    private EntityManager entityManager;

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
                    map.put("score", u.getScore());
                    map.put("postWarningExpiresAt", u.getPostWarningExpiresAt());
                    map.put("commentWarningExpiresAt", u.getCommentWarningExpiresAt());
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

    private User getAuthenticatedUser(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token)) return null;
        String email = tokenProvider.getEmailFromJWT(token);
        return userRepository.findByEmail(email).orElse(null);
    }

    private void sendNotification(User recipient, User sender, String type, String message, String link) {
        Notification notifEntity = new Notification();
        notifEntity.setUser(recipient);
        notifEntity.setSender(sender);
        notifEntity.setType(type);
        notifEntity.setMessage(message);
        notifEntity.setLink(link);
        notifEntity = notificationRepository.save(notifEntity);

        Map<String, Object> notification = new HashMap<>();
        notification.put("id", notifEntity.getId());
        notification.put("type", type);
        notification.put("message", message);
        notification.put("senderId", sender != null ? sender.getId() : null);
        notification.put("senderName", sender != null ? sender.getFullName() : "Hệ thống");
        notification.put("senderAvatar", sender != null ? sender.getAvatar() : null);
        notification.put("link", link);

        messagingTemplate.convertAndSend("/topic/notifications/" + recipient.getId(), notification);
    }

    /** Cảnh báo người dùng với tùy chọn hình thức và thời hạn */
    @PutMapping("/users/{id}/warn")
    public ResponseEntity<?> warnUser(@PathVariable Long id, 
            @RequestBody Map<String, Object> payload,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User admin = getAuthenticatedUser(authHeader);
        if (admin == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy người dùng");

        String type = (String) payload.get("type"); // "POST" hoặc "COMMENT"
        Integer days = (Integer) payload.get("days"); // 3, 7 hoặc 30

        if (type == null || days == null) {
            return ResponseEntity.badRequest().body("Thiếu thông tin hình thức hoặc thời hạn cảnh cáo");
        }

        User user = userOpt.get();
        user.setStatus(UserStatus.WARNING);
        
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        if ("POST".equals(type)) {
            java.time.LocalDateTime currentExpiry = user.getPostWarningExpiresAt();
            java.time.LocalDateTime baseTime = (currentExpiry != null && currentExpiry.isAfter(now)) ? currentExpiry : now;
            user.setPostWarningExpiresAt(baseTime.plusDays(days));
        } else if ("COMMENT".equals(type)) {
            java.time.LocalDateTime currentExpiry = user.getCommentWarningExpiresAt();
            java.time.LocalDateTime baseTime = (currentExpiry != null && currentExpiry.isAfter(now)) ? currentExpiry : now;
            user.setCommentWarningExpiresAt(baseTime.plusDays(days));
        }
        
        userRepository.save(user);

        String typeText = type.equals("POST") ? "đăng bài" : "bình luận";
        
        // Gửi thông báo hệ thống cho người dùng
        String message = "Bạn đã bị cảnh cáo " + typeText + " trong " + days + " ngày do vi phạm tiêu chuẩn cộng đồng.";
        sendNotification(user, admin, "WARNING", message, "/profile");

        return ResponseEntity.ok(Map.of("message", "Đã thiết lập cảnh cáo " + typeText + " cho người dùng trong " + days + " ngày."));
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

    /** Xoá vĩnh viễn tài khoản người dùng cùng toàn bộ dữ liệu liên quan */
    @DeleteMapping("/users/{id}")
    @org.springframework.transaction.annotation.Transactional(rollbackFor = Exception.class)
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body(Map.of("message", "Không tìm thấy người dùng"));

        User user = userOpt.get();
        if (user.getRole() == Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("message", "Không thể xoá tài khoản Admin"));
        }

        try {
            // ── 1. NULL hoá FK nullable trỏ về user ──────────────────────────────
            reportRepository.clearResolvedBy(id);
            postRepository.clearProcessingModerator(id);
            entityManager.flush();
            entityManager.clear();

            // Re-load user sau khi clear cache
            user = userRepository.findById(id).orElseThrow();

            // ── 2. Notifications ─────────────────────────────────────────────────
            notificationRepository.deleteByUserId(id);
            notificationRepository.deleteBySenderId(id);

            // ── 3. Lịch sử đăng nhập (bulk DELETE) ──────────────────────────────
            loginHistoryRepository.deleteByUserId(id);

            // ── 4. Tin nhắn của user (bulk delete) ───────────────────────────────
            messageRepository.deleteByUserId(id);

            // ── 5. GroupReadStatus + rời ChatGroup member list ────────────────────
            groupReadStatusRepository.deleteByUserId(id);
            for (com.pbl5.model.ChatGroup group : chatGroupRepository.findByUserMemberId(id)) {
                group.getMembers().remove(user);
                chatGroupRepository.save(group);
            }
            // Xóa nhóm do user tạo (createdBy NOT NULL)
            for (com.pbl5.model.ChatGroup ownedGroup : chatGroupRepository.findByCreatedById(id)) {
                groupReadStatusRepository.deleteByGroupId(ownedGroup.getId());
                messageRepository.deleteByGroupId(ownedGroup.getId());
                chatGroupRepository.delete(ownedGroup);
            }

            // ── 6. Friendships ────────────────────────────────────────────────────
            friendshipRepository.deleteAll(friendshipRepository.findAllByUser(user));

            // ── 7. CommentLike của user ───────────────────────────────────────────
            commentLikeRepository.deleteByUserId(id);

            // ── 8. HiddenPost và Bookmark của user ───────────────────────────────
            hiddenPostRepository.deleteAll(hiddenPostRepository.findByUserId(id));
            bookmarkRepository.deleteAll(bookmarkRepository.findByUserId(id));

            // ── 9. Bài viết của user ──────────────────────────────────────────────
            for (com.pbl5.model.Post post : postRepository.findByUserIdOrderByCreatedAtDesc(id)) {
                postRepository.clearSharedPostReference(post.getId());
                entityManager.flush();
                entityManager.clear();
                post = postRepository.findById(post.getId()).orElse(null);
                if (post == null) continue;
                reportRepository.deleteAll(reportRepository.findByPost(post));
                bookmarkRepository.deleteAll(bookmarkRepository.findByPostId(post.getId()));
                hiddenPostRepository.deleteAll(hiddenPostRepository.findByPostId(post.getId()));
                for (com.pbl5.model.Comment comment : commentRepository.findByPostIdOrderByCreatedAtDesc(post.getId())) {
                    commentLikeRepository.deleteByCommentId(comment.getId());
                    reportRepository.deleteAll(reportRepository.findByComment(comment));
                }
                commentRepository.deleteAll(commentRepository.findByPostIdOrderByCreatedAtDesc(post.getId()));
                likeRepository.deleteAll(likeRepository.findByPost(post));
                postRepository.delete(post);
            }

            // ── 10. Comment của user trên bài người khác ─────────────────────────
            for (com.pbl5.model.Comment comment : commentRepository.findByUserId(id)) {
                commentLikeRepository.deleteByCommentId(comment.getId());
                reportRepository.deleteAll(reportRepository.findByComment(comment));
                commentRepository.delete(comment);
            }

            // ── 11. Like của user trên bài người khác ────────────────────────────
            likeRepository.deleteAll(likeRepository.findByUserId(id));

            // ── 12. Report do user tạo ────────────────────────────────────────────
            reportRepository.deleteAll(reportRepository.findByUser(id));

            // ── 13. Xóa user ─────────────────────────────────────────────────────
            userRepository.delete(user);

            return ResponseEntity.ok(Map.of("message", "Đã xoá tài khoản và toàn bộ dữ liệu của người dùng ID " + id));

        } catch (Exception e) {
            throw new RuntimeException("Xoá user ID " + id + " thất bại: " + e.getMessage(), e);
        }
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
                    .forEach(row -> {
                        if (row[0] != null && row[1] != null) {
                            likeCounts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
                        }
                    });
            commentRepository.countCommentsByPostIds(postIds)
                    .forEach(row -> {
                        if (row[0] != null && row[1] != null) {
                            commentCounts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
                        }
                    });
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
            map.put("speechLabels", p.getSpeechLabels());
            map.put("hateSpeechContentScore", p.getHateSpeechContentScore());
            map.put("hateSpeechVideoScore", p.getHateSpeechVideoScore());
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
        map.put("speechLabels", p.getSpeechLabels());
        map.put("hateSpeechContentScore", p.getHateSpeechContentScore());
        map.put("hateSpeechVideoScore", p.getHateSpeechVideoScore());
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
                "Bài viết của bạn đã bị gỡ khỏi hệ thống do vi phạm tiêu chuẩn cộng đồng. Bạn có 3 ngày để xem lại bài viết trước khi bị xóa hoàn toàn.", 
                "/html/post.html?id=" + post.getId());

        // Gán trạng thái AUTO_REJECTED để bài viết vẫn còn trong DB nhưng bị ẩn/đánh
        // dấu "đã bị gỡ"
        post.setStatus(com.pbl5.enums.PostStatus.AUTO_REJECTED);
        post.setReviewedAt(LocalDateTime.now());
        postRepository.save(post);

        // Cộng điểm vi phạm cho người dùng (tác giả bài viết)
        User author = post.getUser();
        if (author != null) {
            int currentScore = author.getScore() != null ? author.getScore() : 0;
            author.setScore(currentScore + 1);
            userRepository.save(author);
        }

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

        commentLikeRepository.deleteByCommentId(id);
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

    /** Xoá vĩnh viễn tài khoản kiểm duyệt viên cùng toàn bộ dữ liệu liên quan */
    @DeleteMapping("/moderators/{id}")
    @org.springframework.transaction.annotation.Transactional(rollbackFor = Exception.class)
    public ResponseEntity<?> deleteModerator(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty())
            return ResponseEntity.status(404).body(Map.of("message", "Không tìm thấy kiểm duyệt viên"));
        User user = userOpt.get();
        if (user.getRole() != Role.MODERATOR)
            return ResponseEntity.status(400).body(Map.of("message", "Người dùng này không phải kiểm duyệt viên"));

        try {
            // ── 1. NULL hoá FK nullable trỏ về moderator ─────────────────────
            postRepository.clearProcessingModerator(id);
            reportRepository.clearResolvedBy(id);
            entityManager.flush();
            entityManager.clear();

            user = userRepository.findById(id).orElseThrow();

            // ── 2. Notifications ──────────────────────────────────────────────
            notificationRepository.deleteByUserId(id);
            notificationRepository.deleteBySenderId(id);

            // ── 3. Lịch sử đăng nhập ─────────────────────────────────────────
            loginHistoryRepository.deleteByUserId(id);

            // ── 4. Tin nhắn ───────────────────────────────────────────────────
            messageRepository.deleteByUserId(id);

            // ── 5. GroupReadStatus + rời/xóa ChatGroup ───────────────────────
            groupReadStatusRepository.deleteByUserId(id);
            for (com.pbl5.model.ChatGroup group : chatGroupRepository.findByUserMemberId(id)) {
                group.getMembers().remove(user);
                chatGroupRepository.save(group);
            }
            for (com.pbl5.model.ChatGroup ownedGroup : chatGroupRepository.findByCreatedById(id)) {
                groupReadStatusRepository.deleteByGroupId(ownedGroup.getId());
                messageRepository.deleteByGroupId(ownedGroup.getId());
                chatGroupRepository.delete(ownedGroup);
            }

            // ── 6. Friendships ────────────────────────────────────────────────
            friendshipRepository.deleteAll(friendshipRepository.findAllByUser(user));

            // ── 7. CommentLike ────────────────────────────────────────────────
            commentLikeRepository.deleteByUserId(id);

            // ── 8. HiddenPost và Bookmark ─────────────────────────────────────
            hiddenPostRepository.deleteAll(hiddenPostRepository.findByUserId(id));
            bookmarkRepository.deleteAll(bookmarkRepository.findByUserId(id));

            // ── 9. Bài viết ───────────────────────────────────────────────────
            for (com.pbl5.model.Post post : postRepository.findByUserIdOrderByCreatedAtDesc(id)) {
                postRepository.clearSharedPostReference(post.getId());
                entityManager.flush();
                entityManager.clear();
                post = postRepository.findById(post.getId()).orElse(null);
                if (post == null) continue;
                reportRepository.deleteAll(reportRepository.findByPost(post));
                bookmarkRepository.deleteAll(bookmarkRepository.findByPostId(post.getId()));
                hiddenPostRepository.deleteAll(hiddenPostRepository.findByPostId(post.getId()));
                for (com.pbl5.model.Comment comment : commentRepository.findByPostIdOrderByCreatedAtDesc(post.getId())) {
                    commentLikeRepository.deleteByCommentId(comment.getId());
                    reportRepository.deleteAll(reportRepository.findByComment(comment));
                }
                commentRepository.deleteAll(commentRepository.findByPostIdOrderByCreatedAtDesc(post.getId()));
                likeRepository.deleteAll(likeRepository.findByPost(post));
                postRepository.delete(post);
            }

            // ── 10. Comment trên bài người khác ──────────────────────────────
            for (com.pbl5.model.Comment comment : commentRepository.findByUserId(id)) {
                commentLikeRepository.deleteByCommentId(comment.getId());
                reportRepository.deleteAll(reportRepository.findByComment(comment));
                commentRepository.delete(comment);
            }

            // ── 11. Like trên bài người khác ─────────────────────────────────
            likeRepository.deleteAll(likeRepository.findByUserId(id));

            // ── 12. Report do moderator tạo ───────────────────────────────────
            reportRepository.deleteAll(reportRepository.findByUser(id));

            // ── 13. Xóa user ──────────────────────────────────────────────────
            userRepository.delete(user);

            return ResponseEntity.ok(Map.of("message", "Đã xoá tài khoản kiểm duyệt viên ID " + id));

        } catch (Exception e) {
            throw new RuntimeException("Xoá moderator ID " + id + " thất bại: " + e.getMessage(), e);
        }
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
                    
                    // Tự động gán thời hạn phạt 3 ngày
                    LocalDateTime now = LocalDateTime.now();
                    LocalDateTime currentPostExpiry = violator.getPostWarningExpiresAt();
                    violator.setPostWarningExpiresAt((currentPostExpiry != null && currentPostExpiry.isAfter(now)) ? currentPostExpiry.plusDays(3) : now.plusDays(3));
                    
                    userRepository.save(violator);

                    // Thông báo cho user vi phạm
                    createNotification(violator, null, "REPORT_WARNING",
                            "Bài viết của bạn đã bị ẩn do vi phạm quy tắc cộng đồng. Bạn bị cấm đăng bài trong 3 ngày.",
                            null);
                }
            }

            // === ẨN COMMENT VI PHẠM (xoá comment) ===
            if (report.getComment() != null) {
                com.pbl5.model.Comment violatingComment = report.getComment();
                User commentAuthor = violatingComment.getUser();
                if (commentAuthor != null && commentAuthor.getStatus() != UserStatus.BANNED) {
                    commentAuthor.setStatus(UserStatus.WARNING);
                    
                    // Tự động gán thời hạn phạt 3 ngày
                    LocalDateTime now = LocalDateTime.now();
                    LocalDateTime currentCommentExpiry = commentAuthor.getCommentWarningExpiresAt();
                    commentAuthor.setCommentWarningExpiresAt((currentCommentExpiry != null && currentCommentExpiry.isAfter(now)) ? currentCommentExpiry.plusDays(3) : now.plusDays(3));
                    
                    userRepository.save(commentAuthor);

                    createNotification(commentAuthor, null, "REPORT_WARNING",
                            "Bình luận của bạn đã bị xoá do vi phạm quy tắc cộng đồng. Bạn bị cấm bình luận trong 3 ngày.",
                            null);
                }
                
                // Xoá comment và comment likes liên quan khỏi DB
                commentLikeRepository.deleteByCommentId(violatingComment.getId());
                commentRepository.delete(violatingComment);
                report.setComment(null); // Tránh lỗi khóa ngoại khi comment bị xoá
                reportRepository.save(report);
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

    @org.springframework.web.bind.annotation.ExceptionHandler(RuntimeException.class)
    public ResponseEntity<?> handleRuntimeException(RuntimeException e) {
        return ResponseEntity.status(500).body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Lỗi server nội bộ"));
    }
}
