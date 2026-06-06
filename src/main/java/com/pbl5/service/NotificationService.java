package com.pbl5.service;

import com.pbl5.model.Notification;
import com.pbl5.model.User;
import com.pbl5.repository.NotificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    public List<Map<String, Object>> getNotifications(User user) {
        List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId());

        return notifications.stream().map(n -> {
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
    }

    public long getUnreadCount(User user) {
        return notificationRepository.countByUserIdAndIsReadFalse(user.getId());
    }

    @Transactional
    public void markAsRead(Long id, User user) {
        Notification notification = notificationRepository.findById(id).orElse(null);
        if (notification != null && notification.getUser().getId().equals(user.getId())) {
            notification.setRead(true);
            notificationRepository.save(notification);
        }
    }

    @Transactional
    public void markAllAsRead(User user) {
        notificationRepository.markAllAsReadByUserId(user.getId());
    }
}
