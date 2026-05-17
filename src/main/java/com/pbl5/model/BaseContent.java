package com.pbl5.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Lớp cha trừu tượng (Abstract Base Class) đại diện cho các nội dung do người dùng tạo ra.
 * Định nghĩa các thuộc tính và hành vi chung như ID và ngày tạo để các lớp con (Post, Comment) kế thừa.
 */
@MappedSuperclass
public abstract class BaseContent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime createdAt;

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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
