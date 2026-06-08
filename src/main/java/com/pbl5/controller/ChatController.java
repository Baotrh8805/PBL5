package com.pbl5.controller;

import com.pbl5.dto.ChatMessage;
import com.pbl5.model.User;
import com.pbl5.repository.UserRepository;
import com.pbl5.security.JwtTokenProvider;
import com.pbl5.service.ChatService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
public class ChatController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private ChatService chatService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage) {
        ChatMessage processedMessage = chatService.saveAndProcessMessage(chatMessage);

        if (processedMessage != null) {
            if (processedMessage.getGroupId() != null) {
                // Gửi tin nhắn đến tất cả thành viên trong nhóm
                List<Long> memberIds = chatService.getGroupMemberIds(processedMessage.getGroupId());
                for (Long memberId : memberIds) {
                    messagingTemplate.convertAndSend(
                            "/topic/messages/" + memberId, processedMessage);
                }
            } else if (processedMessage.getReceiverId() != null) {
                // Gửi tin nhắn đến người nhận trực tiếp
                messagingTemplate.convertAndSend(
                        "/topic/messages/" + processedMessage.getReceiverId(), processedMessage);
                
                // Gửi lại màn hình người gửi
                messagingTemplate.convertAndSend(
                        "/topic/messages/" + processedMessage.getSenderId(), processedMessage);
            }
        }
    }

    @GetMapping("/api/messages/{userId}")
    public ResponseEntity<?> getChatHistory(
            @PathVariable("userId") Long userId, 
            @RequestHeader(value="Authorization", required=false) String authHeader) {
        
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token)) {
            return ResponseEntity.status(401).body("Invalid token");
        }

        String email = tokenProvider.getEmailFromJWT(token);
        User currentUser = userRepository.findByEmail(email).orElse(null);
        User targetUser = userRepository.findById(userId).orElse(null);

        if (currentUser == null || targetUser == null) {
            return ResponseEntity.badRequest().body("User not found");
        }

        List<ChatMessage> dtos = chatService.getChatHistory(currentUser, targetUser);

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/api/messages/conversations")
    public ResponseEntity<?> getConversations(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token)) {
            return ResponseEntity.status(401).body("Invalid token");
        }

        String email = tokenProvider.getEmailFromJWT(token);
        User currentUser = userRepository.findByEmail(email).orElse(null);
        if (currentUser == null) {
            return ResponseEntity.badRequest().body("User not found");
        }

        List<Map<String, Object>> result = chatService.getConversations(currentUser);

        return ResponseEntity.ok(result);
    }

    @PostMapping("/api/groups")
    public ResponseEntity<?> createGroup(
            @RequestBody Map<String, Object> payload,
            @RequestHeader(value="Authorization", required=false) String authHeader) {
        
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token)) {
            return ResponseEntity.status(401).body("Invalid token");
        }

        String email = tokenProvider.getEmailFromJWT(token);
        User currentUser = userRepository.findByEmail(email).orElse(null);
        if (currentUser == null) {
            return ResponseEntity.badRequest().body("User not found");
        }

        String name = (String) payload.get("name");
        List<?> rawMemberIds = (List<?>) payload.get("memberIds");
        List<Long> memberIds = new ArrayList<>();
        if (rawMemberIds != null) {
            for (Object id : rawMemberIds) {
                if (id instanceof Number) {
                    memberIds.add(((Number) id).longValue());
                }
            }
        }

        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Group name is required");
        }

        if (memberIds.size() < 2) {
            return ResponseEntity.badRequest().body("Group must have at least 2 other members");
        }

        com.pbl5.model.ChatGroup group = chatService.createGroup(name, memberIds, currentUser);

        Map<String, Object> response = new HashMap<>();
        response.put("id", group.getId());
        response.put("name", group.getName());
        response.put("avatar", group.getAvatar());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/groups/{groupId}/messages")
    public ResponseEntity<?> getGroupHistory(
            @PathVariable("groupId") Long groupId,
            @RequestHeader(value="Authorization", required=false) String authHeader) {
        
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token)) {
            return ResponseEntity.status(401).body("Invalid token");
        }

        String email = tokenProvider.getEmailFromJWT(token);
        User currentUser = userRepository.findByEmail(email).orElse(null);
        if (currentUser == null) {
            return ResponseEntity.badRequest().body("User not found");
        }

        List<ChatMessage> dtos = chatService.getGroupChatHistory(currentUser, groupId);
        return ResponseEntity.ok(dtos);
    }
}
