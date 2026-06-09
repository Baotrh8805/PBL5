package com.pbl5.controller;

import com.pbl5.model.Bookmark;
import com.pbl5.repository.BookmarkRepository;
import com.pbl5.dto.CommentRequest;
import com.pbl5.dto.CommentResponse;
import com.pbl5.dto.CreatePostRequest;
import com.pbl5.dto.SharedPostDTO;
import com.pbl5.dto.PostRequest;
import com.pbl5.dto.PostResponse;
import com.pbl5.enums.PostStatus;
import com.pbl5.enums.PostVisibility;
import com.pbl5.model.Post;
import com.pbl5.model.User;
import com.pbl5.model.Like;
import com.pbl5.model.Comment;
import com.pbl5.repository.CommentRepository;
import com.pbl5.repository.LikeRepository;
import com.pbl5.enums.FriendshipStatus;
import com.pbl5.model.Friendship;
import com.pbl5.repository.FriendshipRepository;
import com.pbl5.repository.PostRepository;
import com.pbl5.repository.UserRepository;
import com.pbl5.security.JwtTokenProvider;
import com.pbl5.service.PostService;
import com.pbl5.service.CommentService;
import com.pbl5.service.LikeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import com.pbl5.repository.NotificationRepository;
import com.pbl5.repository.HiddenPostRepository;
import com.pbl5.repository.ReportRepository;
import com.pbl5.model.HiddenPost;
import com.pbl5.model.Report;
import com.pbl5.model.CommentLike;
import com.pbl5.repository.CommentLikeRepository;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Map;
import java.util.HashMap;
import java.util.Set;
import java.util.HashSet;
import java.util.Optional;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private FriendshipRepository friendshipRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LikeRepository likeRepository;

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private PostService postService;

    @Autowired
    private CommentService commentService;

    @Autowired
    private LikeService likeService;

    @Autowired
    private HiddenPostRepository hiddenPostRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private BookmarkRepository bookmarkRepository;

    private boolean canViewPost(Post p, User currentUser) {
        if (p == null || p.getUser() == null || currentUser == null) {
            return false;
        }

        // Handle deleted/rejected posts with 3-day grace period
        if (p.getStatus() == com.pbl5.enums.PostStatus.REJECTED || p.getStatus() == com.pbl5.enums.PostStatus.AUTO_REJECTED) {
            if (currentUser.getRole() == com.pbl5.enums.Role.ADMIN || currentUser.getRole() == com.pbl5.enums.Role.MODERATOR) {
                return true;
            }
            if (p.getUser().getId().equals(currentUser.getId())) {
                LocalDateTime deleteTime = p.getReviewedAt();
                if (deleteTime != null && deleteTime.plusDays(3).isAfter(LocalDateTime.now())) {
                    return true;
                }
            }
            return false;
        }

        // Author can always see their own posts
        if (p.getUser().getId().equals(currentUser.getId()))
            return true;

        // Admins and moderators can see all posts
        if (currentUser.getRole() == com.pbl5.enums.Role.ADMIN || currentUser.getRole() == com.pbl5.enums.Role.MODERATOR)
            return true;

        // Other users cannot see pending review posts
        if (p.getStatus() == com.pbl5.enums.PostStatus.PENDING_REVIEW) {
            return false;
        }

        if (p.getVisibility() == PostVisibility.PUBLIC || p.getVisibility() == null)
            return true;
        if (p.getVisibility() == PostVisibility.PRIVATE)
            return false;
        if (p.getVisibility() == PostVisibility.FRIENDS) {
            return friendshipRepository.findByUsers(currentUser, p.getUser())
                    .map(f -> f.getStatus() == FriendshipStatus.ACCEPTED)
                    .orElse(false);
        }
        return false;
    }

    private User getAuthenticatedUser(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token)) return null;
        String email = tokenProvider.getEmailFromJWT(token);
        return userRepository.findByEmail(email).orElse(null);
    }

    @PostMapping
    public ResponseEntity<?> createPost(@RequestHeader("Authorization") String authHeader,
            @RequestBody PostRequest request) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        // Kiểm tra cảnh cáo chặn đăng bài
        if (user.getPostWarningExpiresAt() != null && user.getPostWarningExpiresAt().isAfter(java.time.LocalDateTime.now())) {
            java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy");
            String expiryStr = user.getPostWarningExpiresAt().format(formatter);
            return ResponseEntity.status(403).body("Bạn đang bị cấm đăng bài do vi phạm. Vui lòng quay lại sau " + expiryStr);
        }

        if ((request.getContent() == null || request.getContent().trim().isEmpty())
                && (request.getImageUrl() == null || request.getImageUrl().trim().isEmpty())
                && (request.getVideoUrl() == null || request.getVideoUrl().trim().isEmpty())
                && request.getSharedPostId() == null) {
            return ResponseEntity.badRequest().body("Nội dung bài đăng không được trống.");
        }

        CreatePostRequest createPostRequest = new CreatePostRequest(
                request.getContent(),
                request.getImageUrl(),
                request.getVideoUrl(),
                request.getVisibility(),
                request.getSharedPostId());

        PostResponse created = postService.createPost(user, createPostRequest);
        return ResponseEntity.ok(created);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> getAllPosts(@RequestHeader("Authorization") String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        List<Post> posts = postRepository.findAllByOrderByCreatedAtDesc();

        // Lấy danh sách ID các bài viết mà user đã ẩn
        Set<Long> hiddenPostIds = hiddenPostRepository.findByUserId(currentUser.getId())
                .stream()
                .filter(hp -> hp.getPost() != null)
                .map(hp -> hp.getPost().getId())
                .collect(Collectors.toSet());

        List<Post> filteredPosts = posts.stream()
                .filter(p -> !hiddenPostIds.contains(p.getId()))
                .filter(p -> p.getStatus() != PostStatus.DELETED)
                .collect(Collectors.toList());

        List<PostResponse> responses = convertToResponses(filteredPosts, currentUser);
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getMyPosts(@RequestHeader("Authorization") String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        List<Post> posts = postRepository.findByUserIdOrderByCreatedAtDesc(currentUser.getId());
        List<Post> filteredPosts = posts.stream()
                .filter(p -> p.getStatus() != PostStatus.DELETED)
                .collect(Collectors.toList());
        List<PostResponse> responses = convertToResponses(filteredPosts, currentUser);
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/user/{userId}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getUserPosts(@RequestHeader("Authorization") String authHeader,
            @PathVariable Long userId) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        // NOTE: Later we should filter posts based on visibility: PUBLIC for everyone,
        // FRIENDS if they are friends, etc.
        // For now, let's return all posts or just public/friends if we don't have
        // friendship check easily available here.
        List<Post> posts = postRepository.findByUserIdOrderByCreatedAtDesc(userId);

        List<Post> filteredPosts = posts.stream()
                .filter(p -> p.getStatus() != PostStatus.DELETED)
                .collect(Collectors.toList());

        List<PostResponse> responses = convertToResponses(filteredPosts, currentUser);
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/{postId}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getPostById(@RequestHeader("Authorization") String authHeader,
            @PathVariable Long postId) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty())
            return ResponseEntity.notFound().build();

        Post post = postOpt.get();
        if (!canViewPost(post, currentUser)) {
            return ResponseEntity.status(403).body("Bạn không có quyền xem bài viết này.");
        }

        return ResponseEntity.ok(convertToResponse(post, currentUser));
    }

    // Like hoặc Unlike
    @PostMapping("/{postId}/like")
    public ResponseEntity<?> toggleLike(@RequestHeader("Authorization") String authHeader, @PathVariable Long postId) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        try {
            String message = likeService.toggleLike(postId, user);
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{postId}")
    public ResponseEntity<?> deletePost(@RequestHeader("Authorization") String authHeader, @PathVariable Long postId) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty())
            return ResponseEntity.notFound().build();

        Post post = postOpt.get();
        // Kiểm tra quyền xóa bài
        if (!post.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Không có quyền xóa bài này.");
        }

        // Soft delete: thay đổi trạng thái sang DELETED thay vì xóa khỏi CSDL
        post.setStatus(PostStatus.DELETED);
        postRepository.save(post);

        // Cascade delete shared posts
        List<Post> sharedPosts = postRepository.findBySharedPost_Id(post.getId());
        for (Post p : sharedPosts) {
            p.setStatus(PostStatus.DELETED);
            postRepository.save(p);
            if (!p.getUser().getId().equals(user.getId())) {
                sendNotification(p.getUser(), user, "SYSTEM", 
                    "Bài viết gốc mà bạn chia sẻ từ " + user.getFullName() + " đã bị xóa nên bài chia sẻ của bạn đã bị gỡ.", 
                    null);
            }
        }

        return ResponseEntity.ok("Đã xóa bài viết thành công!");
    }

    @PostMapping("/{postId}/restore")
    public ResponseEntity<?> restorePost(@RequestHeader("Authorization") String authHeader, @PathVariable Long postId) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty())
            return ResponseEntity.notFound().build();

        Post post = postOpt.get();
        if (!post.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Không có quyền khôi phục bài này.");
        }

        if (post.getStatus() == PostStatus.DELETED) {
            post.setStatus(PostStatus.ACTIVE);
            postRepository.save(post);
            return ResponseEntity.ok("Đã khôi phục bài viết thành công!");
        }
        return ResponseEntity.badRequest().body("Bài viết không ở trạng thái đã xóa.");
    }

    @PatchMapping("/{postId}/visibility")
    public ResponseEntity<?> changeVisibility(@RequestHeader("Authorization") String authHeader,
            @PathVariable Long postId, @RequestParam String level) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty())
            return ResponseEntity.notFound().build();

        Post post = postOpt.get();
        if (!post.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Không có quyền chỉnh sửa bài này.");
        }

        try {
            PostVisibility newVisibility = PostVisibility.valueOf(level.toUpperCase());
            if (post.getVisibility() == PostVisibility.PUBLIC && newVisibility != PostVisibility.PUBLIC) {
                // Remove shared posts since they can only exist if original is public
                List<Post> sharedPosts = postRepository.findBySharedPost_Id(post.getId());
                for (Post p : sharedPosts) {
                    p.setStatus(PostStatus.DELETED);
                    postRepository.save(p);
                    if (!p.getUser().getId().equals(user.getId())) {
                        sendNotification(p.getUser(), user, "SYSTEM", 
                            "Bài viết gốc mà bạn chia sẻ từ " + user.getFullName() + " không còn ở chế độ công khai nên bài chia sẻ của bạn đã bị gỡ.", 
                            null);
                    }
                }
            }
            post.setVisibility(newVisibility);
            postRepository.save(post);
            return ResponseEntity.ok("Đã thay đổi chế độ hiển thị.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Mức độ hiển thị không hợp lệ.");
        }
    }

    @PostMapping("/{postId}/hide")
    public ResponseEntity<?> hidePost(@RequestHeader("Authorization") String authHeader, @PathVariable Long postId) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty())
            return ResponseEntity.notFound().build();

        if (hiddenPostRepository.findByUserAndPost(user, postOpt.get()).isEmpty()) {
            HiddenPost hp = new HiddenPost();
            hp.setUser(user);
            hp.setPost(postOpt.get());
            hiddenPostRepository.save(hp);
        }
        return ResponseEntity.ok("Đã ẩn bài viết.");
    }

    @PostMapping("/{postId}/report")
    public ResponseEntity<?> reportPost(@RequestHeader("Authorization") String authHeader,
            @PathVariable Long postId,
            @RequestBody Map<String, String> body) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty())
            return ResponseEntity.notFound().build();

        Post post = postOpt.get();

        // Chống report trùng
        if (reportRepository.existsByUserAndPost(user, post)) {
            return ResponseEntity.status(409).body("Bạn đã báo cáo bài viết này rồi.");
        }

        String reason = body.get("reason");
        if (reason == null || reason.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Lý do báo cáo không được để trống.");
        }

        // Parse category
        com.pbl5.enums.ReportCategory category = com.pbl5.enums.ReportCategory.OTHER;
        String categoryStr = body.get("category");
        if (categoryStr != null) {
            try {
                category = com.pbl5.enums.ReportCategory.valueOf(categoryStr.toUpperCase());
            } catch (IllegalArgumentException ignored) {
            }
        }

        Report report = new Report();
        report.setUser(user);
        report.setPost(post);
        report.setReason(reason.trim());
        report.setCategory(category);
        reportRepository.save(report);

        // Ẩn bài cho người report (giống hide post)
        if (hiddenPostRepository.findByUserAndPost(user, post).isEmpty()) {
            HiddenPost hp = new HiddenPost();
            hp.setUser(user);
            hp.setPost(post);
            hiddenPostRepository.save(hp);
        }

        // Auto-escalate: nếu >= 3 report PENDING → ẩn bài khỏi mọi người
        long pendingCount = reportRepository.countByPostAndStatus(post, com.pbl5.enums.ReportStatus.PENDING);
        if (pendingCount >= 3 && post.getStatus() != com.pbl5.enums.PostStatus.AUTO_REJECTED) {
            post.setStatus(com.pbl5.enums.PostStatus.PENDING_REVIEW);
            postRepository.save(post);
        }

        return ResponseEntity.ok("Đã gửi báo cáo thành công.");
    }

    @PostMapping("/comments/{commentId}/report")
    public ResponseEntity<?> reportComment(@RequestHeader("Authorization") String authHeader,
            @PathVariable Long commentId,
            @RequestBody Map<String, String> body) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        Optional<Comment> commentOpt = commentRepository.findById(commentId);
        if (commentOpt.isEmpty())
            return ResponseEntity.notFound().build();

        Comment comment = commentOpt.get();

        // Chống report trùng
        if (reportRepository.existsByUserAndComment(user, comment)) {
            return ResponseEntity.status(409).body("Bạn đã báo cáo bình luận này rồi.");
        }

        String reason = body.get("reason");
        if (reason == null || reason.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Lý do báo cáo không được để trống.");
        }

        com.pbl5.enums.ReportCategory category = com.pbl5.enums.ReportCategory.OTHER;
        String categoryStr = body.get("category");
        if (categoryStr != null) {
            try {
                category = com.pbl5.enums.ReportCategory.valueOf(categoryStr.toUpperCase());
            } catch (IllegalArgumentException ignored) {
            }
        }

        Report report = new Report();
        report.setUser(user);
        report.setComment(comment);
        report.setReason(reason.trim());
        report.setCategory(category);
        reportRepository.save(report);

        return ResponseEntity.ok("Đã gửi báo cáo bình luận thành công.");
    }

    @GetMapping("/{postId}/comments")
    public ResponseEntity<?> getComments(@PathVariable Long postId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        List<CommentResponse> responses = commentService.getComments(postId, currentUser);
        return ResponseEntity.ok(responses);
    }

    @PostMapping("/{postId}/comments")
    public ResponseEntity<?> addComment(@PathVariable Long postId, @RequestBody CommentRequest request,
            @RequestHeader("Authorization") String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        try {
            CommentResponse response = commentService.addComment(postId, request, user);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            if (e.getMessage().contains("cấm bình luận")) {
                return ResponseEntity.status(403).body(e.getMessage());
            }
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    private void sendNotification(User recipient, User sender, String type, String message, String link) {
        com.pbl5.model.Notification notifEntity = new com.pbl5.model.Notification();
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

    private List<PostResponse> convertToResponses(List<Post> posts, User currentUser) {
        if (posts == null || posts.isEmpty()) {
            return new ArrayList<>();
        }

        List<Long> postIds = posts.stream().map(Post::getId).collect(Collectors.toList());

        Map<Long, Long> likeCountsMap = new HashMap<>();
        for (Object[] result : likeRepository.countLikesByPostIds(postIds)) {
            if (result[0] != null && result[1] != null) {
                likeCountsMap.put(((Number) result[0]).longValue(), ((Number) result[1]).longValue());
            }
        }

        Map<Long, Long> commentCountsMap = new HashMap<>();
        for (Object[] result : commentRepository.countCommentsByPostIds(postIds)) {
            if (result[0] != null && result[1] != null) {
                commentCountsMap.put(((Number) result[0]).longValue(), ((Number) result[1]).longValue());
            }
        }

        Set<Long> likedPostIdsSet = new HashSet<>();
        if (currentUser != null) {
            likedPostIdsSet.addAll(likeRepository.findLikedPostIdsByUser(postIds, currentUser.getId()));
        }

        List<PostResponse> responses = new ArrayList<>();
        for (Post post : posts) {
            try {
                if (canViewPost(post, currentUser)) {
                    long likeCount = likeCountsMap.getOrDefault(post.getId(), 0L);
                    long commentCount = commentCountsMap.getOrDefault(post.getId(), 0L);
                    boolean isLiked = likedPostIdsSet.contains(post.getId());
                    boolean isMine = currentUser != null && post.getUser().getId().equals(currentUser.getId());

                    String authorName = post.getUser().getFullName() != null ? post.getUser().getFullName()
                            : "Người dùng";
                    String authorAvatar = post.getUser().getAvatar() != null ? post.getUser().getAvatar()
                            : "https://ui-avatars.com/api/?name=" + authorName.replace(" ", "+")
                                    + "&background=00d1b2&color=fff";

                    SharedPostDTO sharedPostDTO = null;
                    if (post.getSharedPost() != null) {
                        Post sp = post.getSharedPost();
                        String spAuthorName = sp.getUser().getFullName() != null ? sp.getUser().getFullName() : "Người dùng";
                        String spAuthorAvatar = sp.getUser().getAvatar() != null ? sp.getUser().getAvatar()
                                : "https://ui-avatars.com/api/?name=" + spAuthorName.replace(" ", "+") + "&background=00d1b2&color=fff";
                        sharedPostDTO = new SharedPostDTO(
                            sp.getId(),
                            sp.getContent(),
                            sp.getImageUrl(),
                            sp.getVideoUrl(),
                            spAuthorName,
                            spAuthorAvatar,
                            sp.getCreatedAt(),
                            sp.getVisibility() != null ? sp.getVisibility().name() : "PUBLIC",
                            sp.getStatus() != null ? sp.getStatus().name() : "ACTIVE"
                        );
                    }
                    long shareCount = postRepository.countBySharedPost_Id(post.getId());

                    responses.add(new PostResponse(
                            post.getId(),
                            post.getContent(),
                            post.getImageUrl(),
                            post.getVideoUrl(),
                            post.getCreatedAt(),
                            post.getUser().getId(),
                            authorName,
                            authorAvatar,
                            likeCount,
                            commentCount,
                            isLiked,
                            isMine,
                            post.getVisibility() != null ? post.getVisibility().name() : "PUBLIC",
                            post.getStatus() != null ? post.getStatus().name() : "ACTIVE",
                            sharedPostDTO,
                            shareCount));
                }
            } catch (Exception e) {
                // skip broken post
            }
        }
        return responses;
    }

    private PostResponse convertToResponse(Post post, User currentUser) {
        if (post == null || post.getUser() == null) {
            return null;
        }

        long likeCount;
        long commentCount;
        try {
            likeCount = likeRepository.countByPostId(post.getId());
        } catch (Exception e) {
            likeCount = 0;
        }
        try {
            commentCount = commentRepository.countByPostId(post.getId());
        } catch (Exception e) {
            commentCount = 0;
        }

        boolean isLiked = false;
        boolean isMine = false;
        if (currentUser != null) {
            try {
                isLiked = likeRepository.findByPostAndUser(post, currentUser).isPresent();
            } catch (Exception e) {
                isLiked = false;
            }
            isMine = post.getUser().getId().equals(currentUser.getId());
        }

        String authorName = post.getUser().getFullName() != null ? post.getUser().getFullName() : "Người dùng";
        String authorAvatar = post.getUser().getAvatar() != null ? post.getUser().getAvatar()
                : "https://ui-avatars.com/api/?name=" + authorName.replace(" ", "+") + "&background=00d1b2&color=fff";

        SharedPostDTO sharedPostDTO = null;
        if (post.getSharedPost() != null) {
            Post sp = post.getSharedPost();
            String spAuthorName = sp.getUser().getFullName() != null ? sp.getUser().getFullName() : "Người dùng";
            String spAuthorAvatar = sp.getUser().getAvatar() != null ? sp.getUser().getAvatar()
                    : "https://ui-avatars.com/api/?name=" + spAuthorName.replace(" ", "+") + "&background=00d1b2&color=fff";
            sharedPostDTO = new SharedPostDTO(
                sp.getId(),
                sp.getContent(),
                sp.getImageUrl(),
                sp.getVideoUrl(),
                spAuthorName,
                spAuthorAvatar,
                sp.getCreatedAt(),
                sp.getVisibility() != null ? sp.getVisibility().name() : "PUBLIC",
                sp.getStatus() != null ? sp.getStatus().name() : "ACTIVE"
            );
        }
        long shareCount = postRepository.countBySharedPost_Id(post.getId());

        PostResponse response = new PostResponse(
                post.getId(),
                post.getContent(),
                post.getImageUrl(),
                post.getVideoUrl(),
                post.getCreatedAt(),
                post.getUser().getId(),
                authorName,
                authorAvatar,
                likeCount,
                commentCount,
                isLiked,
                isMine,
                post.getVisibility() != null ? post.getVisibility().name() : "PUBLIC",
                post.getStatus() != null ? post.getStatus().name() : "ACTIVE",
                sharedPostDTO,
                shareCount);

        // Set bookmark state
        if (currentUser != null) {
            try {
                response.setBookmarkedByCurrentUser(bookmarkRepository.existsByUserAndPost(currentUser, post));
            } catch (Exception e) {
                response.setBookmarkedByCurrentUser(false);
            }
        }

        return response;
    }

    // ======================= BOOKMARK =======================

    @PostMapping("/{postId}/bookmark")
    @Transactional
    public ResponseEntity<?> toggleBookmark(@PathVariable Long postId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Unauthorized");

        Post post = postRepository.findById(postId).orElse(null);
        if (post == null)
            return ResponseEntity.notFound().build();

        boolean exists = bookmarkRepository.existsByUserAndPost(user, post);
        Map<String, Object> result = new HashMap<>();
        if (exists) {
            bookmarkRepository.deleteByUserAndPost(user, post);
            result.put("bookmarked", false);
            result.put("message", "Đã bỏ lưu bài viết");
        } else {
            Bookmark bookmark = new Bookmark();
            bookmark.setUser(user);
            bookmark.setPost(post);
            bookmarkRepository.save(bookmark);
            result.put("bookmarked", true);
            result.put("message", "Đã lưu bài viết");
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/bookmarks")
    public ResponseEntity<?> getBookmarks(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Unauthorized");

        List<Bookmark> bookmarks = bookmarkRepository.findByUserOrderByCreatedAtDesc(user);
        List<Post> bookmarkedPosts = bookmarks.stream()
                .map(Bookmark::getPost)
                .filter(p -> p != null)
                .collect(Collectors.toList());
        List<PostResponse> responses = convertToResponses(bookmarkedPosts, user);
        return ResponseEntity.ok(responses);
    }

    // ======================= SEARCH POSTS =======================

    @GetMapping("/search")
    public ResponseEntity<?> searchPosts(@RequestParam("q") String query,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Unauthorized");

        if (query == null || query.trim().isEmpty()) {
            return ResponseEntity.ok(new ArrayList<>());
        }

        List<Post> searchResults = postRepository.searchPosts(query.trim());
        List<PostResponse> results = convertToResponses(searchResults, user);
        return ResponseEntity.ok(results);
    }

    // ======================= DELETE/EDIT COMMENT =======================

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<?> deleteComment(@PathVariable Long commentId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Unauthorized");

        try {
            commentService.deleteComment(commentId, user);
            return ResponseEntity.ok(Map.of("message", "Đã xóa bình luận"));
        } catch (Exception e) {
            if (e.getMessage().contains("quyền")) {
                return ResponseEntity.status(403).body(e.getMessage());
            }
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/comments/{commentId}")
    public ResponseEntity<?> updateComment(@PathVariable Long commentId,
            @RequestBody CommentRequest request,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Unauthorized");

        try {
            commentService.updateComment(commentId, request, user);
            return ResponseEntity.ok(Map.of("message", "Đã cập nhật bình luận"));
        } catch (Exception e) {
            if (e.getMessage().contains("quyền")) {
                return ResponseEntity.status(403).body(e.getMessage());
            }
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/comments/{commentId}/like")
    public ResponseEntity<?> toggleLikeComment(@PathVariable Long commentId,
            @RequestHeader("Authorization") String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Unauthorized");

        try {
            Map<String, Object> response = commentService.toggleLikeComment(commentId, user);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

}