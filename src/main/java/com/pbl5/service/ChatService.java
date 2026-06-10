package com.pbl5.service;

import com.pbl5.dto.ChatMessage;
import com.pbl5.dto.ChatGroupDTO;
import com.pbl5.enums.FriendshipStatus;
import com.pbl5.model.Friendship;
import com.pbl5.model.Message;
import com.pbl5.model.User;
import com.pbl5.model.ChatGroup;
import com.pbl5.model.GroupReadStatus;
import com.pbl5.repository.FriendshipRepository;
import com.pbl5.repository.MessageRepository;
import com.pbl5.repository.UserRepository;
import com.pbl5.repository.ChatGroupRepository;
import com.pbl5.repository.GroupReadStatusRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ChatService {

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FriendshipRepository friendshipRepository;

    @Autowired
    private ChatGroupRepository chatGroupRepository;

    @Autowired
    private GroupReadStatusRepository groupReadStatusRepository;

    @Transactional
    public ChatMessage saveAndProcessMessage(ChatMessage chatMessage) {
        User sender = userRepository.findById(chatMessage.getSenderId()).orElse(null);
        if (sender == null) return null;

        if (chatMessage.getGroupId() != null) {
            ChatGroup group = chatGroupRepository.findById(chatMessage.getGroupId()).orElse(null);
            if (group != null) {
                Message message = new Message();
                message.setSender(sender);
                message.setChatGroup(group);
                message.setContent(chatMessage.getContent());
                message.setImageUrl(chatMessage.getImageUrl());
                Message savedMsg = messageRepository.save(message);

                chatMessage.setId(savedMsg.getId());
                chatMessage.setTimestamp(savedMsg.getTimestamp());
                chatMessage.setSenderName(sender.getFullName());
                chatMessage.setSenderAvatar(sender.getAvatar());
                chatMessage.setGroupName(group.getName());
                return chatMessage;
            }
        } else if (chatMessage.getReceiverId() != null) {
            User receiver = userRepository.findById(chatMessage.getReceiverId()).orElse(null);
            if (receiver != null) {
                Message message = new Message();
                message.setSender(sender);
                message.setReceiver(receiver);
                message.setContent(chatMessage.getContent());
                message.setImageUrl(chatMessage.getImageUrl());
                Message savedMsg = messageRepository.save(message);

                chatMessage.setId(savedMsg.getId());
                chatMessage.setTimestamp(savedMsg.getTimestamp());
                chatMessage.setSenderName(sender.getFullName());
                chatMessage.setSenderAvatar(sender.getAvatar());
                return chatMessage;
            }
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
            if (m.getReceiver() != null) {
                dto.setReceiverId(m.getReceiver().getId());
            }
            dto.setContent(m.getContent());
            dto.setImageUrl(m.getImageUrl());
            dto.setTimestamp(m.getTimestamp());
            dto.setSenderName(m.getSender().getFullName());
            dto.setSenderAvatar(m.getSender().getAvatar());
            return dto;
        }).collect(Collectors.toList());
    }

    @Transactional
    public List<ChatMessage> getGroupChatHistory(User currentUser, Long groupId) {
        ChatGroup group = chatGroupRepository.findById(groupId).orElse(null);
        if (group == null) return new ArrayList<>();

        List<Message> history = messageRepository.findGroupChatHistory(groupId);

        // Update read status for this user in the group
        GroupReadStatus status = groupReadStatusRepository.findByUserAndChatGroup(currentUser, group)
                .orElseGet(() -> {
                    GroupReadStatus newStatus = new GroupReadStatus();
                    newStatus.setUser(currentUser);
                    newStatus.setChatGroup(group);
                    return newStatus;
                });
        status.setLastReadTime(LocalDateTime.now());
        groupReadStatusRepository.save(status);

        return history.stream().map(m -> {
            ChatMessage dto = new ChatMessage();
            dto.setId(m.getId());
            dto.setSenderId(m.getSender().getId());
            dto.setGroupId(groupId);
            dto.setContent(m.getContent());
            dto.setImageUrl(m.getImageUrl());
            dto.setTimestamp(m.getTimestamp());
            dto.setSenderName(m.getSender().getFullName());
            dto.setSenderAvatar(m.getSender().getAvatar());
            dto.setGroupName(group.getName());
            return dto;
        }).collect(Collectors.toList());
    }

    @Transactional
    public ChatMessage deleteMessage(Long messageId, User currentUser) {
        Message msg = messageRepository.findById(messageId).orElse(null);
        if (msg == null) return null;
        
        if (!msg.getSender().getId().equals(currentUser.getId())) {
            return null;
        }
        
        ChatMessage revokeMsg = new ChatMessage();
        revokeMsg.setId(messageId);
        revokeMsg.setType("REVOKE");
        revokeMsg.setSenderId(currentUser.getId());
        if (msg.getChatGroup() != null) {
            revokeMsg.setGroupId(msg.getChatGroup().getId());
        } else if (msg.getReceiver() != null) {
            revokeMsg.setReceiverId(msg.getReceiver().getId());
        }
        
        messageRepository.delete(msg);
        return revokeMsg;
    }

    @Transactional
    public ChatGroup createGroup(String name, List<Long> memberIds, User creator) {
        ChatGroup group = new ChatGroup();
        group.setName(name);
        group.setCreatedBy(creator);

        Set<User> members = new HashSet<>();
        members.add(creator); // Creator is automatically a member
        for (Long id : memberIds) {
            userRepository.findById(id).ifPresent(members::add);
        }
        group.setMembers(members);

        ChatGroup savedGroup = chatGroupRepository.save(group);

        // Initialize read status for the creator
        GroupReadStatus status = new GroupReadStatus();
        status.setUser(creator);
        status.setChatGroup(savedGroup);
        status.setLastReadTime(LocalDateTime.now());
        groupReadStatusRepository.save(status);

        return savedGroup;
    }

    @Transactional
    public List<Long> getGroupMemberIds(Long groupId) {
        ChatGroup group = chatGroupRepository.findById(groupId).orElse(null);
        if (group == null) return new ArrayList<>();
        return group.getMembers().stream().map(User::getId).collect(Collectors.toList());
    }

    public List<Map<String, Object>> getConversations(User currentUser) {
        List<Object[]> rows = messageRepository.findConversationPartnerIds(currentUser.getId());
        List<Map<String, Object>> result = new ArrayList<>();

        for (Object[] row : rows) {
            if (row[0] == null) continue;
            Long partnerId = ((Number) row[0]).longValue();
            User partner = userRepository.findById(partnerId).orElse(null);
            if (partner == null) continue;

            Map<String, Object> item = new HashMap<>();
            item.put("id", partner.getId());
            item.put("fullName", partner.getFullName());
            item.put("avatar", partner.getAvatar());
            item.put("isGroup", false);
            
            // Kiểm tra trạng thái bạn bè
            Optional<Friendship> friendship = friendshipRepository.findByUsers(currentUser, partner);
            boolean isFriend = friendship.isPresent() && friendship.get().getStatus() == FriendshipStatus.ACCEPTED;
            item.put("isFriend", isFriend);
            
            long unreadCount = messageRepository.countUnreadMessages(partner, currentUser);
            item.put("unreadCount", unreadCount);

            // Get last message info
            List<Message> history = messageRepository.findChatHistory(currentUser, partner);
            String lastMessage = "Các bạn đã trở thành bạn bè";
            LocalDateTime lastMessageTime = LocalDateTime.now();
            if (row[1] != null) {
                if (row[1] instanceof java.sql.Timestamp) {
                    lastMessageTime = ((java.sql.Timestamp) row[1]).toLocalDateTime();
                } else if (row[1] instanceof LocalDateTime) {
                    lastMessageTime = (LocalDateTime) row[1];
                }
            }
            if (!history.isEmpty()) {
                Message lastMsgObj = history.get(history.size() - 1);
                if (lastMsgObj.getContent() == null || lastMsgObj.getContent().trim().isEmpty()) {
                    lastMessage = lastMsgObj.getImageUrl() != null ? "[Hình ảnh]" : "";
                } else {
                    lastMessage = lastMsgObj.getContent();
                }
                lastMessageTime = lastMsgObj.getTimestamp();
            }
            item.put("lastMessage", lastMessage);
            item.put("lastMessageTime", lastMessageTime);
            
            result.add(item);
        }

        // Fetch groups
        List<ChatGroup> groups = chatGroupRepository.findByUserMemberId(currentUser.getId());
        for (ChatGroup group : groups) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", group.getId());
            item.put("fullName", group.getName());
            item.put("avatar", group.getAvatar());
            item.put("isFriend", false);
            item.put("isGroup", true);

            // Fetch last message in group
            Message lastMsgObj = messageRepository.findLastMessageInGroup(group.getId());
            String lastMessage = "Nhóm mới được tạo";
            LocalDateTime lastMessageTime = group.getCreatedAt();
            if (lastMsgObj != null) {
                String msgContent = lastMsgObj.getContent();
                if ((msgContent == null || msgContent.trim().isEmpty()) && lastMsgObj.getImageUrl() != null) {
                    msgContent = "[Hình ảnh]";
                }
                lastMessage = lastMsgObj.getSender().getFullName() + ": " + msgContent;
                lastMessageTime = lastMsgObj.getTimestamp();
            }
            item.put("lastMessage", lastMessage);
            item.put("lastMessageTime", lastMessageTime);

            // Compute unread count
            Optional<GroupReadStatus> readStatusOpt = groupReadStatusRepository.findByUserAndChatGroup(currentUser, group);
            long unreadCount = 0;
            if (readStatusOpt.isPresent()) {
                unreadCount = messageRepository.countUnreadGroupMessages(group.getId(), readStatusOpt.get().getLastReadTime(), currentUser.getId());
            } else {
                unreadCount = messageRepository.countTotalGroupMessagesNotBySender(group.getId(), currentUser.getId());
            }
            item.put("unreadCount", unreadCount);

            result.add(item);
        }

        // Sort by lastMessageTime descending
        result.sort((m1, m2) -> {
            LocalDateTime t1 = (LocalDateTime) m1.get("lastMessageTime");
            LocalDateTime t2 = (LocalDateTime) m2.get("lastMessageTime");
            if (t1 == null && t2 == null) return 0;
            if (t1 == null) return 1;
            if (t2 == null) return -1;
            return t2.compareTo(t1);
        });

        return result;
    }
}
