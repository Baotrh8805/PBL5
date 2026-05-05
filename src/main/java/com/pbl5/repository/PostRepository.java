package com.pbl5.repository;

import com.pbl5.model.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {
    List<Post> findAllByOrderByCreatedAtDesc();
    List<Post> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<Post> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, com.pbl5.enums.PostStatus status);

    @Query("SELECT p FROM Post p WHERE p.status = 'ACTIVE' " +
           "AND (p.visibility = 'PUBLIC' " +
           "OR p.user.id = :currentUserId " +
           "OR (p.visibility = 'FRIENDS' AND EXISTS (" +
           "  SELECT f FROM Friendship f WHERE f.status = 'ACCEPTED' " +
           "  AND ((f.requester.id = :currentUserId AND f.receiver.id = p.user.id) " +
           "  OR (f.receiver.id = :currentUserId AND f.requester.id = p.user.id))" +
           "))) " +
           "ORDER BY p.createdAt DESC")
    List<Post> findHomeFeed(@Param("currentUserId") Long currentUserId);
}

