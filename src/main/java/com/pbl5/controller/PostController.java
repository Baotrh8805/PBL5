package com.pbl5.controller;

import com.pbl5.dto.CommentRequest;
import com.pbl5.dto.CommentResponse;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import com.pbl5.repository.NotificationRepository;
import java.util.HashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
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


    private boolean canViewPost(Post p, User currentUser) {
        if (p.getUser().getId().equals(currentUser.getId())) return true;
        if (p.getVisibility() == PostVisibility.PUBLIC || p.getVisibility() == null) return true;
        if (p.getVisibility() == PostVisibility.PRIVATE) return false;
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
    public ResponseEntity<?> createPost(@RequestHeader("Authorization") String authHeader, @RequestBody PostRequest request) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null) return ResponseEntity.status(401).body("Chưa đăng nhập.");

        Post post = new Post();
        post.setContent(request.getContent());
        post.setImageUrl(request.getImageUrl());
        if (request.getVisibility() != null) {
            try {
                post.setVisibility(PostVisibility.valueOf(request.getVisibility().toUpperCase()));
            } catch (IllegalArgumentException e) {
                post.setVisibility(PostVisibility.PUBLIC);
            }
        }
        post.setUser(user);

        Post savedPost = postRepository.save(post);
        return ResponseEntity.ok(convertToResponse(savedPost, user));
    }

    @GetMapping
    public ResponseEntity<?> getAllPosts(@RequestHeader("Authorization") String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Chưa đăng nhập.");

        // Optimized query to fetch friends' posts, own posts, and public posts
        List<Post> posts = postRepository.findHomeFeed(currentUser.getId());
        List<PostResponse> responses = new ArrayList<>();
        for (Post p : posts) {
            responses.add(convertToResponse(p, currentUser));
        }

        return ResponseEntity.ok(responses);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyPosts(@RequestHeader("Authorization") String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Chưa đăng nhập.");

        List<Post> posts = postRepository.findByUserIdAndStatusOrderByCreatedAtDesc(currentUser.getId(), com.pbl5.enums.PostStatus.ACTIVE);
        List<PostResponse> responses = new ArrayList<>();
        for (Post p : posts) {
            responses.add(convertToResponse(p, currentUser));
        }
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getUserPosts(@RequestHeader("Authorization") String authHeader, @PathVariable Long userId) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Chưa đăng nhập.");

        List<Post> posts = postRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, com.pbl5.enums.PostStatus.ACTIVE);
        List<PostResponse> responses = new ArrayList<>();
        for (Post p : posts) {
            if (canViewPost(p, currentUser)) {
                responses.add(convertToResponse(p, currentUser));
            }
        }
        return ResponseEntity.ok(responses);
    }

    // Like hoặc Unlike
    @PostMapping("/{postId}/like")
    public ResponseEntity<?> toggleLike(@RequestHeader("Authorization") String authHeader, @PathVariable Long postId) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null) return ResponseEntity.status(401).body("Chưa đăng nhập.");

        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty()) return ResponseEntity.notFound().build();

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
        if (user == null) return ResponseEntity.status(401).body("Chưa đăng nhập.");

        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty()) return ResponseEntity.notFound().build();

        Post post = postOpt.get();
        // Kiểm tra quyền xóa bài
        if (!post.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Không có quyền xóa bài này.");
        }

        postRepository.delete(post);
        return ResponseEntity.ok("Đã xóa bài viết thành công!");
    }

    @PatchMapping("/{postId}/visibility")
    public ResponseEntity<?> changeVisibility(@RequestHeader("Authorization") String authHeader, @PathVariable Long postId, @RequestParam String level) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null) return ResponseEntity.status(401).body("Chưa đăng nhập.");

        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty()) return ResponseEntity.notFound().build();

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

    @GetMapping("/{postId}/comments")
    public ResponseEntity<?> getComments(@PathVariable Long postId, @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        
        List<Comment> comments = commentRepository.findByPostIdOrderByCreatedAtDesc(postId);
        List<CommentResponse> responses = new ArrayList<>();
        
        for (Comment c : comments) {
            String authorName = c.getUser().getFullName() != null ? c.getUser().getFullName() : "Người dùng";
            String authorAvatar = c.getUser().getAvatar() != null ? c.getUser().getAvatar() : 
                "https://ui-avatars.com/api/?name=" + authorName.replace(" ", "+") + "&background=00d1b2&color=fff";
            boolean isMine = currentUser != null && c.getUser().getId().equals(currentUser.getId());
            
            responses.add(new CommentResponse(
                c.getId(),
                c.getContent(),
                c.getUser().getId(),
                authorName,
                authorAvatar,
                c.getCreatedAt(),
                isMine
            ));
        }
        return ResponseEntity.ok(responses);
    }

    @PostMapping("/{postId}/comments")
    public ResponseEntity<?> addComment(@PathVariable Long postId, @RequestBody CommentRequest request, @RequestHeader("Authorization") String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null) return ResponseEntity.status(401).body("Chưa đăng nhập.");

        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty()) return ResponseEntity.notFound().build();

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
        String authorAvatar = user.getAvatar() != null ? user.getAvatar() : 
            "https://ui-avatars.com/api/?name=" + authorName.replace(" ", "+") + "&background=00d1b2&color=fff";

        CommentResponse response = new CommentResponse(
            comment.getId(),
            comment.getContent(),
            user.getId(),
            authorName,
            authorAvatar,
            comment.getCreatedAt(),
            true
        );
        
        return ResponseEntity.ok(response);
    }

    private PostResponse convertToResponse(Post post, User currentUser) {
        long likeCount = likeRepository.countByPostId(post.getId());
        long commentCount = commentRepository.countByPostId(post.getId());
        
        boolean isLiked = false;
        boolean isMine = false;
        if (currentUser != null) {
            isLiked = likeRepository.findByPostAndUser(post, currentUser).isPresent();
            isMine = post.getUser().getId().equals(currentUser.getId());
        }

        String authorName = post.getUser().getFullName() != null ? post.getUser().getFullName() : "Người dùng";
        String authorAvatar = post.getUser().getAvatar() != null ? post.getUser().getAvatar() : 
            "https://ui-avatars.com/api/?name=" + authorName.replace(" ", "+") + "&background=00d1b2&color=fff";

        return new PostResponse(
            post.getId(),
            post.getContent(),
            post.getImageUrl(),
            post.getCreatedAt(),
            post.getUser().getId(),
            authorName,
            authorAvatar,
            likeCount,
            commentCount,
            isLiked,
            isMine,
            post.getVisibility() != null ? post.getVisibility().name() : "PUBLIC"
        );
    }
}