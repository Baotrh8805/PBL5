package com.pbl5.controller;

import com.pbl5.dto.FriendResponse;
import com.pbl5.enums.FriendshipStatus;
import com.pbl5.model.Friendship;
import com.pbl5.model.User;
import com.pbl5.repository.FriendshipRepository;
import com.pbl5.repository.UserRepository;
import com.pbl5.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/friends")
public class FriendshipController {

    @Autowired
    private FriendshipRepository friendshipRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private com.pbl5.repository.NotificationRepository notificationRepository;

    private User getAuthenticatedUser(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token)) return null;
        String email = tokenProvider.getEmailFromJWT(token);
        return userRepository.findByEmail(email).orElse(null);
    }

    // 1. Get friend suggestions (all users not friend or pending)
    @GetMapping("/suggestions")
    public ResponseEntity<?> getSuggestions(@RequestHeader(value="Authorization", required=false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Unauthorized");

        List<User> allUsers = userRepository.findAll();
        List<FriendResponse> suggestions = new ArrayList<>();

        for (User u : allUsers) {
            if (u.getId().equals(currentUser.getId())) continue;
            Optional<Friendship> opt = friendshipRepository.findByUsers(currentUser, u);
            if (opt.isEmpty()) {
                suggestions.add(new FriendResponse(u.getId(), u.getFullName(), u.getAvatar(), "NOT_FRIEND"));
            }
        }
        return ResponseEntity.ok(suggestions);
    }

    // 2. Get pending requests for the current user
    @GetMapping("/requests")
    public ResponseEntity<?> getRequests(@RequestHeader(value="Authorization", required=false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Unauthorized");

        List<Friendship> requests = friendshipRepository.findByReceiverAndStatus(currentUser, FriendshipStatus.PENDING);
        List<FriendResponse> responses = requests.stream().map(f -> {
            User requester = f.getRequester();
            return new FriendResponse(requester.getId(), requester.getFullName(), requester.getAvatar(), "PENDING_RECEIVED");
        }).collect(Collectors.toList());

        return ResponseEntity.ok(responses);
    }

    // 3. Get actual friends list
    @GetMapping
    public ResponseEntity<?> getFriends(@RequestHeader(value="Authorization", required=false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Unauthorized");

        List<Friendship> friends = friendshipRepository.findAllFriends(currentUser, FriendshipStatus.ACCEPTED);
        List<FriendResponse> responses = friends.stream().map(f -> {
            User friend = f.getRequester().getId().equals(currentUser.getId()) ? f.getReceiver() : f.getRequester();
            return new FriendResponse(friend.getId(), friend.getFullName(), friend.getAvatar(), "ACCEPTED");
        }).collect(Collectors.toList());

        return ResponseEntity.ok(responses);
    }

    // 4. Send friend request
    @PostMapping("/request/{userId}")
    public ResponseEntity<?> sendRequest(@PathVariable Long userId, @RequestHeader(value="Authorization", required=false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Unauthorized");

        User target = userRepository.findById(userId).orElse(null);
        if (target == null) return ResponseEntity.badRequest().body("User not found");

        Optional<Friendship> existing = friendshipRepository.findByUsers(currentUser, target);
        if (existing.isPresent()) return ResponseEntity.badRequest().body("Request already sent or are friends");

        Friendship f = new Friendship(currentUser, target, FriendshipStatus.PENDING);
        friendshipRepository.save(f);

        // Delete any existing exact unread notification
        notificationRepository.deleteByUserIdAndSenderIdAndType(target.getId(), currentUser.getId(), "NEW_FRIEND_REQUEST");
        
        // Save to DB
        com.pbl5.model.Notification notifEntity = new com.pbl5.model.Notification();
        notifEntity.setUser(target);
        notifEntity.setSender(currentUser);
        notifEntity.setType("NEW_FRIEND_REQUEST");
        notifEntity.setMessage(currentUser.getFullName() + " đã gửi cho bạn một lời mời kết bạn.");
        notifEntity.setLink("/html/friends.html");
        notifEntity = notificationRepository.save(notifEntity);

        // Send Real-time notification to Target User
        Map<String, Object> notification = new HashMap<>();
        notification.put("id", notifEntity.getId());
        notification.put("type", "NEW_FRIEND_REQUEST");
        notification.put("message", currentUser.getFullName() + " đã gửi cho bạn một lời mời kết bạn.");
        notification.put("senderId", currentUser.getId());
        notification.put("senderName", currentUser.getFullName());
        notification.put("senderAvatar", currentUser.getAvatar());
        notification.put("link", notifEntity.getLink());
        messagingTemplate.convertAndSend("/topic/notifications/" + target.getId(), notification);

        return ResponseEntity.ok("Request sent");
    }

    // 5. Accept friend request
    @PostMapping("/accept/{userId}")
    public ResponseEntity<?> acceptRequest(@PathVariable Long userId, @RequestHeader(value="Authorization", required=false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Unauthorized");

        User requester = userRepository.findById(userId).orElse(null);
        if (requester == null) return ResponseEntity.badRequest().body("User not found");

        Optional<Friendship> opt = friendshipRepository.findByUsers(requester, currentUser);
        if (opt.isPresent()) {
            Friendship f = opt.get();
            if (f.getReceiver().getId().equals(currentUser.getId()) && f.getStatus() == FriendshipStatus.PENDING) {
                f.setStatus(FriendshipStatus.ACCEPTED);
                friendshipRepository.save(f);

                // Save DB notification
                notificationRepository.deleteByUserIdAndSenderIdAndType(requester.getId(), currentUser.getId(), "FRIEND_REQUEST_ACCEPTED");
                com.pbl5.model.Notification notifEntity = new com.pbl5.model.Notification();
                notifEntity.setUser(requester);
                notifEntity.setSender(currentUser);
                notifEntity.setType("FRIEND_REQUEST_ACCEPTED");
                notifEntity.setMessage(currentUser.getFullName() + " đã chấp nhận lời mời kết bạn của bạn.");
                notifEntity.setLink("/html/friends.html");
                notifEntity = notificationRepository.save(notifEntity);

                // Notify both that request was accepted
                Map<String, Object> notification = new HashMap<>();
                notification.put("id", notifEntity.getId());
                notification.put("type", "FRIEND_REQUEST_ACCEPTED");
                notification.put("message", currentUser.getFullName() + " đã chấp nhận lời mời kết bạn của bạn.");
                notification.put("senderId", currentUser.getId());
                notification.put("senderFullName", currentUser.getFullName());
                notification.put("link", notifEntity.getLink());
                messagingTemplate.convertAndSend("/topic/notifications/" + requester.getId(), notification);
                
                return ResponseEntity.ok("Request accepted");
            }
        }
        return ResponseEntity.badRequest().body("No pending request from this user");
    }

    // 6. Remove friend or cancel request
    @DeleteMapping("/{userId}")
    public ResponseEntity<?> removeFriend(@PathVariable Long userId, @RequestHeader(value="Authorization", required=false) String authHeader) {
        User currentUser = getAuthenticatedUser(authHeader);
        if (currentUser == null) return ResponseEntity.status(401).body("Unauthorized");

        User target = userRepository.findById(userId).orElse(null);
        if (target == null) return ResponseEntity.badRequest().body("User not found");

        Optional<Friendship> opt = friendshipRepository.findByUsers(currentUser, target);
        if (opt.isPresent()) {
            friendshipRepository.delete(opt.get());
            return ResponseEntity.ok("Removed or canceled");
        }
        return ResponseEntity.badRequest().body("No friendship found");
    }
}
