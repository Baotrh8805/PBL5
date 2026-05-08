package com.pbl5.repository;

import com.pbl5.model.HiddenPost;
import com.pbl5.model.Post;
import com.pbl5.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface HiddenPostRepository extends JpaRepository<HiddenPost, Long> {
    List<HiddenPost> findByUserId(Long userId);
    Optional<HiddenPost> findByUserAndPost(User user, Post post);
}
