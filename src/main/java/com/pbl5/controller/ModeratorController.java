package com.pbl5.controller;

import com.pbl5.enums.PostStatus;
import com.pbl5.enums.UserStatus;
import com.pbl5.model.Post;
import com.pbl5.model.User;
import com.pbl5.repository.LikeRepository;
import com.pbl5.repository.CommentRepository;
import com.pbl5.repository.PostRepository;
import com.pbl5.repository.UserRepository;
import com.pbl5.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import com.pbl5.repository.NotificationRepository;
import com.pbl5.repository.CommentLikeRepository;
import com.pbl5.model.Notification;

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
    private LikeRepository likeRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private com.pbl5.repository.ReportRepository reportRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private CommentLikeRepository commentLikeRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private com.pbl5.service.EmailService emailService;

    // ==================== KIỂM DUYỆT BÀI VIẾT ====================

    /** Lấy tất cả bài viết (để xem xét nội dung) */
    @GetMapping("/posts")
    public ResponseEntity<?> getAllPosts() {
        List<Map<String, Object>> result = postRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .limit(200) // Tăng giới hạn lên 200 bài
                .map(p -> {
                    Map<String, Object> map = new HashMap<>();
                    com.pbl5.model.User author = p.getUser();
                    com.pbl5.model.User currentMod = p.getProcessingModerator();
                    LocalDateTime modTime = p.getModerationStartedAt();
                    boolean hasActiveLock = modTime != null && !modTime.plusSeconds(5).isBefore(LocalDateTime.now())
                            && currentMod != null;
                    com.pbl5.model.User activeModerator = hasActiveLock ? currentMod : null;

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
                    map.put("authorId", author != null ? author.getId() : null);
                    map.put("authorName", author != null ? author.getFullName() : "Ẩn danh");
                    map.put("reviewedAt", p.getReviewedAt());
                    map.put("reviewerName", currentMod != null ? currentMod.getFullName() : null);

                    if (hasActiveLock) {
                        map.put("moderationStartedAt", modTime);
                        map.put("processingModeratorId", activeModerator.getId());
                        map.put("processingModeratorName", activeModerator.getFullName());
                    } else {
                        map.put("moderationStartedAt", null);
                        map.put("processingModeratorId", null);
                        map.put("processingModeratorName", null);
                    }

                    map.put("likeCount", 0);
                    map.put("commentCount", 0);
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
        if (!postOpt.isPresent()) {
            return ResponseEntity.status(404).body("Không tìm thấy bài viết");
        }

        Post post = postOpt.get();
        if (post.getStatus() != PostStatus.PENDING_REVIEW) {
            return ResponseEntity.status(400).body("Bài viết không nằm trong danh sách chờ duyệt");
        }

        LocalDateTime now = LocalDateTime.now();
        // Cho phép nhận xử lý nếu chưa ai nhận, HOẶC người nhận trước đó đã quá 5 giây
        // (hết hạn khoá)
        if (post.getModerationStartedAt() == null || post.getModerationStartedAt().plusSeconds(5).isBefore(now)) {
            post.setModerationStartedAt(now);
            post.setProcessingModerator(moderator);
            postRepository.save(post);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("postId", post.getId());
        response.put("moderationStartedAt", post.getModerationStartedAt());
        response.put("processingModeratorId", post.getProcessingModerator().getId());
        response.put("processingModeratorName", post.getProcessingModerator().getFullName());

        // Broadcast to all moderators
        Map<String, Object> update = new HashMap<>(response);
        update.put("type", "REVIEW_STARTED");
        messagingTemplate.convertAndSend("/topic/review-updates", update);

        return ResponseEntity.ok(response);
    }

    /**
     * API Heartbeat: Cập nhật liên tục thời gian xử lý khi Moderator vẫn đang mở
     * Popup
     */
    @PostMapping("/posts/{id}/keep-alive")
    public ResponseEntity<?> keepAlivePost(@PathVariable long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User moderator = getAuthenticatedUser(authHeader);
        if (moderator == null)
            return ResponseEntity.status(401).body("Unauthorized");

        Optional<Post> postOpt = postRepository.findById(id);
        if (postOpt.isPresent()) {
            Post post = postOpt.get();
            if (post.getProcessingModerator() != null
                    && post.getProcessingModerator().getId().equals(moderator.getId())) {
                post.setModerationStartedAt(LocalDateTime.now());
                postRepository.save(post);
                return ResponseEntity.ok().build();
            }
        }
        return ResponseEntity.status(400).build();
    }

    /** Moderator huỷ bắt đầu xử lý (thoát ra không duyệt) */
    @PostMapping("/posts/{id}/cancel-processing")
    public ResponseEntity<?> cancelProcessingPost(@PathVariable long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User moderator = getAuthenticatedUser(authHeader);
        if (moderator == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        Optional<Post> postOpt = postRepository.findById(id);
        if (!postOpt.isPresent()) {
            return ResponseEntity.status(404).body("Không tìm thấy bài viết");
        }

        Post post = postOpt.get();
        // Chỉ huỷ nếu post đang chờ duyệt và chính moderator này đang xử lý
        if (post.getStatus() == PostStatus.PENDING_REVIEW &&
                post.getProcessingModerator() != null &&
                post.getProcessingModerator().getId().equals(moderator.getId())) {

            post.setModerationStartedAt(null);
            post.setProcessingModerator(null);
            postRepository.save(post);

            // Broadcast update
            Map<String, Object> update = new HashMap<>();
            update.put("type", "REVIEW_CANCELLED");
            update.put("postId", id);
            messagingTemplate.convertAndSend("/topic/review-updates", update);
        }

        return ResponseEntity.ok(Map.of("message", "Đã huỷ trạng thái xử lý"));
    }

    /** Duyệt bài viết (đặt status = ACTIVE) */
    @PostMapping("/posts/{id}/approve")
    public ResponseEntity<?> approvePost(@PathVariable long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User moderator = getAuthenticatedUser(authHeader);
        if (moderator == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        Optional<Post> postOpt = postRepository.findById(id);
        if (!postOpt.isPresent()) {
            return ResponseEntity.status(404).body("Không tìm thấy bài viết");
        }

        Post post = postOpt.get();
        post.setStatus(PostStatus.ACTIVE);
        post.setProcessingModerator(moderator); // Lưu vết moderator đã duyệt
        post.setReviewedAt(LocalDateTime.now());
        postRepository.save(post);

        // Broadcast update
        Map<String, Object> update = new HashMap<>();
        update.put("type", "REVIEW_COMPLETED");
        update.put("postId", id);
        update.put("status", "ACTIVE");
        messagingTemplate.convertAndSend("/topic/review-updates", update);

        return ResponseEntity.ok(Map.of("message", "Đã duyệt bài viết"));
    }

    /** Xoá bài viết vi phạm (Đổi thành Reject để lưu lịch sử) */
    @DeleteMapping("/posts/{id}")
    public ResponseEntity<?> deletePost(@PathVariable long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User moderator = getAuthenticatedUser(authHeader);
        if (moderator == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        Optional<Post> postOpt = postRepository.findById(id);
        if (!postOpt.isPresent()) {
            return ResponseEntity.status(404).body("Không tìm thấy bài viết");
        }

        Post post = postOpt.get();
        if (post.getStatus() != PostStatus.PENDING_REVIEW) {
            return ResponseEntity.status(400).body("Bài viết này đã được xử lý bởi người khác.");
        }

        post.setStatus(PostStatus.REJECTED);
        post.setProcessingModerator(moderator);
        post.setReviewedAt(LocalDateTime.now());
        postRepository.save(post);

        // Cộng điểm vi phạm cho người dùng (tác giả bài viết)
        User author = post.getUser();
        if (author != null) {
            int currentScore = author.getScore() != null ? author.getScore() : 0;
            author.setScore(currentScore + 1);
            userRepository.save(author);

            sendNotification(author, moderator, "POST_REJECTED",
                    "Bài viết của bạn đã bị gỡ do vi phạm tiêu chuẩn cộng đồng. Bạn bị cộng 1 điểm vi phạm.",
                    "/html/home.html");
        }

        // Broadcast update
        Map<String, Object> update = new HashMap<>();
        update.put("type", "REVIEW_COMPLETED");
        update.put("postId", id);
        update.put("status", "REJECTED");
        messagingTemplate.convertAndSend("/topic/review-updates", update);

        return ResponseEntity.ok(Map.of("message", "Đã gỡ bài viết ID " + id + " và cộng điểm vi phạm"));
    }

    /** Ẩn bài viết bởi Moderator (không cộng điểm vi phạm) */
    @PostMapping("/posts/{id}/hide")
    public ResponseEntity<?> hidePostAdmin(@PathVariable long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User moderator = getAuthenticatedUser(authHeader);
        if (moderator == null)
            return ResponseEntity.status(401).body("Unauthorized");

        Optional<Post> postOpt = postRepository.findById(id);
        if (postOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy bài viết");

        Post post = postOpt.get();
        post.setStatus(PostStatus.REJECTED); // Vẫn dùng REJECTED để ẩn khỏi feed
        post.setProcessingModerator(moderator);
        post.setReviewedAt(LocalDateTime.now());
        postRepository.save(post);

        User author = post.getUser();
        if (author != null) {
            sendNotification(author, moderator, "POST_HIDDEN",
                    "Bài viết của bạn đã bị ẩn bởi đội ngũ quản trị.",
                    "/html/home.html");
        }

        return ResponseEntity.ok(Map.of("message", "Đã ẩn bài viết ID " + id));
    }

    /** Khôi phục bài viết và trừ điểm vi phạm */
    @PostMapping("/posts/{id}/restore")
    public ResponseEntity<?> restorePost(@PathVariable long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User moderator = getAuthenticatedUser(authHeader);
        if (moderator == null)
            return ResponseEntity.status(401).body("Unauthorized");

        Optional<Post> postOpt = postRepository.findById(id);
        if (postOpt.isEmpty())
            return ResponseEntity.status(404).body("Không tìm thấy bài viết");

        Post post = postOpt.get();
        post.setStatus(PostStatus.ACTIVE);
        post.setProcessingModerator(moderator);
        post.setReviewedAt(LocalDateTime.now());
        postRepository.save(post);

        // Trừ điểm vi phạm
        User author = post.getUser();
        if (author != null) {
            int currentScore = author.getScore() != null ? author.getScore() : 0;
            if (currentScore > 0) {
                author.setScore(currentScore - 1);
                userRepository.save(author);

                sendNotification(author, moderator, "POST_RESTORED",
                        "Bài viết của bạn đã được khôi phục. Bạn được trừ 1 điểm vi phạm.",
                        "/html/home.html#post-" + post.getId());
            }
        }

        return ResponseEntity.ok(Map.of("message", "Đã khôi phục bài viết và trừ điểm vi phạm"));
    }

    /** Xoá bình luận vi phạm */
    @DeleteMapping("/comments/{id}")
    public ResponseEntity<?> deleteComment(@PathVariable long id) {
        if (!commentRepository.existsById(id)) {
            return ResponseEntity.status(404).body("Không tìm thấy bình luận");
        }
        commentLikeRepository.deleteByCommentId(id);
        commentRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Đã xoá bình luận ID " + id));
    }

    // ==================== KIỂM DUYỆT BÁO CÁO NGƯỜI DÙNG ====================

    /** Lấy tất cả danh sách báo cáo (Moderator xem) */
    @GetMapping("/reports")
    public ResponseEntity<?> getAllReports() {
        List<Map<String, Object>> reports = reportRepository
                .findAllByOrderByCreatedAtDesc().stream()
                .map(r -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", r.getId());
                    map.put("reason", r.getReason());
                    map.put("status", r.getStatus());
                    map.put("category", r.getCategory() != null ? r.getCategory().name() : "OTHER");
                    map.put("createdAt", r.getCreatedAt());
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
                        if (r.getComment().getPost() != null) {
                            commentMap.put("postId", r.getComment().getPost().getId());
                        }
                        map.put("comment", commentMap);
                    }
                    return map;
                }).collect(Collectors.toList());
        return ResponseEntity.ok(reports);
    }

    /** Xử lý báo cáo vi phạm bởi Moderator/Admin */
    @PutMapping("/reports/{id}/status")
    public ResponseEntity<?> updateReportStatus(@PathVariable Long id,
            @RequestParam String status,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String adminNote,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User moderator = getAuthenticatedUser(authHeader);
        if (moderator == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        Optional<com.pbl5.model.Report> reportOpt = reportRepository.findById(id);
        if (reportOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Không tìm thấy báo cáo");
        }

        com.pbl5.model.Report report = reportOpt.get();
        
        com.pbl5.enums.ReportStatus reportStatus;
        try {
            reportStatus = com.pbl5.enums.ReportStatus.valueOf(status.toUpperCase());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Trạng thái không hợp lệ. Chỉ chấp nhận: RESOLVED, DISMISSED");
        }

        report.setStatus(reportStatus);
        report.setResolvedAt(LocalDateTime.now());
        report.setResolvedBy(moderator);
        
        if (adminNote != null && !adminNote.isBlank()) {
            report.setAdminNote(adminNote.trim());
        } else {
            report.setAdminNote(reportStatus == com.pbl5.enums.ReportStatus.RESOLVED ? "Đã xử lý vi phạm." : "Bỏ qua báo cáo.");
        }

        reportRepository.save(report);

        if (reportStatus == com.pbl5.enums.ReportStatus.RESOLVED) {
            // Xử lý báo cáo bài viết
            if (report.getPost() != null) {
                Post post = report.getPost();
                
                // Cập nhật trạng thái bài viết thành REJECTED (ẩn khỏi feed)
                post.setStatus(PostStatus.REJECTED);
                post.setProcessingModerator(moderator);
                post.setReviewedAt(LocalDateTime.now());
                postRepository.save(post);

                User author = post.getUser();
                if (author != null) {
                    if ("DELETE".equalsIgnoreCase(action)) {
                        // Cộng 1 điểm vi phạm nếu là Xóa bài
                        int currentScore = author.getScore() != null ? author.getScore() : 0;
                        author.setScore(currentScore + 1);
                        userRepository.save(author);

                        sendNotification(author, moderator, "POST_REJECTED",
                                "Bài viết của bạn đã bị gỡ do vi phạm tiêu chuẩn cộng đồng. Bạn bị cộng 1 điểm vi phạm.",
                                "/html/home.html");
                    } else {
                        // Chỉ ẩn bài viết
                        sendNotification(author, moderator, "POST_HIDDEN",
                                "Bài viết của bạn đã bị ẩn bởi đội ngũ quản trị.",
                                "/html/home.html");
                    }
                }
            }

            // Xử lý báo cáo bình luận
            if (report.getComment() != null) {
                com.pbl5.model.Comment comment = report.getComment();
                User author = comment.getUser();
                if (author != null) {
                    sendNotification(author, moderator, "COMMENT_REJECTED",
                            "Bình luận của bạn đã bị gỡ do vi phạm quy tắc cộng đồng.",
                            "/html/home.html");
                }
                // Xoá comment khỏi DB
                commentLikeRepository.deleteByCommentId(comment.getId());
                commentRepository.delete(comment);
                report.setComment(null); // Tránh lỗi khóa ngoại khi comment bị xoá
                reportRepository.save(report);
            }

            // Thông báo cho người báo cáo
            if (report.getUser() != null) {
                sendNotification(report.getUser(), moderator, "REPORT_RESOLVED",
                        "Báo cáo của bạn đã được xử lý. Nội dung vi phạm đã được gỡ bỏ. Cảm ơn bạn!",
                        "/html/home.html");
            }

        } else if (reportStatus == com.pbl5.enums.ReportStatus.DISMISSED) {
            // Thông báo cho người báo cáo
            if (report.getUser() != null) {
                sendNotification(report.getUser(), moderator, "REPORT_DISMISSED",
                        "Báo cáo của bạn đã được xem xét. Nội dung không vi phạm tiêu chuẩn cộng đồng.",
                        "/html/home.html");
            }
        }

        return ResponseEntity.ok(Map.of("message", "Đã cập nhật trạng thái báo cáo ID " + id));
    }


    // ==================== KIỂM DUYỆT NGƯỜI DÙNG ====================

    @Autowired
    private com.pbl5.repository.FriendshipRepository friendshipRepository;

    /** Lấy danh sách người dùng (chỉ thông tin cơ bản) */
    @GetMapping("/users")
    public ResponseEntity<?> getUsers(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        List<Map<String, Object>> users = userRepository.findAll().stream().map(u -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", u.getId());
            map.put("fullName", u.getFullName());
            map.put("email", u.getEmail());
            map.put("status", u.getStatus());
            map.put("role", u.getRole());
            map.put("avatar", u.getAvatar());
            map.put("score", u.getScore());
            map.put("postWarningExpiresAt", u.getPostWarningExpiresAt());
            map.put("commentWarningExpiresAt", u.getCommentWarningExpiresAt());
            map.put("lockExpiresAt", u.getLockExpiresAt());

            // Thêm trạng thái bạn bè
            if (currentUser != null && !currentUser.getId().equals(u.getId())) {
                Optional<com.pbl5.model.Friendship> friendship = friendshipRepository.findByUsers(currentUser, u);
                if (friendship.isPresent()) {
                    com.pbl5.model.Friendship f = friendship.get();
                    if (f.getStatus() == com.pbl5.enums.FriendshipStatus.ACCEPTED) {
                        map.put("friendStatus", "ACCEPTED");
                    } else if (f.getStatus() == com.pbl5.enums.FriendshipStatus.PENDING) {
                        if (f.getRequester().getId().equals(currentUser.getId())) {
                            map.put("friendStatus", "PENDING_SENT");
                        } else {
                            map.put("friendStatus", "PENDING_RECEIVED");
                        }
                    }
                } else {
                    map.put("friendStatus", "NOT_FRIEND");
                }
            } else {
                map.put("friendStatus", "SELF");
            }
            return map;

        }).collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    /** Cảnh báo người dùng với tùy chọn hình thức và thời hạn */
    @PutMapping("/users/{id}/warn")
    public ResponseEntity<?> warnUser(@PathVariable long id, 
            @RequestBody Map<String, Object> payload,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User moderator = getAuthenticatedUser(authHeader);
        if (moderator == null) {
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
            // Nếu còn hạn thì cộng thêm vào hạn cũ, nếu không thì cộng từ bây giờ
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
        sendNotification(user, moderator, "WARNING", message, "/profile");

        return ResponseEntity.ok(Map.of("message", "Đã thiết lập cảnh cáo " + typeText + " cho người dùng trong " + days + " ngày."));
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
            User currentMod = p.getProcessingModerator();
            
            map.put("id", p.getId());
            map.put("content", p.getContent());
            map.put("imageUrl", p.getImageUrl());
            map.put("videoUrl", p.getVideoUrl());
            map.put("visibility", p.getVisibility());
            map.put("createdAt", p.getCreatedAt());
            map.put("status", p.getStatus());
            map.put("nsfwScore", p.getNsfwScore());
            map.put("violenceScore", p.getViolenceScore());
            map.put("hateSpeechScore", p.getHateSpeechScore());
            map.put("reviewerName", currentMod != null ? currentMod.getFullName() : null);
            map.put("likeCount", likeRepository.countByPostId(p.getId()));
            map.put("commentCount", commentRepository.countByPostId(p.getId()));
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

    // ==================== KHÓA / MỞ KHÓA NGƯỜI DÙNG ====================

    @PutMapping("/users/{id}/lock")
    public ResponseEntity<?> lockUser(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Authorization") String authHeader) {
        User moderator = getAuthenticatedUser(authHeader);
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) return ResponseEntity.notFound().build();

        User user = userOpt.get();
        String type = (String) body.get("type"); // "TEMP" or "PERM"
        Integer days = (Integer) body.get("days");
        String reason = (String) body.get("reason");
        if (reason == null || reason.trim().isEmpty()) reason = "Vi phạm tiêu chuẩn cộng đồng.";

        LocalDateTime expiry = null;
        String expiryStr = null;
        
        if ("PERM".equals(type)) {
            // Khóa vĩnh viễn: Lưu ngày mở là 1970-01-01 (mốc 0)
            expiry = LocalDateTime.of(1970, 1, 1, 0, 0);
        } else {
            // Khóa tạm thời
            if (days == null || days <= 0) return ResponseEntity.badRequest().body("Số ngày không hợp lệ.");
            expiry = LocalDateTime.now().plusDays(days);
            java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy");
            expiryStr = expiry.format(formatter);
        }

        user.setStatus(UserStatus.BANNED);
        user.setLockExpiresAt(expiry);
        userRepository.save(user);

        // Gửi email thông báo
        try {
            emailService.sendLockEmail(user.getEmail(), reason, expiryStr);
        } catch (Exception e) {
            System.err.println("Lỗi gửi email khóa: " + e.getMessage());
        }

        return ResponseEntity.ok("Đã khóa người dùng thành công.");
    }

    @PutMapping("/users/{id}/unlock")
    public ResponseEntity<?> unlockUser(
            @PathVariable Long id,
            @RequestHeader("Authorization") String authHeader) {
        User moderator = getAuthenticatedUser(authHeader);
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) return ResponseEntity.notFound().build();

        User user = userOpt.get();
        user.setStatus(UserStatus.ACTIVE);
        user.setLockExpiresAt(null);
        userRepository.save(user);

        return ResponseEntity.ok("Đã mở khóa người dùng thành công.");
    }

    @PostMapping("/users/{id}/warn")
    public ResponseEntity<?> warnUser(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @RequestHeader("Authorization") String authHeader) {
        User moderator = getAuthenticatedUser(authHeader);
        if (moderator == null) return ResponseEntity.status(401).build();
        
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) return ResponseEntity.notFound().build();

        User user = userOpt.get();
        String message = body.get("message");
        if (message == null || message.trim().isEmpty()) {
            message = "Tài khoản của bạn đã nhận được một cảnh cáo từ quản trị viên do vi phạm tiêu chuẩn cộng đồng.";
        }

        sendNotification(user, moderator, "USER_WARNED", message, "/html/home.html");
        
        return ResponseEntity.ok(Map.of("message", "Đã gửi cảnh cáo thành công cho người dùng " + user.getFullName()));
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
        notification.put("senderId", sender.getId());
        notification.put("senderName", sender.getFullName());
        notification.put("senderAvatar", sender.getAvatar());
        notification.put("link", link);

        messagingTemplate.convertAndSend("/topic/notifications/" + recipient.getId(), notification);
    }
}
