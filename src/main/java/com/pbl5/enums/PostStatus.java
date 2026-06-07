package com.pbl5.enums;

public enum PostStatus {
    ACTIVE, // Legacy value in existing DB, equivalent to published
    PUBLISHED, // < 30% - Cho phép đăng ngay
    PENDING_REVIEW, // 30-75% - Chờ duyệt
    AUTO_REJECTED, // > 75% - Xóa bài tự động
    REJECTED, // Bị Moderator từ chối
    DELETED // Người dùng tự xóa (có thể khôi phục trong 1 ngày)
}
