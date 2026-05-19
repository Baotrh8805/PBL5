package com.pbl5.controller;

import com.pbl5.model.User;
import com.pbl5.repository.UserRepository;
import com.pbl5.security.JwtTokenProvider;
import com.pbl5.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private UserRepository userRepository;

    private User getUserFromToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token)) return null;
        String email = tokenProvider.getEmailFromJWT(token);
        return userRepository.findByEmail(email).orElse(null);
    }

    @GetMapping
    public ResponseEntity<?> getNotifications(@RequestHeader("Authorization") String authHeader) {
        User user = getUserFromToken(authHeader);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        List<Map<String, Object>> result = notificationService.getNotifications(user);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount(@RequestHeader("Authorization") String authHeader) {
        User user = getUserFromToken(authHeader);
        if (user == null) return ResponseEntity.status(401).body(0);

        long count = notificationService.getUnreadCount(user);
        return ResponseEntity.ok(Map.of("unreadCount", count));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable Long id, @RequestHeader("Authorization") String authHeader) {
        User user = getUserFromToken(authHeader);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        notificationService.markAsRead(id, user);
        return ResponseEntity.ok("Marked as read");
    }

    @PostMapping("/read-all")
    public ResponseEntity<?> markAllAsRead(@RequestHeader("Authorization") String authHeader) {
        User user = getUserFromToken(authHeader);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        notificationService.markAllAsRead(user);
        return ResponseEntity.ok("All marked as read");
    }
}
