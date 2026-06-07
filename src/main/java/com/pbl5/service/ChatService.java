package com.pbl5.service;

import com.pbl5.dto.ChatMessage;
import com.pbl5.enums.FriendshipStatus;
import com.pbl5.model.Friendship;
import com.pbl5.model.Message;
import com.pbl5.model.User;
import com.pbl5.repository.FriendshipRepository;
import com.pbl5.repository.MessageRepository;
import com.pbl5.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ChatService {

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FriendshipRepository friendshipRepository;

    @Transactional
    public ChatMessage saveAndProcessMessage(ChatMessage chatMessage) {
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
            chatMessage.setSenderName(sender.getFullName());
            
            return chatMessage;
        }
        return null;
    }

    @Transactional
    public List<ChatMessage> getChatHistory(User currentUser, User targetUser) {
        List<Message> history = messageRepository.findChatHistory(currentUser, targetUser);
        
        // Mark as read
        messageRepository.markAsRead(targetUser, currentUser);
        
        return history.stream().map(m -> {
            ChatMessage dto = new ChatMessage();
            dto.setId(m.getId());
            dto.setSenderId(m.getSender().getId());
            dto.setReceiverId(m.getReceiver().getId());
            dto.setContent(m.getContent());
            dto.setTimestamp(m.getTimestamp());
            dto.setSenderName(m.getSender().getFullName());
            return dto;
        }).collect(Collectors.toList());
    }

    public List<Map<String, Object>> getConversations(User currentUser) {
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
            
            // Kiểm tra trạng thái bạn bè
            Optional<Friendship> friendship = friendshipRepository.findByUsers(currentUser, partner);
            boolean isFriend = friendship.isPresent() && friendship.get().getStatus() == FriendshipStatus.ACCEPTED;
            item.put("isFriend", isFriend);
            
            long unreadCount = messageRepository.countUnreadMessages(partner, currentUser);
            item.put("unreadCount", unreadCount);
            
            result.add(item);
        }
        return result;
    }
}
