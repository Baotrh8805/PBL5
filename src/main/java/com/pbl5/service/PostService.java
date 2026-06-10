package com.pbl5.service;

import com.pbl5.dto.CreatePostRequest;
import com.pbl5.dto.PostResponse;
import com.pbl5.dto.SharedPostDTO;
import com.pbl5.enums.PostStatus;
import com.pbl5.enums.PostVisibility;
import com.pbl5.model.Post;
import com.pbl5.model.User;
import com.pbl5.repository.CommentRepository;
import com.pbl5.repository.LikeRepository;
import com.pbl5.repository.PostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class PostService {

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private ContentModerationService moderationService;

    @Autowired
    private LikeRepository likeRepository;

    @Autowired
    private CommentRepository commentRepository;

    /**
     * Tạo bài đăng mới với kiểm tra nội dung
     * 
     * @param user    Người đăng bài
     * @param request Dữ liệu bài đăng
     * @return PostResponse nếu thành công hoặc null nếu bị từ chối tự động
     */
    public PostResponse createPost(User user, CreatePostRequest request) {
        if (user.getPostWarningExpiresAt() != null && user.getPostWarningExpiresAt().isAfter(java.time.LocalDateTime.now())) {
            java.time.LocalDateTime now = java.time.LocalDateTime.now();
            long secondsLeft = java.time.temporal.ChronoUnit.SECONDS.between(now, user.getPostWarningExpiresAt());
            long daysLeft = (long) Math.ceil(secondsLeft / 86400.0);
            if (daysLeft < 1) daysLeft = 1;
            throw new IllegalStateException("Lỗi đăng bài do tài khoản bạn bị hạn chế đăng bài trong " + daysLeft + " ngày.");
        }

        boolean hasContent = request.getContent() != null && !request.getContent().trim().isEmpty();
        boolean hasMedia = (request.getImageUrl() != null && !request.getImageUrl().trim().isEmpty())
                || (request.getVideoUrl() != null && !request.getVideoUrl().trim().isEmpty());
        if (!hasContent && !hasMedia && request.getSharedPostId() == null) {
            throw new IllegalArgumentException("Nội dung bài đăng không được trống.");
        }

        // Tạo bài đăng mới
        Post post = new Post();
        post.setContent(request.getContent());
        post.setImageUrl(request.getImageUrl());
        post.setVideoUrl(request.getVideoUrl());
        post.setUser(user);

        if (request.getSharedPostId() != null) {
            Post sharedPost = postRepository.findById(request.getSharedPostId())
                .orElseThrow(() -> new IllegalArgumentException("Bài viết chia sẻ không tồn tại."));
            if (sharedPost.getVisibility() != PostVisibility.PUBLIC) {
                throw new IllegalArgumentException("Chỉ có thể chia sẻ bài viết đang ở chế độ Công khai.");
            }
            post.setSharedPost(sharedPost);
        }

        // Đặt visibility
        if (request.getVisibility() != null) {
            try {
                post.setVisibility(PostVisibility.valueOf(request.getVisibility().toUpperCase()));
            } catch (IllegalArgumentException e) {
                post.setVisibility(PostVisibility.PUBLIC);
            }
        }

        // Đăng ngay, sau đó kiểm duyệt ở background để có thể xóa nếu vi phạm nặng.
        post.setStatus(PostStatus.ACTIVE);
        post.setBestScore(0.0);
        post.setNsfwScore(0.0);
        post.setViolenceScore(0.0);
        post.setHateSpeechScore(0.0);
        post.setNsfwBox(null);
        post.setViolenBox(null);
        post.setHateSpeechWord("(Video:) (Content:)");
        post.setViolationRate(0.0);

        // Lưu bài đăng
        Post savedPost = postRepository.save(post);

        try {
            moderationService.moderatePostAsync(
                    savedPost.getId(),
                    request.getContent(),
                    request.getImageUrl(),
                    request.getVideoUrl());
        } catch (Exception e) {
            // Bài viết đã được lưu; lỗi kiểm duyệt nền không được chặn luồng đăng bài.
            System.err.println(
                    "Không thể khởi chạy kiểm duyệt nền bài viết " + savedPost.getId() + ": " + e.getMessage());
        }

        // Trả về thông tin bài đăng
        return convertToResponse(savedPost, user);
    }

    /**
     * Convert Post entity thành PostResponse
     */
    private PostResponse convertToResponse(Post post, User user) {
        long likeCount = likeRepository.countByPostId(post.getId());
        long commentCount = commentRepository.countByPostId(post.getId());

        String authorName = post.getUser().getFullName() != null ? post.getUser().getFullName() : "Người dùng";
        String authorAvatar = post.getUser().getAvatar() != null ? post.getUser().getAvatar()
                : "https://ui-avatars.com/api/?name=" + authorName.replace(" ", "+") + "&background=00d1b2&color=fff";

        SharedPostDTO sharedPostDTO = null;
        if (post.getSharedPost() != null) {
            Post sp = post.getSharedPost();
            String spAuthorName = sp.getUser().getFullName() != null ? sp.getUser().getFullName() : "Người dùng";
            String spAuthorAvatar = sp.getUser().getAvatar() != null ? sp.getUser().getAvatar()
                    : "https://ui-avatars.com/api/?name=" + spAuthorName.replace(" ", "+") + "&background=00d1b2&color=fff";
            sharedPostDTO = new SharedPostDTO(
                sp.getId(),
                sp.getContent(),
                sp.getImageUrl(),
                sp.getVideoUrl(),
                spAuthorName,
                spAuthorAvatar,
                sp.getCreatedAt(),
                sp.getVisibility() != null ? sp.getVisibility().name() : "PUBLIC",
                sp.getStatus() != null ? sp.getStatus().name() : "ACTIVE"
            );
        }

        long shareCount = postRepository.countBySharedPost_Id(post.getId());

        return new PostResponse(
                post.getId(),
                post.getContent(),
                post.getImageUrl(),
                post.getVideoUrl(),
                post.getCreatedAt(),
                post.getUser().getId(),
                authorName,
                authorAvatar,
                likeCount,
                commentCount,
                false,
                true,
                post.getVisibility() != null ? post.getVisibility().name() : "PUBLIC",
                post.getStatus() != null ? post.getStatus().name() : "ACTIVE",
                sharedPostDTO,
                shareCount);
    }
}
