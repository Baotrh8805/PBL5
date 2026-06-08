package com.pbl5.repository;

import com.pbl5.model.ChatGroup;
import com.pbl5.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatGroupRepository extends JpaRepository<ChatGroup, Long> {

    @Query("SELECT g FROM ChatGroup g JOIN g.members m WHERE m.id = :userId ORDER BY g.createdAt DESC")
    List<ChatGroup> findByUserMemberId(@Param("userId") Long userId);
}
