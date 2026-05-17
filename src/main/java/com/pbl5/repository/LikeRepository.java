package com.pbl5.repository;

import com.pbl5.model.Like;
import com.pbl5.model.Post;
import com.pbl5.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

@Repository
public interface LikeRepository extends JpaRepository<Like, Long> {
    Optional<Like> findByPostAndUser(Post post, User user);
    long countByPostId(Long postId);

    @Query("SELECT l.post.id, COUNT(l) FROM Like l WHERE l.post.id IN :postIds GROUP BY l.post.id")
    List<Object[]> countLikesByPostIds(@Param("postIds") List<Long> postIds);

    @Query("SELECT l.post.id FROM Like l WHERE l.post.id IN :postIds AND l.user.id = :userId")
    List<Long> findLikedPostIdsByUser(@Param("postIds") List<Long> postIds, @Param("userId") Long userId);
}
