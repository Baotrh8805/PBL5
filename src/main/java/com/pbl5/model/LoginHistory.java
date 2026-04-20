package com.pbl5.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "login_history")
public class LoginHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private LocalDateTime loginAt;

    @Column(length = 50)
    private String ipAddress;

    @Column(length = 20)
    private String provider;

    @PrePersist
    protected void onCreate() {
        this.loginAt = LocalDateTime.now();
    }

    public LoginHistory() {}

    public LoginHistory(User user, String ipAddress, String provider) {
        this.user = user;
        this.ipAddress = ipAddress;
        this.provider = provider;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public LocalDateTime getLoginAt() { return loginAt; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
}
