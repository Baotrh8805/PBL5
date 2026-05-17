package com.pbl5.service;

import com.pbl5.dto.FriendResponse;
import com.pbl5.enums.FriendshipStatus;
import com.pbl5.model.Friendship;
import com.pbl5.model.Notification;
import com.pbl5.model.User;
import com.pbl5.repository.FriendshipRepository;
import com.pbl5.repository.NotificationRepository;
import com.pbl5.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class FriendshipService {

    @Autowired
    private FriendshipRepository friendshipRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public List<FriendResponse> getSuggestions(User currentUser) {
        List<User> allUsers = userRepository.findAll();
        List<FriendResponse> suggestions = new ArrayList<>();

        for (User u : allUsers) {
            if (u.getId().equals(currentUser.getId())) continue;
            
            // Do not suggest ADMIN or MODERATOR to normal users
            if (currentUser.getRole() == com.pbl5.enums.Role.USER) {
                if (u.getRole() == com.pbl5.enums.Role.ADMIN || u.getRole() == com.pbl5.enums.Role.MODERATOR) {
                    continue;
                }
            }
            
            Optional<Friendship> opt = friendshipRepository.findByUsers(currentUser, u);
            if (opt.isEmpty()) {
                suggestions.add(new FriendResponse(u.getId(), u.getFullName(), u.getAvatar(), "NOT_FRIEND"));
            }
        }
        return suggestions;
    }

    public List<FriendResponse> getRequests(User currentUser) {
        List<Friendship> requests = friendshipRepository.findByReceiverAndStatus(currentUser, FriendshipStatus.PENDING);
        return requests.stream().map(f -> {
            User requester = f.getRequester();
            return new FriendResponse(requester.getId(), requester.getFullName(), requester.getAvatar(), "PENDING_RECEIVED");
        }).collect(Collectors.toList());
    }

    public List<FriendResponse> getFriends(User currentUser) {
        List<Friendship> friends = friendshipRepository.findAllFriends(currentUser, FriendshipStatus.ACCEPTED);
        return friends.stream().map(f -> {
            User friend = f.getRequester().getId().equals(currentUser.getId()) ? f.getReceiver() : f.getRequester();
            return new FriendResponse(friend.getId(), friend.getFullName(), friend.getAvatar(), "ACCEPTED");
        }).collect(Collectors.toList());
    }

    @Transactional
    public void sendRequest(User currentUser, User target) {
        Optional<Friendship> existing = friendshipRepository.findByUsers(currentUser, target);
        if (existing.isPresent()) {
            throw new RuntimeException("Request already sent or are friends");
        }

        Friendship f = new Friendship(currentUser, target, FriendshipStatus.PENDING);
        friendshipRepository.save(f);

        notificationRepository.deleteByUserIdAndSenderIdAndType(target.getId(), currentUser.getId(), "NEW_FRIEND_REQUEST");
        
        Notification notifEntity = new Notification();
        notifEntity.setUser(target);
        notifEntity.setSender(currentUser);
        notifEntity.setType("NEW_FRIEND_REQUEST");
        notifEntity.setMessage(currentUser.getFullName() + " đã gửi cho bạn một lời mời kết bạn.");
        notifEntity.setLink("/html/friends.html");
        notifEntity = notificationRepository.save(notifEntity);

        Map<String, Object> notification = new HashMap<>();
        notification.put("id", notifEntity.getId());
        notification.put("type", "NEW_FRIEND_REQUEST");
        notification.put("message", currentUser.getFullName() + " đã gửi cho bạn một lời mời kết bạn.");
        notification.put("senderId", currentUser.getId());
        notification.put("senderName", currentUser.getFullName());
        notification.put("senderAvatar", currentUser.getAvatar());
        notification.put("link", notifEntity.getLink());
        messagingTemplate.convertAndSend("/topic/notifications/" + target.getId(), notification);
    }

    @Transactional
    public void acceptRequest(User currentUser, User requester) {
        Optional<Friendship> opt = friendshipRepository.findByUsers(requester, currentUser);
        if (opt.isPresent()) {
            Friendship f = opt.get();
            if (f.getReceiver().getId().equals(currentUser.getId()) && f.getStatus() == FriendshipStatus.PENDING) {
                f.setStatus(FriendshipStatus.ACCEPTED);
                friendshipRepository.save(f);

                notificationRepository.deleteByUserIdAndSenderIdAndType(requester.getId(), currentUser.getId(), "FRIEND_REQUEST_ACCEPTED");
                Notification notifEntity = new Notification();
                notifEntity.setUser(requester);
                notifEntity.setSender(currentUser);
                notifEntity.setType("FRIEND_REQUEST_ACCEPTED");
                notifEntity.setMessage(currentUser.getFullName() + " đã chấp nhận lời mời kết bạn của bạn.");
                notifEntity.setLink("/html/friends.html");
                notifEntity = notificationRepository.save(notifEntity);

                Map<String, Object> notification = new HashMap<>();
                notification.put("id", notifEntity.getId());
                notification.put("type", "FRIEND_REQUEST_ACCEPTED");
                notification.put("message", currentUser.getFullName() + " đã chấp nhận lời mời kết bạn của bạn.");
                notification.put("senderId", currentUser.getId());
                notification.put("senderName", currentUser.getFullName());
                notification.put("link", notifEntity.getLink());
                messagingTemplate.convertAndSend("/topic/notifications/" + requester.getId(), notification);
                return;
            }
        }
        throw new RuntimeException("No pending request from this user");
    }

    @Transactional
    public void refuseRequest(User currentUser, User requester) {
        Optional<Friendship> opt = friendshipRepository.findByUsers(requester, currentUser);
        if (opt.isPresent()) {
            Friendship f = opt.get();
            if (f.getReceiver().getId().equals(currentUser.getId()) && f.getStatus() == FriendshipStatus.PENDING) {
                friendshipRepository.delete(f);

                notificationRepository.deleteByUserIdAndSenderIdAndType(requester.getId(), currentUser.getId(), "FRIEND_REQUEST_REFUSED");
                Notification notifEntity = new Notification();
                notifEntity.setUser(requester);
                notifEntity.setSender(currentUser);
                notifEntity.setType("FRIEND_REQUEST_REFUSED");
                notifEntity.setMessage(currentUser.getFullName() + " đã từ chối lời mời kết bạn của bạn.");
                notifEntity.setLink("/html/friends.html");
                notificationRepository.save(notifEntity);

                Map<String, Object> notification = new HashMap<>();
                notification.put("type", "FRIEND_REQUEST_REFUSED");
                notification.put("message", currentUser.getFullName() + " đã từ chối lời mời kết bạn của bạn.");
                notification.put("senderId", currentUser.getId());
                notification.put("senderName", currentUser.getFullName());
                messagingTemplate.convertAndSend("/topic/notifications/" + requester.getId(), notification);
                return;
            }
        }
        throw new RuntimeException("No pending request from this user");
    }

    @Transactional
    public void removeFriend(User currentUser, User target) {
        Optional<Friendship> opt = friendshipRepository.findByUsers(currentUser, target);
        if (opt.isPresent()) {
            friendshipRepository.delete(opt.get());
        } else {
            throw new RuntimeException("No friendship found");
        }
    }
}
