package com.pbl5.service;

import com.pbl5.dto.ModerationResult;
import com.pbl5.enums.PostStatus;
import com.pbl5.model.Post;
import com.pbl5.repository.PostRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Async;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Optional;
import java.util.HashMap;
import java.util.Map;

@Service
public class ContentModerationService {

    private static final Logger logger = LoggerFactory.getLogger(ContentModerationService.class);

    private static final double REJECT_THRESHOLD = 0.80; // > 80% → xóa
    private static final double REVIEW_THRESHOLD = 0.30; // 30-80% → chờ duyệt
    private static final String MODERATION_API_URL = "http://127.0.0.1:5000/api/moderate";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final PostRepository postRepository;

    public ContentModerationService(PostRepository postRepository) {
        this.postRepository = postRepository;
    }

    /**
     * Kiểm tra nội dung bài đăng với 3 mô hình AI
     * 
     * @param content Nội dung bài đăng
     * @return ModerationResult chứa status, scores, và chi tiết
     */
    public ModerationResult moderateContent(String content, String imageUrl, String videoUrl) {
        boolean hasContent = content != null && !content.trim().isEmpty();
        boolean hasImage = imageUrl != null && !imageUrl.trim().isEmpty();
        boolean hasVideo = videoUrl != null && !videoUrl.trim().isEmpty();
        String mediaType = resolveMediaType(hasImage, hasVideo);

        if (!hasContent && !hasImage && !hasVideo) {
            return new ModerationResult(PostStatus.ACTIVE, 0.0, 0.0, 0.0, 0.0, false, "", mediaType,
                    null, null, null, null, 0);
        }

        try {
            // Gọi Python API để chạy 3 mô hình
            Map<String, Object> scores = callModerationAPI(content, imageUrl, videoUrl);

            double nsfwScore = ((Number) scores.getOrDefault("nsfw_score", 0.0)).doubleValue();
            double violenceScore = ((Number) scores.getOrDefault("violence_score", 0.0)).doubleValue();
            double hateSpeechScore = ((Number) scores.getOrDefault("hatespeech_score", 0.0)).doubleValue();
            double bestScore = ((Number) scores.getOrDefault("best_score", 0.0)).doubleValue();
            String detectedText = String.valueOf(scores.getOrDefault("detected_text", ""));
            String nsfwBox = normalizeJsonValue(scores.get("nsfw_box"));
            String violenBox = normalizeJsonValue(scores.get("violen_box"));
            String hateSpeechWord = normalizeJsonValue(scores.get("hate_speech_word"));
            
            Integer highestScoreFrameSecond = null;
            if (scores.containsKey("highest_score_frame_second") && scores.get("highest_score_frame_second") != null) {
                highestScoreFrameSecond = ((Number) scores.get("highest_score_frame_second")).intValue();
            }

            int totalFramesAnalyzed = 0;
            if (scores.containsKey("total_frames_analyzed") && scores.get("total_frames_analyzed") != null) {
                totalFramesAnalyzed = ((Number) scores.get("total_frames_analyzed")).intValue();
            }

            if ("null".equalsIgnoreCase(detectedText)) {
                detectedText = "";
            }

            // Xác định status dựa trên điểm
            PostStatus status = determinePostStatus(bestScore);
            boolean violationDetected = status == PostStatus.PENDING_REVIEW;

            logger.info(
                    "[MODERATION] mediaType={} bestScore={} nsfw={} violence={} hateSpeech={} status={} detectedTextLength={} totalFramesAnalyzed={}",
                    mediaType,
                    String.format("%.4f", bestScore),
                    String.format("%.4f", nsfwScore),
                    String.format("%.4f", violenceScore),
                    String.format("%.4f", hateSpeechScore),
                    status,
                    detectedText == null ? 0 : detectedText.length(),
                    totalFramesAnalyzed);

            return new ModerationResult(status, bestScore, nsfwScore, violenceScore, hateSpeechScore,
                    violationDetected, detectedText, mediaType, nsfwBox, violenBox, hateSpeechWord, highestScoreFrameSecond, totalFramesAnalyzed);

        } catch (Exception e) {
            // Nếu có lỗi, cho phép đăng bài (fail-open approach)
            logger.error("[MODERATION] Lỗi kiểm tra nội dung: {}", e.getMessage(), e);
            return new ModerationResult(PostStatus.ACTIVE, 0.0, 0.0, 0.0, 0.0, false, "", mediaType,
                    null, null, null, null, 0);
        }
    }

