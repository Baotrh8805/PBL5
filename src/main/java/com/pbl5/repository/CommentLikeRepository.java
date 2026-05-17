package com.pbl5.repository;

import com.pbl5.model.Comment;
import com.pbl5.model.CommentLike;
import com.pbl5.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CommentLikeRepository extends JpaRepository<CommentLike, Long> {
    Optional<CommentLike> findByCommentAndUser(Comment comment, User user);
    
    long countByCommentId(Long commentId);

    @Query("SELECT cl.comment.id, COUNT(cl.id) FROM CommentLike cl WHERE cl.comment.id IN :commentIds GROUP BY cl.comment.id")
    List<Object[]> countLikesByCommentIds(@Param("commentIds") List<Long> commentIds);

    @Query("SELECT cl.comment.id FROM CommentLike cl WHERE cl.comment.id IN :commentIds AND cl.user.id = :userId")
    List<Long> findLikedCommentIdsByUser(@Param("commentIds") List<Long> commentIds, @Param("userId") Long userId);
}
