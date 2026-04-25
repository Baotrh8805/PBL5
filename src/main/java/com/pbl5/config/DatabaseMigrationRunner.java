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
        } catch (Exception e) {
            logger.warn("Could not alter columns to TEXT. They might already be TEXT or table might not exist yet: {}", e.getMessage());
        }
    }
}
