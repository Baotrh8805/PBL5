package com.pbl5.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user; // The user receiving the notification

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "sender_id")
    private User sender; // The user who triggered the notification

    private String type; // FRIEND_REQUEST, LIKE, COMMENT, etc.
    private String message;
    private String link;
    
    @Column(name = "is_read")
    private boolean isRead = false;
    
    private LocalDateTime createdAt = LocalDateTime.now();

    public Notification() {}

    public Notification(User user, User sender, String type, String message, String link) {
        this.user = user;
        this.sender = sender;
        this.type = type;
        this.message = message;
        this.link = link;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public User getSender() { return sender; }
    public void setSender(User sender) { this.sender = sender; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getLink() { return link; }
    public void setLink(String link) { this.link = link; }
    public boolean isRead() { return isRead; }
    public void setRead(boolean read) { isRead = read; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
