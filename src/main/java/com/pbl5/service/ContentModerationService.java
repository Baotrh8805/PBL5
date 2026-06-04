package com.pbl5.service;

import com.pbl5.dto.ModerationResult;
import com.pbl5.enums.PostStatus;
import com.pbl5.model.Post;
import com.pbl5.model.User;
import com.pbl5.repository.PostRepository;
import com.pbl5.repository.UserRepository;
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
    private static final double REVIEW_THRESHOLD = 0.40; // 40-80% → chờ duyệt
    private static final String MODERATION_API_URL = "http://127.0.0.1:5000/api/moderate";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final PostRepository postRepository;
    private final UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Autowired
    private com.pbl5.repository.NotificationRepository notificationRepository;

    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;

    public ContentModerationService(PostRepository postRepository, UserRepository userRepository) {
        this.postRepository = postRepository;
        this.userRepository = userRepository;
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
                    null, null, "(Video:) (Content:)", null, null, 0, 30.0, "0:0.000000;0:0.000000", 0.0, 0.0);
        }

        try {
            // Gọi Python API để chạy 3 mô hình
            Map<String, Object> scores = callModerationAPI(content, imageUrl, videoUrl);

            double nsfwScore = ((Number) scores.getOrDefault("nsfw_score", 0.0)).doubleValue();
            double violenceScore = ((Number) scores.getOrDefault("violence_score", 0.0)).doubleValue();
            double hateSpeechScore = ((Number) scores.getOrDefault("hatespeech_score", 0.0)).doubleValue();
            
            double contentHateScore = scores.containsKey("content_hatespeech_score")
                    ? ((Number) scores.get("content_hatespeech_score")).doubleValue()
                    : 0.0;
            int contentHateLabel = scores.containsKey("content_hatespeech_label")
                    ? ((Number) scores.get("content_hatespeech_label")).intValue()
                    : 0;

            double videoHateScore = scores.containsKey("video_hatespeech_score")
                    ? ((Number) scores.get("video_hatespeech_score")).doubleValue()
                    : 0.0;
            int videoHateLabel = scores.containsKey("video_hatespeech_label")
                    ? ((Number) scores.get("video_hatespeech_label")).intValue()
                    : 0;

            double bestScore = ((Number) scores.getOrDefault("best_score", 0.0)).doubleValue();
            String detectedText = String.valueOf(scores.getOrDefault("detected_text", ""));
            String nsfwBox = normalizeJsonValue(scores.get("nsfw_box"));
            String violenBox = normalizeJsonValue(scores.get("violen_box"));
            String videoHate = scores.get("video_hate_speech") != null
                    ? normalizeJsonValue(scores.get("video_hate_speech"))
                    : "";
            String contentHate = scores.get("content_hate_speech") != null
                    ? normalizeJsonValue(scores.get("content_hate_speech"))
                    : "";

            int chosenLabelInt = Math.max(contentHateLabel, videoHateLabel);
            double chosenHateScore = Math.max(contentHateScore, videoHateScore);

            // Always format speechLabelsStr with content and video hatespeech label and score
            String speechLabelsStr = String.format(java.util.Locale.US, "%d:%.6f;%d:%.6f", 
                    contentHateLabel, contentHateScore, 
                    videoHateLabel, videoHateScore);

            // Luôn lưu cả 2 prefix để frontend bóc tách dễ dàng, tránh lỗi khi trường bị
            // null
            String hateSpeechWord = (String) scores.get("hate_speech_word");
            if (hateSpeechWord == null
                    || (!hateSpeechWord.contains("(Video:)") && !hateSpeechWord.contains("(Content:)"))) {
                hateSpeechWord = "(Video:)" + videoHate + " (Content:)" + contentHate;
            }

            Integer highestScoreFrame = null;
            Integer totalFrames = null;
            Double fps = null;
            if (scores.containsKey("highest_score_frame") && scores.get("highest_score_frame") != null) {
                highestScoreFrame = ((Number) scores.get("highest_score_frame")).intValue();
            }
            if (scores.containsKey("total_frames") && scores.get("total_frames") != null) {
                totalFrames = ((Number) scores.get("total_frames")).intValue();
            }
            if (scores.containsKey("fps") && scores.get("fps") != null) {
                fps = ((Number) scores.get("fps")).doubleValue();
            }

            if ("null".equalsIgnoreCase(detectedText)) {
                detectedText = "";
            }

            // Decide status and bestScore:
            PostStatus status = PostStatus.ACTIVE;
            try {
                PostStatus hateStatus = PostStatus.ACTIVE;
                if (chosenLabelInt == 2) {
                    if (chosenHateScore >= 0.50) {
                        hateStatus = PostStatus.AUTO_REJECTED;
                    } else {
                        hateStatus = PostStatus.PENDING_REVIEW;
                    }
                } else if (chosenLabelInt == 1) {
                    if (chosenHateScore >= 0.50) {
                        hateStatus = PostStatus.PENDING_REVIEW;
                    } else {
                        hateStatus = PostStatus.ACTIVE;
                    }
                }

                double nonHateBest = Math.max(nsfwScore, violenceScore);
                PostStatus nonHateStatus = determinePostStatus(nonHateBest);

                status = getMoreSevereStatus(hateStatus, nonHateStatus);

                if (chosenLabelInt == 0) {
                    bestScore = nonHateBest;
                } else {
                    bestScore = Math.max(nonHateBest, chosenHateScore);
                }

                hateSpeechScore = chosenHateScore;
            } catch (Exception e) {
                logger.error("[MODERATION] Error in custom status determination: ", e);
                if (chosenLabelInt == 0) {
                    bestScore = Math.max(nsfwScore, violenceScore);
                } else {
                    bestScore = Math.max(Math.max(nsfwScore, violenceScore), chosenHateScore);
                }
                status = determinePostStatus(bestScore);
            }

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
                    totalFrames);

            return new ModerationResult(status, bestScore, nsfwScore, violenceScore, hateSpeechScore,
                    violationDetected, detectedText, mediaType, nsfwBox, violenBox, hateSpeechWord,
                    null, highestScoreFrame, totalFrames, fps, speechLabelsStr, contentHateScore, videoHateScore);

        } catch (Exception e) {
            // Nếu có lỗi, cho phép đăng bài (fail-open approach)
            logger.error("[MODERATION] Lỗi kiểm tra nội dung: {}", e.getMessage(), e);
            // Vẫn trả về cấu trúc prefix rỗng để không lỗi UI
            return new ModerationResult(PostStatus.ACTIVE, 0.0, 0.0, 0.0, 0.0, false, "", mediaType,
                    null, null, "(Video:) (Content:)", null, null, 0, 30.0, "0:0.000000;0:0.000000", 0.0, 0.0);
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
                        "[MODERATION] postId={} bị AUTO_REJECTED, bestScore={} => cập nhật trạng thái và cộng điểm vi phạm",
                        postId,
                        String.format("%.4f", moderationResult.getBestScore()));

                post.setReviewedAt(java.time.LocalDateTime.now());

                // Cộng điểm vi phạm tự động khi AI xóa bài
                User author = post.getUser();
                if (author != null) {
                    int currentScore = author.getScore() != null ? author.getScore() : 0;
                    author.setScore(currentScore + 1);
                    userRepository.save(author);

                    // Gửi thông báo hệ thống tự động cho người dùng
                    try {
                        com.pbl5.model.Notification notifEntity = new com.pbl5.model.Notification();
                        notifEntity.setUser(author);
                        notifEntity.setSender(null);
                        notifEntity.setType("POST_REJECTED");
                        notifEntity.setMessage("Bài viết của bạn đã bị gỡ tự động do vi phạm tiêu chuẩn cộng đồng. Bạn bị cộng 1 điểm vi phạm. Bạn có 3 ngày để xem lại bài viết.");
                        notifEntity.setLink("/html/post.html?id=" + post.getId());
                        notifEntity = notificationRepository.save(notifEntity);

                        java.util.Map<String, Object> notification = new java.util.HashMap<>();
                        notification.put("id", notifEntity.getId());
                        notification.put("type", "POST_REJECTED");
                        notification.put("message", notifEntity.getMessage());
                        notification.put("senderId", null);
                        notification.put("senderName", "Hệ thống");
                        notification.put("senderAvatar", null);
                        notification.put("link", notifEntity.getLink());

                        messagingTemplate.convertAndSend("/topic/notifications/" + author.getId(), notification);
                        logger.info("[MODERATION] Gửi thông báo AUTO_REJECTED cho tác giả bài viết ID={}", postId);
                    } catch (Exception notifEx) {
                        logger.error("[MODERATION] Lỗi gửi thông báo: {}", notifEx.getMessage());
                    }
                }
            }

            // Luôn cập nhật tất cả điểm và dữ liệu kiểm duyệt, bất kể trạng thái
            post.setStatus(moderationResult.getStatus());
            post.setBestScore(moderationResult.getBestScore());
            post.setNsfwScore(moderationResult.getNsfwScore());
            post.setViolenceScore(moderationResult.getViolenceScore());
            post.setHateSpeechScore(moderationResult.getHateSpeechScore());
            post.setSpeechLabels(moderationResult.getSpeechLabels());
            post.setHateSpeechContentScore(moderationResult.getHateSpeechContentScore());
            post.setHateSpeechVideoScore(moderationResult.getHateSpeechVideoScore());

            post.setViolationRate(Math.max(0.0, Math.min(100.0, moderationResult.getBestScore() * 100.0)));
            post.setNsfwBox(moderationResult.getNsfwBox());
            post.setViolenBox(moderationResult.getViolenBox());
            post.setHateSpeechWord(moderationResult.getHateSpeechWord());
            post.setDetectedText(moderationResult.getDetectedText());
            post.setHighestScoreFrameIndex(moderationResult.getHighestScoreFrameIndex());
            post.setHighestScoreFrameSecond(moderationResult.getHighestScoreFrameSecond());
            post.setTotalFramesAnalyzed(moderationResult.getTotalFramesAnalyzed());
            post.setFps(moderationResult.getFps());

            postRepository.save(post);
            logger.info(
                    "[MODERATION] Hoàn tất kiểm duyệt nền postId={} status={} bestScore={} nsfw={} violence={} hateSpeech={} speechLabels={} nsfwBox={} violenBox={} hateSpeechWord={} frameSecond={}",
                    postId,
                    post.getStatus(),
                    String.format("%.4f", post.getBestScore()),
                    String.format("%.4f", post.getNsfwScore()),
                    String.format("%.4f", post.getViolenceScore()),
                    String.format("%.4f", post.getHateSpeechScore()),
                    post.getSpeechLabels(),
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

    private PostStatus getMoreSevereStatus(PostStatus status1, PostStatus status2) {
        if (status1 == PostStatus.AUTO_REJECTED || status2 == PostStatus.AUTO_REJECTED) {
            return PostStatus.AUTO_REJECTED;
        }
        if (status1 == PostStatus.PENDING_REVIEW || status2 == PostStatus.PENDING_REVIEW) {
            return PostStatus.PENDING_REVIEW;
        }
        return PostStatus.ACTIVE;
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
