package com.pbl5.controller;

import com.pbl5.model.Notification;
import com.pbl5.model.User;
import com.pbl5.repository.NotificationRepository;
import com.pbl5.repository.UserRepository;
import com.pbl5.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private NotificationRepository notificationRepository;

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

        List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId());

        List<Map<String, Object>> result = notifications.stream().map(n -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", n.getId());
            map.put("type", n.getType());
            map.put("message", n.getMessage());
            map.put("link", n.getLink());
            map.put("isRead", n.isRead());
            map.put("createdAt", n.getCreatedAt().toString());
            if (n.getSender() != null) {
                map.put("senderId", n.getSender().getId());
                map.put("senderName", n.getSender().getFullName());
                map.put("senderAvatar", n.getSender().getAvatar());
            }
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount(@RequestHeader("Authorization") String authHeader) {
        User user = getUserFromToken(authHeader);
        if (user == null) return ResponseEntity.status(401).body(0);

        long count = notificationRepository.countByUserIdAndIsReadFalse(user.getId());
        return ResponseEntity.ok(Map.of("unreadCount", count));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable Long id, @RequestHeader("Authorization") String authHeader) {
        User user = getUserFromToken(authHeader);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        Notification notification = notificationRepository.findById(id).orElse(null);
        if (notification != null && notification.getUser().getId().equals(user.getId())) {
            notification.setRead(true);
            notificationRepository.save(notification);
        }
        return ResponseEntity.ok("Marked as read");
    }

    @PostMapping("/read-all")
    public ResponseEntity<?> markAllAsRead(@RequestHeader("Authorization") String authHeader) {
        User user = getUserFromToken(authHeader);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        List<Notification> unread = notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream().filter(n -> !n.isRead()).collect(Collectors.toList());
        
        unread.forEach(n -> n.setRead(true));
        if (!unread.isEmpty()) {
            notificationRepository.saveAll(unread);
        }
        return ResponseEntity.ok("All marked as read");
    }
}
