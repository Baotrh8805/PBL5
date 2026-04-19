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
import com.pbl5.repository.PostRepository;
import com.pbl5.repository.UserRepository;
import com.pbl5.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LikeRepository likeRepository;

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

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

        List<Post> posts = postRepository.findAllByOrderByCreatedAtDesc();
        List<PostResponse> responses = new ArrayList<>();
        for (Post p : posts) {
            // Kiểm tra quyền xem bài viết
            boolean canView = false;
            boolean isMine = p.getUser().getId().equals(currentUser.getId());
            
            if (p.getVisibility() == PostVisibility.PUBLIC) {
                canView = true;
            } else if (p.getVisibility() == PostVisibility.PRIVATE) {
                canView = isMine;
            } else if (p.getVisibility() == PostVisibility.FRIENDS) {
                // TODO: Logic kiểm tra bạn bè ở đây, hiện tại coi như xem được hoặc chỉ cho phép nếu isMine
                canView = true; // Sẽ update sau khi có bảng Friend
            }

            if (canView) {
                responses.add(convertToResponse(p, currentUser));
            }
        }

        return ResponseEntity.ok(responses);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyPosts(@RequestHeader("Authorization") String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Chưa đăng nhập.");

        List<Post> posts = postRepository.findByUserIdOrderByCreatedAtDesc(currentUser.getId());
        List<PostResponse> responses = new ArrayList<>();
        for (Post p : posts) {
            responses.add(convertToResponse(p, currentUser));
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
        
        String authorName = user.getFullName() != null ? user.getFullName() : "Người dùng";
        String authorAvatar = user.getAvatar() != null ? user.getAvatar() : 
            "https://ui-avatars.com/api/?name=" + authorName.replace(" ", "+") + "&background=00d1b2&color=fff";

        CommentResponse response = new CommentResponse(
            comment.getId(),
            comment.getContent(),
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
        String authorAvatar = "https://ui-avatars.com/api/?name=" + authorName.replace(" ", "+") + "&background=00d1b2&color=fff";

        return new PostResponse(
            post.getId(),
            post.getContent(),
            post.getImageUrl(),
            post.getCreatedAt(),
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