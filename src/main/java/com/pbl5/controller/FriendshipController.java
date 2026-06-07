package com.pbl5.controller;

import com.pbl5.dto.FriendResponse;
import com.pbl5.model.User;
import com.pbl5.repository.UserRepository;
import com.pbl5.security.JwtTokenProvider;
import com.pbl5.service.FriendshipService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/friends")
public class FriendshipController {

    @Autowired
    private FriendshipService friendshipService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    private User getAuthenticatedUser(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token)) return null;
        String email = tokenProvider.getEmailFromJWT(token);
        return userRepository.findByEmail(email).orElse(null);
    }

    @GetMapping("/suggestions")
    public ResponseEntity<?> getSuggestions(@RequestHeader(value="Authorization", required=false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Unauthorized");

        List<FriendResponse> suggestions = friendshipService.getSuggestions(currentUser);
        return ResponseEntity.ok(suggestions);
    }

    @GetMapping("/requests")
    public ResponseEntity<?> getRequests(@RequestHeader(value="Authorization", required=false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Unauthorized");

        List<FriendResponse> responses = friendshipService.getRequests(currentUser);
        return ResponseEntity.ok(responses);
    }

    @GetMapping
    public ResponseEntity<?> getFriends(@RequestHeader(value="Authorization", required=false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Unauthorized");

        List<FriendResponse> responses = friendshipService.getFriends(currentUser);
        return ResponseEntity.ok(responses);
    }

    @PostMapping("/request/{userId}")
    public ResponseEntity<?> sendRequest(@PathVariable Long userId, @RequestHeader(value="Authorization", required=false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Unauthorized");

        User target = userRepository.findById(userId).orElse(null);
        if (target == null) return ResponseEntity.badRequest().body("User not found");

        try {
            friendshipService.sendRequest(currentUser, target);
            return ResponseEntity.ok("Request sent");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/accept/{userId}")
    public ResponseEntity<?> acceptRequest(@PathVariable("userId") Long userId, @RequestHeader(value="Authorization", required=false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Unauthorized");

        User requester = userRepository.findById(userId).orElse(null);
        if (requester == null) return ResponseEntity.badRequest().body("User not found");

        try {
            friendshipService.acceptRequest(currentUser, requester);
            return ResponseEntity.ok("Request accepted");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/refuse/{userId}")
    public ResponseEntity<?> refuseRequest(@PathVariable("userId") Long userId, @RequestHeader(value="Authorization", required=false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Unauthorized");

        User requester = userRepository.findById(userId).orElse(null);
        if (requester == null) return ResponseEntity.badRequest().body("User not found");

        try {
            friendshipService.refuseRequest(currentUser, requester);
            return ResponseEntity.ok("Request refused");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<?> removeFriend(@PathVariable Long userId, @RequestHeader(value="Authorization", required=false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Unauthorized");

        User target = userRepository.findById(userId).orElse(null);
        if (target == null) return ResponseEntity.badRequest().body("User not found");

        try {
            friendshipService.removeFriend(currentUser, target);
            return ResponseEntity.ok("Removed or canceled");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
