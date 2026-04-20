package com.pbl5.dto;

import java.time.LocalDateTime;

public class PostResponse {
    private Long id;
    private String content;
    private String imageUrl;
    private LocalDateTime createdAt;
    private Long authorId;
    private String authorName;
    private String authorAvatar;
    private long likeCount;
    private long commentCount;
    private boolean isLikedByCurrentUser;
    private boolean isMine;
    private String visibility;

    public PostResponse(Long id, String content, String imageUrl, LocalDateTime createdAt, Long authorId, String authorName, String authorAvatar, long likeCount, long commentCount, boolean isLikedByCurrentUser, boolean isMine, String visibility) {
        this.id = id;
        this.content = content;
        this.imageUrl = imageUrl;
        this.createdAt = createdAt;
        this.authorId = authorId;
        this.authorName = authorName;
        this.authorAvatar = authorAvatar;
        this.likeCount = likeCount;
        this.commentCount = commentCount;
        this.isLikedByCurrentUser = isLikedByCurrentUser;
        this.isMine = isMine;
        this.visibility = visibility;
    }

    public Long getId() { return id; }
    public String getContent() { return content; }
    public String getImageUrl() { return imageUrl; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Long getAuthorId() { return authorId; }
    public String getAuthorName() { return authorName; }
    public String getAuthorAvatar() { return authorAvatar; }
    public long getLikeCount() { return likeCount; }
    public long getCommentCount() { return commentCount; }
    public boolean isLikedByCurrentUser() { return isLikedByCurrentUser; }
    public boolean isMine() { return isMine; }
    public String getVisibility() { return visibility; }
}