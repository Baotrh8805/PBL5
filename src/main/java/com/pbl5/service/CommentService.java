package com.pbl5.service;

import com.pbl5.dto.CommentRequest;
import com.pbl5.dto.CommentResponse;
import com.pbl5.model.Comment;
import com.pbl5.model.CommentLike;
import com.pbl5.model.Post;
import com.pbl5.model.Report;
import com.pbl5.model.User;
import com.pbl5.repository.CommentLikeRepository;
import com.pbl5.repository.CommentRepository;
import com.pbl5.repository.NotificationRepository;
import com.pbl5.repository.PostRepository;
import com.pbl5.repository.ReportRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CommentService {

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private CommentLikeRepository commentLikeRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public List<CommentResponse> getComments(Long postId, User currentUser) {
        List<Comment> allComments = commentRepository.findByPostIdOrderByCreatedAtDesc(postId);
        if (allComments.isEmpty()) return new ArrayList<>();

        List<Long> commentIds = allComments.stream().map(Comment::getId).collect(Collectors.toList());

        Map<Long, Long> likeCountsMap = new HashMap<>();
        for (Object[] result : commentLikeRepository.countLikesByCommentIds(commentIds)) {
            likeCountsMap.put((Long) result[0], (Long) result[1]);
        }

        Set<Long> likedCommentIdsSet = new HashSet<>();
        if (currentUser != null) {
            likedCommentIdsSet.addAll(commentLikeRepository.findLikedCommentIdsByUser(commentIds, currentUser.getId()));
        }

        Map<Long, CommentResponse> responseMap = new HashMap<>();
        List<CommentResponse> topLevelResponses = new ArrayList<>();

        for (Comment c : allComments) {
            String authorName = c.getUser().getFullName() != null ? c.getUser().getFullName() : "Người dùng";
            String authorAvatar = c.getUser().getAvatar() != null ? c.getUser().getAvatar()
                    : "https://ui-avatars.com/api/?name=" + authorName.replace(" ", "+") + "&background=00d1b2&color=fff";
            boolean isMine = currentUser != null && c.getUser().getId().equals(currentUser.getId());

            CommentResponse resp = new CommentResponse(
                    c.getId(), c.getContent(), c.getUser().getId(), authorName, authorAvatar,
                    c.getCreatedAt(), isMine, c.getImageUrl(), c.getVideoUrl());
            resp.setLikeCount(likeCountsMap.getOrDefault(c.getId(), 0L));
            resp.setLiked(likedCommentIdsSet.contains(c.getId()));

            responseMap.put(c.getId(), resp);
        }

        for (Comment c : allComments) {
            CommentResponse resp = responseMap.get(c.getId());
            if (c.getParentComment() == null) {
                topLevelResponses.add(resp);
            } else {
                CommentResponse parentResp = responseMap.get(c.getParentComment().getId());
                if (parentResp != null) {
                    parentResp.getReplies().add(resp);
                } else {
                    topLevelResponses.add(resp);
                }
            }
        }
        return topLevelResponses;
    }

    @Transactional
    public CommentResponse addComment(Long postId, CommentRequest request, User user) throws Exception {
        if (user.getCommentWarningExpiresAt() != null && user.getCommentWarningExpiresAt().isAfter(LocalDateTime.now())) {
            long secondsLeft = java.time.temporal.ChronoUnit.SECONDS.between(LocalDateTime.now(), user.getCommentWarningExpiresAt());
            long daysLeft = (long) Math.ceil(secondsLeft / 86400.0);
            if (daysLeft < 1) daysLeft = 1;
            throw new Exception("Lỗi gửi bình luận do tài khoản bạn bị hạn chế bình luận trong " + daysLeft + " ngày.");
        }

        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty()) throw new Exception("Không tìm thấy bài viết");

        if ((request.getContent() == null || request.getContent().trim().isEmpty()) &&
                (request.getImageUrl() == null || request.getImageUrl().trim().isEmpty()) &&
                (request.getVideoUrl() == null || request.getVideoUrl().trim().isEmpty())) {
            throw new Exception("Bình luận không được để trống.");
        }

        Comment comment = new Comment();
        comment.setContent(request.getContent() != null ? request.getContent().trim() : null);
        comment.setImageUrl(request.getImageUrl());
        comment.setVideoUrl(request.getVideoUrl());
        comment.setPost(postOpt.get());
        comment.setUser(user);

        if (request.getParentId() != null) {
            Optional<Comment> parentOpt = commentRepository.findById(request.getParentId());
            parentOpt.ifPresent(comment::setParentComment);
        }

        comment = commentRepository.save(comment);

        if (!postOpt.get().getUser().getId().equals(user.getId())) {
            sendNotification(postOpt.get().getUser(), user, "COMMENT_POST",
                    user.getFullName() + " đã bình luận về bài viết của bạn.",
                    "/html/home.html#post-" + postOpt.get().getId());
        }

        if (comment.getParentComment() != null && !comment.getParentComment().getUser().getId().equals(user.getId())) {
            sendNotification(comment.getParentComment().getUser(), user, "REPLY_COMMENT",
                    user.getFullName() + " đã trả lời bình luận của bạn.",
                    "/html/home.html#comment-" + comment.getId());
        }

        String authorName = user.getFullName() != null ? user.getFullName() : "Người dùng";
        String authorAvatar = user.getAvatar() != null ? user.getAvatar()
                : "https://ui-avatars.com/api/?name=" + authorName.replace(" ", "+") + "&background=00d1b2&color=fff";

        return new CommentResponse(
                comment.getId(), comment.getContent(), user.getId(), authorName, authorAvatar,
                comment.getCreatedAt(), true, comment.getImageUrl(), comment.getVideoUrl());
    }

    @Transactional
    public void deleteComment(Long commentId, User user) throws Exception {
        Optional<Comment> commentOpt = commentRepository.findById(commentId);
        if (commentOpt.isEmpty()) throw new Exception("Không tìm thấy bình luận");

        Comment comment = commentOpt.get();
        boolean isAuthor = comment.getUser().getId().equals(user.getId());
        boolean isModOrAdmin = user.getRole().name().equals("MODERATOR") || user.getRole().name().equals("ADMIN");

        if (!isAuthor && !isModOrAdmin) {
            throw new Exception("Bạn không có quyền xóa bình luận này");
        }
        commentRepository.delete(comment);
    }

    @Transactional
    public void updateComment(Long commentId, CommentRequest request, User user) throws Exception {
        Optional<Comment> commentOpt = commentRepository.findById(commentId);
        if (commentOpt.isEmpty()) throw new Exception("Không tìm thấy bình luận");

        Comment comment = commentOpt.get();
        if (!comment.getUser().getId().equals(user.getId())) {
            throw new Exception("Bạn không có quyền chỉnh sửa bình luận này");
        }

        if (comment.getCreatedAt().plusMinutes(30).isBefore(LocalDateTime.now())) {
            throw new Exception("Đã quá 30 phút, không thể chỉnh sửa bình luận này nữa");
        }

        if ((request.getContent() == null || request.getContent().trim().isEmpty()) &&
                (request.getImageUrl() == null || request.getImageUrl().trim().isEmpty()) &&
                (request.getVideoUrl() == null || request.getVideoUrl().trim().isEmpty())) {
            throw new Exception("Bình luận không được để trống.");
        }

        comment.setContent(request.getContent() != null ? request.getContent().trim() : null);
        comment.setImageUrl(request.getImageUrl());
        comment.setVideoUrl(request.getVideoUrl());
        commentRepository.save(comment);
    }

    @Transactional
    public Map<String, Object> toggleLikeComment(Long commentId, User user) throws Exception {
        Optional<Comment> commentOpt = commentRepository.findById(commentId);
        if (commentOpt.isEmpty()) throw new Exception("Không tìm thấy bình luận");

        Comment comment = commentOpt.get();
        Optional<CommentLike> existingLike = commentLikeRepository.findByCommentAndUser(comment, user);

        if (existingLike.isPresent()) {
            commentLikeRepository.delete(existingLike.get());
            return Map.of("liked", false, "message", "Đã bỏ thích bình luận");
        } else {
            CommentLike freshLike = new CommentLike();
            freshLike.setComment(comment);
            freshLike.setUser(user);
            commentLikeRepository.save(freshLike);

            if (!comment.getUser().getId().equals(user.getId())) {
                sendNotification(comment.getUser(), user, "LIKE_COMMENT",
                        user.getFullName() + " đã thích bình luận của bạn.",
                        "/html/home.html#comment-" + comment.getId());
            }

            return Map.of("liked", true, "message", "Đã thích bình luận");
        }
    }

    @Transactional
    public void reportComment(Long commentId, String reason, String categoryStr, User user) throws Exception {
        Optional<Comment> commentOpt = commentRepository.findById(commentId);
        if (commentOpt.isEmpty()) throw new Exception("Không tìm thấy bình luận");

        Comment comment = commentOpt.get();
        if (reportRepository.existsByUserAndComment(user, comment)) {
            throw new Exception("Bạn đã báo cáo bình luận này rồi.");
        }

        if (reason == null || reason.trim().isEmpty()) {
            throw new Exception("Lý do báo cáo không được để trống.");
        }

        com.pbl5.enums.ReportCategory category = com.pbl5.enums.ReportCategory.OTHER;
        if (categoryStr != null) {
            try {
                category = com.pbl5.enums.ReportCategory.valueOf(categoryStr.toUpperCase());
            } catch (IllegalArgumentException ignored) {}
        }

        Report report = new Report();
        report.setUser(user);
        report.setComment(comment);
        report.setReason(reason.trim());
        report.setCategory(category);
        reportRepository.save(report);
    }

    private void sendNotification(User recipient, User sender, String type, String message, String link) {
        com.pbl5.model.Notification notifEntity = new com.pbl5.model.Notification();
        notifEntity.setUser(recipient);
        notifEntity.setSender(sender);
        notifEntity.setType(type);
        notifEntity.setMessage(message);
        notifEntity.setLink(link);
        notifEntity = notificationRepository.save(notifEntity);

        Map<String, Object> notification = new HashMap<>();
        notification.put("id", notifEntity.getId());
        notification.put("type", type);
        notification.put("message", message);
        notification.put("senderId", sender.getId());
        notification.put("senderName", sender.getFullName());
        notification.put("senderAvatar", sender.getAvatar());
        notification.put("link", link);

        messagingTemplate.convertAndSend("/topic/notifications/" + recipient.getId(), notification);
    }
}
