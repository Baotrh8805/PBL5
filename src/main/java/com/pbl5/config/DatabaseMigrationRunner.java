package com.pbl5.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DatabaseMigrationRunner implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseMigrationRunner.class);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        logger.info("Checking and altering columns to TEXT to prevent DataIntegrityViolationException...");
        try {
            jdbcTemplate.execute("ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;");
            jdbcTemplate.execute("ALTER TABLE posts ALTER COLUMN video_url TYPE TEXT;");
            jdbcTemplate.execute("ALTER TABLE posts ALTER COLUMN image_url TYPE TEXT;");
            jdbcTemplate.execute("ALTER TABLE posts ALTER COLUMN nsfw_box TYPE TEXT;");
            jdbcTemplate.execute("ALTER TABLE posts ALTER COLUMN violen_box TYPE TEXT;");
            jdbcTemplate.execute("ALTER TABLE posts ALTER COLUMN hate_speech_word TYPE TEXT;");
            logger.info("Successfully dropped check constraint and altered columns to TEXT.");

            logger.info("Creating physical indexes to optimize database performance...");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_friendships_requester_receiver ON friendships(user_id, friend_id);");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_friendships_receiver ON friendships(friend_id);");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_messages_receiver_timestamp ON messages(receiver_id, timestamp DESC);");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at DESC);");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);");
            logger.info("Successfully created all optimized indexes.");
        } catch (Exception e) {
            logger.warn("Database migration/optimization warning: {}", e.getMessage());
        }
    }
}
