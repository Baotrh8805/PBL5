package com.pbl5.controller;

import com.pbl5.dto.CommentRequest;
import com.pbl5.dto.CommentResponse;
import com.pbl5.dto.CreatePostRequest;
import com.pbl5.dto.PostRequest;
import com.pbl5.dto.PostResponse;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import com.pbl5.repository.NotificationRepository;
import com.pbl5.repository.HiddenPostRepository;
import com.pbl5.repository.ReportRepository;
import com.pbl5.model.HiddenPost;
import com.pbl5.model.Report;
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
    private HiddenPostRepository hiddenPostRepository;

    @Autowired
    private ReportRepository reportRepository;

    private boolean canViewPost(Post p, User currentUser) {
        if (p == null || p.getUser() == null || currentUser == null) {
            return false;
        }

        // Author can always see their own posts
        if (p.getUser().getId().equals(currentUser.getId()))
            return true;

        // Admins and moderators can see all posts
        if ("ADMIN".equals(currentUser.getRole()) || "MODERATOR".equals(currentUser.getRole()))
            return true;

        // Other users cannot see rejected or pending review posts
        if (p.getStatus() == com.pbl5.enums.PostStatus.AUTO_REJECTED
                || p.getStatus() == com.pbl5.enums.PostStatus.PENDING_REVIEW) {
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
        if (authHeader == null || !authHeader.startsWith("Bearer "))
            return null;
        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token))
            return null;
        String email = tokenProvider.getEmailFromJWT(token);
        return userRepository.findByEmail(email).orElse(null);
    }

    @PostMapping
    public ResponseEntity<?> createPost(@RequestHeader("Authorization") String authHeader,
            @RequestBody PostRequest request) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        if ((request.getContent() == null || request.getContent().trim().isEmpty())
                && (request.getImageUrl() == null || request.getImageUrl().trim().isEmpty())
                && (request.getVideoUrl() == null || request.getVideoUrl().trim().isEmpty())) {
            return ResponseEntity.badRequest().body("Nội dung bài đăng không được trống.");
        }

        CreatePostRequest createPostRequest = new CreatePostRequest(
                request.getContent(),
                request.getImageUrl(),
                request.getVideoUrl(),
                request.getVisibility());

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
                .stream().map(hp -> hp.getPost().getId()).collect(Collectors.toSet());

        List<PostResponse> responses = new ArrayList<>();
        for (Post p : posts) {
            if (!hiddenPostIds.contains(p.getId()) && canViewPost(p, currentUser)) {
                responses.add(convertToResponse(p, currentUser));
            }
        }

        return ResponseEntity.ok(responses);
    }

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getMyPosts(@RequestHeader("Authorization") String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        List<Post> posts = postRepository.findByUserIdOrderByCreatedAtDesc(currentUser.getId());
        List<PostResponse> responses = new ArrayList<>();
        for (Post p : posts) {
            if (canViewPost(p, currentUser)) {
                responses.add(convertToResponse(p, currentUser));
            }
        }
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
        List<PostResponse> responses = new ArrayList<>();
        for (Post p : posts) {
            if (canViewPost(p, currentUser)) {
                responses.add(convertToResponse(p, currentUser));
            }
        }
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

        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty())
            return ResponseEntity.notFound().build();

        Post post = postOpt.get();
        Optional<Like> existingLike = likeRepository.findByPostAndUser(post, user);

        if (existingLike.isPresent()) {
            likeRepository.delete(existingLike.get());
            return ResponseEntity.ok("Đã huỷ like");
        } else {
            Like freshLike = new Like();
            freshLike.setPost(post);
            freshLike.setUser(user);
            likeRepository.save(freshLike);

            // Gửi thông báo cho chủ bài viết (nếu không phải tự like)
            if (!post.getUser().getId().equals(user.getId())) {
                com.pbl5.model.Notification notifEntity = new com.pbl5.model.Notification();
                notifEntity.setUser(post.getUser());
                notifEntity.setSender(user);
                notifEntity.setType("LIKE_POST");
                notifEntity.setMessage(user.getFullName() + " đã thích bài viết của bạn.");
                notifEntity.setLink("/html/home.html#post-" + post.getId());
                notifEntity = notificationRepository.save(notifEntity);

                Map<String, Object> notification = new HashMap<>();
                notification.put("id", notifEntity.getId());
                notification.put("type", "LIKE_POST");
                notification.put("message", notifEntity.getMessage());
                notification.put("senderId", user.getId());
                notification.put("senderName", user.getFullName());
                notification.put("senderAvatar", user.getAvatar());
                notification.put("link", notifEntity.getLink());

                messagingTemplate.convertAndSend("/topic/notifications/" + post.getUser().getId(), notification);
            }

            return ResponseEntity.ok("Đã like");
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

        postRepository.delete(post);
        return ResponseEntity.ok("Đã xóa bài viết thành công!");
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
            post.setVisibility(PostVisibility.valueOf(level.toUpperCase()));
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

        String reason = body.get("reason");
        if (reason == null || reason.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Lý do báo cáo không được để trống.");
        }

        Report report = new Report();
        report.setUser(user);
        report.setPost(postOpt.get());
        report.setReason(reason);
        reportRepository.save(report);

        return ResponseEntity.ok("Đã gửi báo cáo thành công.");
    }

    @GetMapping("/{postId}/comments")
    public ResponseEntity<?> getComments(@PathVariable Long postId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);

        List<Comment> comments = commentRepository.findByPostIdOrderByCreatedAtDesc(postId);
        List<CommentResponse> responses = new ArrayList<>();

        for (Comment c : comments) {
            String authorName = c.getUser().getFullName() != null ? c.getUser().getFullName() : "Người dùng";
            String authorAvatar = c.getUser().getAvatar() != null ? c.getUser().getAvatar()
                    : "https://ui-avatars.com/api/?name=" + authorName.replace(" ", "+")
                            + "&background=00d1b2&color=fff";
            boolean isMine = currentUser != null && c.getUser().getId().equals(currentUser.getId());

            responses.add(new CommentResponse(
                    c.getId(),
                    c.getContent(),
                    c.getUser().getId(),
                    authorName,
                    authorAvatar,
                    c.getCreatedAt(),
                    isMine));
        }
        return ResponseEntity.ok(responses);
    }

    @PostMapping("/{postId}/comments")
    public ResponseEntity<?> addComment(@PathVariable Long postId, @RequestBody CommentRequest request,
            @RequestHeader("Authorization") String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null)
            return ResponseEntity.status(401).body("Chưa đăng nhập.");

        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty())
            return ResponseEntity.notFound().build();

        if (request.getContent() == null || request.getContent().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Nội dung không được để trống");
        }

        Comment comment = new Comment();
        comment.setContent(request.getContent().trim());
        comment.setPost(postOpt.get());
        comment.setUser(user);

        comment = commentRepository.save(comment);

        // Gửi thông báo cho chủ bài viết (nếu không tự comment)
        if (!postOpt.get().getUser().getId().equals(user.getId())) {
            com.pbl5.model.Notification notifEntity = new com.pbl5.model.Notification();
            notifEntity.setUser(postOpt.get().getUser());
            notifEntity.setSender(user);
            notifEntity.setType("COMMENT_POST");
            notifEntity.setMessage(user.getFullName() + " đã bình luận về bài viết của bạn.");
            notifEntity.setLink("/html/home.html#post-" + postOpt.get().getId());
            notifEntity = notificationRepository.save(notifEntity);

            Map<String, Object> notification = new HashMap<>();
            notification.put("id", notifEntity.getId());
            notification.put("type", "COMMENT_POST");
            notification.put("message", notifEntity.getMessage());
            notification.put("senderId", user.getId());
            notification.put("senderName", user.getFullName());
            notification.put("senderAvatar", user.getAvatar());
            notification.put("link", notifEntity.getLink());

            messagingTemplate.convertAndSend("/topic/notifications/" + postOpt.get().getUser().getId(), notification);
        }

        String authorName = user.getFullName() != null ? user.getFullName() : "Người dùng";
        String authorAvatar = user.getAvatar() != null ? user.getAvatar()
                : "https://ui-avatars.com/api/?name=" + authorName.replace(" ", "+") + "&background=00d1b2&color=fff";

        CommentResponse response = new CommentResponse(
                comment.getId(),
                comment.getContent(),
                user.getId(),
                authorName,
                authorAvatar,
                comment.getCreatedAt(),
                true);

        return ResponseEntity.ok(response);
    }

    private List<PostResponse> convertToResponses(List<Post> posts, User currentUser) {
        if (posts == null || posts.isEmpty()) {
            return new ArrayList<>();
        }

        List<Long> postIds = posts.stream().map(Post::getId).collect(Collectors.toList());

        Map<Long, Long> likeCountsMap = new HashMap<>();
        for (Object[] result : likeRepository.countLikesByPostIds(postIds)) {
            likeCountsMap.put((Long) result[0], (Long) result[1]);
        }

        Map<Long, Long> commentCountsMap = new HashMap<>();
        for (Object[] result : commentRepository.countCommentsByPostIds(postIds)) {
            commentCountsMap.put((Long) result[0], (Long) result[1]);
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
                            post.getVisibility() != null ? post.getVisibility().name() : "PUBLIC"));
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

        return new PostResponse(
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
                post.getVisibility() != null ? post.getVisibility().name() : "PUBLIC");
    }
}