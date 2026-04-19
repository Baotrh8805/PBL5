package com.pbl5.repository;

import com.pbl5.model.Like;
import com.pbl5.model.Post;
import com.pbl5.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LikeRepository extends JpaRepository<Like, Long> {
    Optional<Like> findByPostAndUser(Post post, User user);
    long countByPostId(Long postId);
}
