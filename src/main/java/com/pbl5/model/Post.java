package com.pbl5.model;

import com.pbl5.enums.PostVisibility;
import com.pbl5.enums.PostStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "posts")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(columnDefinition = "TEXT")
    private String imageUrl;

    @Column(columnDefinition = "TEXT")
    private String videoUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(255) default 'PUBLIC'")
    private PostVisibility visibility = PostVisibility.PUBLIC;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(255) default 'ACTIVE'")
    private PostStatus status = PostStatus.ACTIVE;

    // Điểm cao nhất từ 3 mô hình (0.0 - 1.0)
    private Double bestScore = 0.0;

    // Điểm từ từng mô hình
    private Double nsfwScore = 0.0;
    private Double violenceScore = 0.0;
    private Double hateSpeechScore = 0.0;

    @Column(columnDefinition = "TEXT")
    private String nsfwBox;

    @Column(columnDefinition = "TEXT")
    private String violenBox;

    @Column(columnDefinition = "TEXT")
    private String hateSpeechWord;

    @Column(name = "highest_score_frame_second")
    private Integer highestScoreFrameSecond;

    @Column(name = "total_frames_analyzed")
    private Integer totalFramesAnalyzed;

    private Double violationRate = 0.0;

    // Thời điểm một moderator bắt đầu xử lý vi phạm của bài viết
    private LocalDateTime moderationStartedAt;

    // Moderator hiện đang phụ trách duyệt vi phạm
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "processing_moderator_id")
    private User processingModerator;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Like> likes = new ArrayList<>();

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Comment> comments = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getVideoUrl() {
        return videoUrl;
    }

    public void setVideoUrl(String videoUrl) {
        this.videoUrl = videoUrl;
    }

    public PostVisibility getVisibility() {
        return visibility;
    }

    public void setVisibility(PostVisibility visibility) {
        this.visibility = visibility;
    }

    public PostStatus getStatus() {
        return status;
    }

    public void setStatus(PostStatus status) {
        this.status = status;
    }

    public Double getBestScore() {
        return bestScore;
    }

    public void setBestScore(Double bestScore) {
        this.bestScore = bestScore;
    }

    public Double getNsfwScore() {
        return nsfwScore;
    }

    public void setNsfwScore(Double nsfwScore) {
        this.nsfwScore = nsfwScore;
    }

    public Double getViolenceScore() {
        return violenceScore;
    }

    public void setViolenceScore(Double violenceScore) {
        this.violenceScore = violenceScore;
    }

    public Double getHateSpeechScore() {
        return hateSpeechScore;
    }

    public void setHateSpeechScore(Double hateSpeechScore) {
        this.hateSpeechScore = hateSpeechScore;
    }

    public String getNsfwBox() {
        return nsfwBox;
    }

    public void setNsfwBox(String nsfwBox) {
        this.nsfwBox = nsfwBox;
    }

    public String getViolenBox() {
        return violenBox;
    }

    public void setViolenBox(String violenBox) {
        this.violenBox = violenBox;
    }

    public String getHateSpeechWord() {
        return hateSpeechWord;
    }

    public void setHateSpeechWord(String hateSpeechWord) {
        this.hateSpeechWord = hateSpeechWord;
    }

    public Integer getHighestScoreFrameSecond() {
        return highestScoreFrameSecond;
    }

    public void setHighestScoreFrameSecond(Integer highestScoreFrameSecond) {
        this.highestScoreFrameSecond = highestScoreFrameSecond;
    }

    public Integer getTotalFramesAnalyzed() {
        return totalFramesAnalyzed;
    }

    public void setTotalFramesAnalyzed(Integer totalFramesAnalyzed) {
        this.totalFramesAnalyzed = totalFramesAnalyzed;
    }

    public Double getViolationRate() {
        return violationRate;
    }

    public void setViolationRate(Double violationRate) {
        this.violationRate = violationRate;
    }

    public LocalDateTime getModerationStartedAt() {
        return moderationStartedAt;
    }

    public void setModerationStartedAt(LocalDateTime moderationStartedAt) {
        this.moderationStartedAt = moderationStartedAt;
    }

    public User getProcessingModerator() {
        return processingModerator;
    }

    public void setProcessingModerator(User processingModerator) {
        this.processingModerator = processingModerator;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public List<Like> getLikes() {
        return likes;
    }

    public void setLikes(List<Like> likes) {
        this.likes = likes;
    }

    public List<Comment> getComments() {
        return comments;
    }

    public void setComments(List<Comment> comments) {
        this.comments = comments;
    }
}