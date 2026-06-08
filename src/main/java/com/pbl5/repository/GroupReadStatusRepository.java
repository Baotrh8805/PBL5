package com.pbl5.repository;

import com.pbl5.model.ChatGroup;
import com.pbl5.model.GroupReadStatus;
import com.pbl5.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GroupReadStatusRepository extends JpaRepository<GroupReadStatus, Long> {
    Optional<GroupReadStatus> findByUserAndChatGroup(User user, ChatGroup chatGroup);
}
