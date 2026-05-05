package com.pbl5.controller;

import com.pbl5.dto.ChatMessage;
import com.pbl5.model.Message;
import com.pbl5.model.User;
import com.pbl5.repository.MessageRepository;
import com.pbl5.repository.UserRepository;
import com.pbl5.security.JwtTokenProvider;
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
import java.util.stream.Collectors;

@RestController
public class ChatController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage) {
        User sender = userRepository.findById(chatMessage.getSenderId()).orElse(null);
        User receiver = userRepository.findById(chatMessage.getReceiverId()).orElse(null);

        if (sender != null && receiver != null) {
            Message message = new Message();
            message.setSender(sender);
            message.setReceiver(receiver);
            message.setContent(chatMessage.getContent());
            Message savedMsg = messageRepository.save(message);

            chatMessage.setId(savedMsg.getId());
            chatMessage.setTimestamp(savedMsg.getTimestamp());

            // Gửi tin nhắn đến người nhận
            messagingTemplate.convertAndSend(
                    "/topic/messages/" + chatMessage.getReceiverId(), chatMessage);
            
            // Gửi lại màn hình người gửi
            messagingTemplate.convertAndSend(
                    "/topic/messages/" + chatMessage.getSenderId(), chatMessage);
        }
    }

    @GetMapping("/api/messages/{userId}")
    public ResponseEntity<?> getChatHistory(
            @PathVariable Long userId, 
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

        List<Message> history = messageRepository.findChatHistory(currentUser, targetUser);
        
        // Mark as read
        messageRepository.markAsRead(targetUser, currentUser);
        
        List<ChatMessage> dtos = history.stream().map(m -> {
            ChatMessage dto = new ChatMessage();
            dto.setId(m.getId());
            dto.setSenderId(m.getSender().getId());
            dto.setReceiverId(m.getReceiver().getId());
            dto.setContent(m.getContent());
            dto.setTimestamp(m.getTimestamp());
            return dto;
        }).collect(Collectors.toList());

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

        List<Object[]> rows = messageRepository.findConversationPartnerIds(currentUser.getId());
        List<Map<String, Object>> result = new ArrayList<>();

        for (Object[] row : rows) {
            Long partnerId = ((Number) row[0]).longValue();
            User partner = userRepository.findById(partnerId).orElse(null);
            if (partner == null) continue;

            Map<String, Object> item = new HashMap<>();
            item.put("id", partner.getId());
            item.put("fullName", partner.getFullName());
            item.put("avatar", partner.getAvatar());
            item.put("isFriend", false);
            
            long unreadCount = messageRepository.countUnreadMessages(partner, currentUser);
            item.put("unreadCount", unreadCount);
            
            result.add(item);
        }

        return ResponseEntity.ok(result);
    }
}
