package com.pbl5.dto;

import java.time.LocalDateTime;

public class CommentResponse {
    private Long id;
    private String content;
    private Long authorId;
    private String authorName;
    private String authorAvatar;
    private LocalDateTime createdAt;
    private boolean isMine;
    private String imageUrl;
    private String videoUrl;
    private long likeCount;
    private boolean isLiked;
    private java.util.List<CommentResponse> replies = new java.util.ArrayList<>();

    public CommentResponse(Long id, String content, Long authorId, String authorName, String authorAvatar, 
                           LocalDateTime createdAt, boolean isMine, String imageUrl, String videoUrl) {
        this.id = id;
        this.content = content;
        this.authorId = authorId;
        this.authorName = authorName;
        this.authorAvatar = authorAvatar;
        this.createdAt = createdAt;
        this.isMine = isMine;
        this.imageUrl = imageUrl;
        this.videoUrl = videoUrl;
    }

    public Long getId() { return id; }
    public String getContent() { return content; }
    public Long getAuthorId() { return authorId; }
    public String getAuthorName() { return authorName; }
    public String getAuthorAvatar() { return authorAvatar; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public boolean isMine() { return isMine; }
    public String getImageUrl() { return imageUrl; }
    public String getVideoUrl() { return videoUrl; }
    public long getLikeCount() { return likeCount; }
    public void setLikeCount(long likeCount) { this.likeCount = likeCount; }
    public boolean isLiked() { return isLiked; }
    public void setLiked(boolean isLiked) { this.isLiked = isLiked; }
    public java.util.List<CommentResponse> getReplies() { return replies; }
    public void setReplies(java.util.List<CommentResponse> replies) { this.replies = replies; }
}
