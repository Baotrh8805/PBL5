package com.pbl5.service;

import com.pbl5.model.Like;
import com.pbl5.model.Post;
import com.pbl5.model.User;
import com.pbl5.repository.LikeRepository;
import com.pbl5.repository.NotificationRepository;
import com.pbl5.repository.PostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class LikeService {

    @Autowired
    private LikeRepository likeRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Transactional
    public String toggleLike(Long postId, User user) throws Exception {
        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty()) throw new Exception("Không tìm thấy bài viết");

        Post post = postOpt.get();
        Optional<Like> existingLike = likeRepository.findByPostAndUser(post, user);

        if (existingLike.isPresent()) {
            likeRepository.delete(existingLike.get());
            return "Đã huỷ like";
        } else {
            Like freshLike = new Like();
            freshLike.setPost(post);
            freshLike.setUser(user);
            likeRepository.save(freshLike);

            if (!post.getUser().getId().equals(user.getId())) {
                sendNotification(post.getUser(), user, "LIKE_POST",
                        user.getFullName() + " đã thích bài viết của bạn.",
                        "/html/home.html#post-" + post.getId());
            }

            return "Đã like";
        }
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
