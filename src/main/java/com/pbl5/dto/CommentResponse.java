package com.pbl5.dto;

import java.time.LocalDateTime;

public class CommentResponse {
    private Long id;
    private String content;
    private String authorName;
    private String authorAvatar;
    private LocalDateTime createdAt;
    private boolean isMine;

    public CommentResponse(Long id, String content, String authorName, String authorAvatar, LocalDateTime createdAt, boolean isMine) {
        this.id = id;
        this.content = content;
        this.authorName = authorName;
        this.authorAvatar = authorAvatar;
        this.createdAt = createdAt;
        this.isMine = isMine;
    }

    public Long getId() { return id; }
    public String getContent() { return content; }
    public String getAuthorName() { return authorName; }
    public String getAuthorAvatar() { return authorAvatar; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public boolean isMine() { return isMine; }
}
