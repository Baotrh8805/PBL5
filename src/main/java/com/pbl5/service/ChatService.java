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
        if (rows == null || rows.isEmpty()) {
            return result;
        }

        // 1. Thu thập tất cả partner ID
        List<Long> partnerIds = rows.stream()
                .map(row -> ((Number) row[0]).longValue())
                .collect(Collectors.toList());

        // 2. Tải toàn bộ thông tin User của đối tác trong 1 query
        List<User> partners = userRepository.findAllById(partnerIds);
        Map<Long, User> partnerMap = partners.stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        // 3. Tải toàn bộ mối quan hệ bạn bè trong 1 query
        List<Friendship> friendships = friendshipRepository.findFriendshipsBetweenUserAndPartners(currentUser, partners);
        Map<Long, Friendship> friendshipMap = new HashMap<>();
        for (Friendship f : friendships) {
            Long otherId = f.getRequester().getId().equals(currentUser.getId()) ? f.getReceiver().getId() : f.getRequester().getId();
            friendshipMap.put(otherId, f);
        }

        // 4. Tải số lượng tin nhắn chưa đọc của tất cả partners trong 1 query
        List<Object[]> unreadCounts = messageRepository.countUnreadMessagesByPartners(partners, currentUser);
        Map<Long, Long> unreadMap = new HashMap<>();
        for (Object[] row : unreadCounts) {
            if (row[0] != null && row[1] != null) {
                unreadMap.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
            }
        }

        // 5. Build kết quả theo thứ tự hội thoại gốc
        for (Object[] row : rows) {
            Long partnerId = ((Number) row[0]).longValue();
            User partner = partnerMap.get(partnerId);
            if (partner == null) continue;

            Map<String, Object> item = new HashMap<>();
            item.put("id", partner.getId());
            item.put("fullName", partner.getFullName());
            item.put("avatar", partner.getAvatar());
            
            Friendship f = friendshipMap.get(partnerId);
            boolean isFriend = f != null && f.getStatus() == FriendshipStatus.ACCEPTED;
            item.put("isFriend", isFriend);
            
            long unreadCount = unreadMap.getOrDefault(partnerId, 0L);
            item.put("unreadCount", unreadCount);
            
            result.add(item);
        }
        return result;
    }
}
