package com.pbl5.repository;

import com.pbl5.enums.ReportStatus;
import com.pbl5.model.Comment;
import com.pbl5.model.Post;
import com.pbl5.model.Report;
import com.pbl5.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ReportRepository extends JpaRepository<Report, Long> {

    List<Report> findAllByOrderByCreatedAtDesc();

    long countByStatus(ReportStatus status);

    /** Chống report trùng: cùng user, cùng bài */
    boolean existsByUserAndPost(User user, Post post);

    /** Chống report trùng: cùng user, cùng comment */
    boolean existsByUserAndComment(User user, Comment comment);

    /** Đếm số report trên 1 bài viết (chỉ PENDING) */
    long countByPostAndStatus(Post post, ReportStatus status);

    /** Đếm số report trên 1 comment (chỉ PENDING) */
    long countByCommentAndStatus(Comment comment, ReportStatus status);

    /** Lấy danh sách report PENDING (cho Moderator) */
    List<Report> findByStatusOrderByCreatedAtDesc(ReportStatus status);

    /** Đếm tổng report PENDING trên 1 bài (mọi status) */
    @Query("SELECT COUNT(r) FROM Report r WHERE r.post.id = :postId AND r.status = 'PENDING'")
    long countPendingByPostId(@Param("postId") Long postId);

    List<Report> findByPost(Post post);

    List<Report> findByComment(Comment comment);
}
