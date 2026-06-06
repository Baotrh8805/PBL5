package com.pbl5.service;

import com.pbl5.enums.PostStatus;
import com.pbl5.model.Post;
import com.pbl5.repository.PostRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
public class PostCleanupScheduler {

    private static final Logger logger = LoggerFactory.getLogger(PostCleanupScheduler.class);

    @Autowired
    private PostRepository postRepository;

    // Run every hour to check for posts deleted more than 3 days ago
    @Scheduled(cron = "0 0 * * * *")
    public void cleanupDeletedPosts() {
        logger.info("[CLEANUP] Starting cleanup of deleted/rejected posts older than 3 days...");
        LocalDateTime boundary = LocalDateTime.now().minusDays(3);
        
        List<Post> postsToDelete = postRepository.findPostsForCleanup(boundary);
        int deletedCount = 0;

        for (Post post : postsToDelete) {
            try {
                postRepository.delete(post);
                deletedCount++;
                logger.info("[CLEANUP] Successfully deleted post ID={} (status={}) which was reviewed at {}", 
                        post.getId(), post.getStatus(), post.getReviewedAt());
            } catch (Exception e) {
                logger.error("[CLEANUP] Failed to delete post ID={}: {}", post.getId(), e.getMessage());
            }
        }
        
        logger.info("[CLEANUP] Finished cleanup. Total posts deleted from database: {}", deletedCount);
    }
}
