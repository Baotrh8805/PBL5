package com.pbl5.repository;

import com.pbl5.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);
    long countByUserIdAndIsReadFalse(Long userId);

    // For deleting old notifications or duplicate ones
    @Transactional
    void deleteByUserIdAndSenderIdAndType(Long userId, Long senderId, String type);
}