    /**
     * Kiểm duyệt nền sau khi bài viết đã được đăng.
     * Nếu vi phạm nặng thì xóa bài, nếu không thì cập nhật điểm và trạng thái kiểm
     * duyệt.
     */
    @Async("moderationExecutor")
    public void moderatePostAsync(long postId, String content, String imageUrl, String videoUrl) {
        try {
            logger.info("[MODERATION] Bắt đầu kiểm duyệt nền cho postId={}", postId);
            ModerationResult moderationResult = moderateContent(content, imageUrl, videoUrl);
            Optional<Post> postOptional = postRepository.findById(postId);
            if (postOptional.isEmpty()) {
                logger.warn("[MODERATION] Không tìm thấy bài viết để cập nhật kết quả kiểm duyệt, postId={}", postId);
                return;
            }

            Post post = postOptional.get();

            if (isAutoRejected(moderationResult.getStatus())) {
                logger.warn(
                        "[MODERATION] postId={} bị AUTO_REJECTED, bestScore={} => cập nhật trạng thái",
                        postId,
                        String.format("%.4f", moderationResult.getBestScore()));
                // We no longer delete the post, so the author can still see it in their feed
                // and know it was rejected. canViewPost handles hiding it from others.
            }

            // Luôn cập nhật tất cả điểm và dữ liệu kiểm duyệt, bất kể trạng thái
            post.setStatus(moderationResult.getStatus());
            post.setBestScore(moderationResult.getBestScore());
            post.setNsfwScore(moderationResult.getNsfwScore());
            post.setViolenceScore(moderationResult.getViolenceScore());
            post.setHateSpeechScore(moderationResult.getHateSpeechScore());

            post.setViolationRate(Math.max(0.0, Math.min(100.0, moderationResult.getBestScore() * 100.0)));
            post.setNsfwBox(moderationResult.getNsfwBox());
            post.setViolenBox(moderationResult.getViolenBox());
            post.setHateSpeechWord(moderationResult.getHateSpeechWord());
            post.setHighestScoreFrameSecond(moderationResult.getHighestScoreFrameSecond());
            post.setTotalFramesAnalyzed(moderationResult.getTotalFramesAnalyzed());

            postRepository.save(post);
            logger.info(
                    "[MODERATION] Hoàn tất kiểm duyệt nền postId={} status={} bestScore={} nsfw={} violence={} hateSpeech={} nsfwBox={} violenBox={} hateSpeechWord={} frameSecond={}",
                    postId,
                    post.getStatus(),
                    String.format("%.4f", post.getBestScore()),
                    String.format("%.4f", post.getNsfwScore()),
                    String.format("%.4f", post.getViolenceScore()),
                    String.format("%.4f", post.getHateSpeechScore()),
                    post.getNsfwBox(),
                    post.getViolenBox(),
                    post.getHateSpeechWord(),
                    post.getHighestScoreFrameSecond());
        } catch (Exception e) {
            logger.error("[MODERATION] Lỗi kiểm duyệt nền bài viết {}: {}", postId, e.getMessage(), e);
        }
    }

    /**
     * Gọi Python Moderation API
     */
    private Map<String, Object> callModerationAPI(String content, String imageUrl, String videoUrl) throws Exception {
        // Tạo request body
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("content", content);
        requestBody.put("imageUrl", imageUrl);
        requestBody.put("videoUrl", videoUrl);

        String jsonBody = objectMapper.writeValueAsString(requestBody);

        // Tạo HTTP request
        HttpRequest request = HttpRequest.newBuilder()
                .uri(new URI(MODERATION_API_URL))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(300))
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        // Gửi request
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new Exception("Moderation API returned status " + response.statusCode());
        }

        // Parse response
        Map<String, Object> result = objectMapper.readValue(response.body(), new TypeReference<Map<String, Object>>() {
        });
        return result;
    }

    /**
     * Xác định status dựa trên điểm cao nhất
     */
    private PostStatus determinePostStatus(double bestScore) {
        if (bestScore > REJECT_THRESHOLD) {
            return PostStatus.AUTO_REJECTED; // > 75% → xóa
        } else if (bestScore >= REVIEW_THRESHOLD) {
            return PostStatus.PENDING_REVIEW; // 30-75% → chờ duyệt
        } else {
            return PostStatus.ACTIVE; // < 30% → cho phép
        }
    }

    /**
     * Kiểm tra xem bài đăng có bị từ chối tự động không
     */
    public boolean isAutoRejected(PostStatus status) {
        return status == PostStatus.AUTO_REJECTED;
    }

    /**
     * Kiểm tra xem bài đăng có đang chờ duyệt không
     */
    public boolean isPendingReview(PostStatus status) {
        return status == PostStatus.PENDING_REVIEW;
    }

    /**
     * Kiểm tra xem bài đăng được phép đăng không
     */
    public boolean isPublished(PostStatus status) {
        return status == PostStatus.PUBLISHED || status == PostStatus.ACTIVE;
    }

    private String resolveMediaType(boolean hasImage, boolean hasVideo) {
        if (hasImage && hasVideo) {
            return "mixed";
        }
        if (hasImage) {
            return "image";
        }
        if (hasVideo) {
            return "video";
        }
        return "text";
    }

    private String normalizeJsonValue(Object value) {
        if (value == null) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return String.valueOf(value);
        }
    }

}
