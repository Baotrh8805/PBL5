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
            // Gửi tin nhắn đến người nhận
            messagingTemplate.convertAndSend(
                    "/topic/messages/" + processedMessage.getReceiverId(), processedMessage);
            
            // Gửi lại màn hình người gửi
            messagingTemplate.convertAndSend(
                    "/topic/messages/" + processedMessage.getSenderId(), processedMessage);
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
}
