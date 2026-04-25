package com.pbl5.dto;

public class FriendResponse {
    private Long id;
    private String fullName;
    private String avatar;
    private String status; // ACCEPTED, PENDING_RECEIVED, PENDING_SENT, NOT_FRIEND

    public FriendResponse(Long id, String fullName, String avatar, String status) {
        this.id = id;
        this.fullName = fullName;
        this.avatar = avatar;
        this.status = status;
    }

    public Long getId() { return id; }
    public String getFullName() { return fullName; }
    public String getAvatar() { return avatar; }
    public String getStatus() { return status; }
}
