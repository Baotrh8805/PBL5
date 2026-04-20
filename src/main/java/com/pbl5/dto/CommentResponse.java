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

    public CommentResponse(Long id, String content, Long authorId, String authorName, String authorAvatar, LocalDateTime createdAt, boolean isMine) {
        this.id = id;
        this.content = content;
        this.authorId = authorId;
        this.authorName = authorName;
        this.authorAvatar = authorAvatar;
        this.createdAt = createdAt;
        this.isMine = isMine;
    }

    public Long getId() { return id; }
    public String getContent() { return content; }
    public Long getAuthorId() { return authorId; }
    public String getAuthorName() { return authorName; }
    public String getAuthorAvatar() { return authorAvatar; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public boolean isMine() { return isMine; }
}
