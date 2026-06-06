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

@RestController
@RequestMapping("/api/posts/create")
public class CreatePostController {

    @Autowired
    private PostService postService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @PostMapping
    public ResponseEntity<?> createPost(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody CreatePostRequest request) {

        User user = getAuthenticatedUser(authHeader);
        if (user == null) {
            return ResponseEntity.status(401).body("Chưa đăng nhập.");
        }

        try {
            PostResponse postResponse = postService.createPost(user, request);
            return ResponseEntity.ok(postResponse);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
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
}
