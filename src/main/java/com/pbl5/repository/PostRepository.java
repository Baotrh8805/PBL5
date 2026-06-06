package com.pbl5.repository;

import com.pbl5.model.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {
       List<Post> findAllByOrderByCreatedAtDesc();

       @Query("SELECT DISTINCT p FROM Post p LEFT JOIN FETCH p.user LEFT JOIN FETCH p.processingModerator WHERE p.status = 'PENDING_REVIEW' OR p.moderationStartedAt IS NOT NULL ORDER BY p.createdAt DESC")
       List<Post> findModeratorPosts();

       /** Phân trang cho admin — load user và processingModerator tránh N+1 */
       @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"user", "processingModerator"})
       Page<Post> findAllByOrderByCreatedAtDesc(Pageable pageable);

       @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"user", "processingModerator"})
       List<Post> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

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

       @Query("SELECT DISTINCT p FROM Post p " +
              "LEFT JOIN FETCH p.user " +
              "LEFT JOIN FETCH p.processingModerator " +
              "WHERE p.status <> 'DELETED' " +
              "AND NOT EXISTS (SELECT hp FROM HiddenPost hp WHERE hp.user.id = :currentUserId AND hp.post = p) " +
              "AND (" +
              "  :isAdminOrMod = true " +
              "  OR p.user.id = :currentUserId " +
              "  OR (" +
              "    p.status = 'ACTIVE' AND (" +
              "      p.visibility = 'PUBLIC' " +
              "      OR (p.visibility = 'FRIENDS' AND EXISTS (" +
              "        SELECT f FROM Friendship f WHERE f.status = 'ACCEPTED' " +
              "        AND ((f.requester.id = :currentUserId AND f.receiver.id = p.user.id) " +
              "        OR (f.receiver.id = :currentUserId AND f.requester.id = p.user.id))" +
              "      ))" +
              "    )" +
              "  )" +
              ") " +
              "ORDER BY p.createdAt DESC")
       List<Post> findHomeFeedPaged(
               @Param("currentUserId") Long currentUserId,
               @Param("isAdminOrMod") boolean isAdminOrMod,
               Pageable pageable);

       @Query("SELECT DISTINCT p FROM Post p LEFT JOIN FETCH p.user LEFT JOIN FETCH p.processingModerator WHERE p.status = 'ACTIVE' AND " +
                     "(LOWER(p.content) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
                     " LOWER(p.user.fullName) LIKE LOWER(CONCAT('%', :query, '%'))) " +
                     "ORDER BY p.createdAt DESC")
       List<Post> searchPosts(@Param("query") String query);

       @Query("SELECT p FROM Post p WHERE (p.status = 'REJECTED' OR p.status = 'AUTO_REJECTED') AND p.reviewedAt < :boundary")
       List<Post> findPostsForCleanup(@Param("boundary") java.time.LocalDateTime boundary);
}

