package com.pbl5.repository;

import com.pbl5.model.Message;
import com.pbl5.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    
    @Query("SELECT m FROM Message m WHERE (m.sender = :user1 AND m.receiver = :user2) OR (m.sender = :user2 AND m.receiver = :user1) ORDER BY m.timestamp ASC")
    List<Message> findChatHistory(@Param("user1") User user1, @Param("user2") User user2);

    @Query(value = "SELECT partner_id, MAX(timestamp) AS last_time " +
            "FROM ( " +
            "  SELECT CASE WHEN sender_id = :currentUserId THEN receiver_id ELSE sender_id END AS partner_id, timestamp " +
            "  FROM messages " +
            "  WHERE sender_id = :currentUserId OR receiver_id = :currentUserId " +
            ") sub " +
            "GROUP BY partner_id " +
            "ORDER BY last_time DESC", nativeQuery = true)
    List<Object[]> findConversationPartnerIds(@Param("currentUserId") Long currentUserId);
}
