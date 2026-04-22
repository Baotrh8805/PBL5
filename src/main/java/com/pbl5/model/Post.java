package com.pbl5.model;

import com.pbl5.enums.PostStatus;
import com.pbl5.enums.PostVisibility;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Entity
@Table(name = "posts")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "TEXT")
    private String content;

    private String imageUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(255) default 'PUBLIC'")
    private PostVisibility visibility = PostVisibility.PUBLIC;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(255) default 'ACTIVE'")
    private PostStatus status = PostStatus.ACTIVE;

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

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public PostVisibility getVisibility() { return visibility; }
    public void setVisibility(PostVisibility visibility) { this.visibility = visibility; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    
    public List<Like> getLikes() { 
        return Collections.unmodifiableList(likes); 
    }
    
    public void setLikes(List<Like> likes) { this.likes = likes; }
    
    public List<Comment> getComments() { 
        return Collections.unmodifiableList(comments); 
    }
    
    public void setComments(List<Comment> comments) { this.comments = comments; }

    public PostStatus getStatus() { return status; }
    public void setStatus(PostStatus status) { this.status = status; }

    // ==================== Domain Business Logic Methods ====================

    /** Edit content with state check */
    public void chinhSua(String newContent) {
        if (this.status != PostStatus.ACTIVE) {
            throw new IllegalStateException("Không thể chỉnh sửa bài viết đã bị xoá hoặc khoá.");
        }
        this.content = newContent;
    }

    /** Soft Delete */
    public void xoa() {
        this.status = PostStatus.DELETED;
    }

    /** Block by moderation */
    public void khoaBaiViet() {
        this.status = PostStatus.BLOCKED;
    }
}