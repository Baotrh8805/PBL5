package com.pbl5.repository;

import com.pbl5.model.Bookmark;
import com.pbl5.model.Post;
import com.pbl5.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookmarkRepository extends JpaRepository<Bookmark, Long> {

    Optional<Bookmark> findByUserAndPost(User user, Post post);

    boolean existsByUserAndPost(User user, Post post);

    void deleteByUserAndPost(User user, Post post);

    @Query("SELECT b FROM Bookmark b WHERE b.user = :user ORDER BY b.createdAt DESC")
    List<Bookmark> findByUserOrderByCreatedAtDesc(@Param("user") User user);
}
