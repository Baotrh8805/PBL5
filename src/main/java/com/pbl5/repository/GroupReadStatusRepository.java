package com.pbl5.repository;

import com.pbl5.model.ChatGroup;
import com.pbl5.model.GroupReadStatus;
import com.pbl5.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GroupReadStatusRepository extends JpaRepository<GroupReadStatus, Long> {
    Optional<GroupReadStatus> findByUserAndChatGroup(User user, ChatGroup chatGroup);

    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM GroupReadStatus g WHERE g.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM GroupReadStatus g WHERE g.chatGroup.id = :groupId")
    void deleteByGroupId(@Param("groupId") Long groupId);
}
