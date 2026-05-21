package com.pbl5.service;

import com.pbl5.dto.OnboardingRequest;
import com.pbl5.dto.ProfileUpdateRequest;
import com.pbl5.model.Friendship;
import com.pbl5.model.User;
import com.pbl5.repository.FriendshipRepository;
import com.pbl5.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FriendshipRepository friendshipRepository;

    public Map<String, Object> getUserProfile(String email) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            Map<String, Object> profile = new HashMap<>();
            profile.put("id", user.getId());
            profile.put("email", user.getEmail());
            profile.put("fullName", user.getFullName());
            profile.put("phoneNumber", user.getPhoneNumber());
            profile.put("dateOfBirth", user.getDateOfBirth());
            profile.put("gender", user.getGender());
            profile.put("bio", user.getBio());
            profile.put("relationshipStatus", user.getRelationshipStatus());
            profile.put("avatar", user.getAvatar() != null ? user.getAvatar() : "");
            profile.put("cover", user.getCover() != null ? user.getCover() : "");
            profile.put("status", user.getStatus());
            profile.put("role", user.getRole());
            return profile;
        }
        throw new RuntimeException("Không tìm thấy người dùng");
    }

    public Map<String, Object> getUserById(Long id, String currentUserEmail) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            Map<String, Object> profile = new HashMap<>();
            profile.put("id", user.getId());
            profile.put("email", user.getEmail());
            profile.put("fullName", user.getFullName());
            profile.put("gender", user.getGender());
            profile.put("bio", user.getBio());
            profile.put("relationshipStatus", user.getRelationshipStatus());
            profile.put("avatar", user.getAvatar() != null ? user.getAvatar() : "");
            profile.put("cover", user.getCover() != null ? user.getCover() : "");

            if (currentUserEmail != null && !currentUserEmail.equals(user.getEmail())) {
                Optional<User> currentUserOpt = userRepository.findByEmail(currentUserEmail);
                if (currentUserOpt.isPresent()) {
                    User currentUser = currentUserOpt.get();
                    
                    // Prevent normal users from viewing Admin/Moderator profiles
                    if (currentUser.getRole() == com.pbl5.enums.Role.USER) {
                        if (user.getRole() == com.pbl5.enums.Role.ADMIN || user.getRole() == com.pbl5.enums.Role.MODERATOR) {
                            throw new RuntimeException("Bạn không thể xem hồ sơ của quản trị viên hoặc kiểm duyệt viên.");
                        }
                    }
                    
                    Optional<Friendship> f = friendshipRepository.findByUsers(currentUser, user);
                    if (f.isPresent()) {
                        Friendship fr = f.get();
                        profile.put("friendshipStatus", fr.getStatus().toString());
                        profile.put("requesterId", fr.getRequester().getId());
                        profile.put("receiverId", fr.getReceiver().getId());
                    } else {
                        profile.put("friendshipStatus", "NONE");
                    }
                }
            }
            return profile;
        }
        throw new RuntimeException("Không tìm thấy người dùng");
    }

    public List<Map<String, Object>> searchUsers(String query, String currentUserEmail) {
        Optional<User> currentUserOpt = userRepository.findByEmail(currentUserEmail);
        if (currentUserOpt.isEmpty()) {
            throw new RuntimeException("Không tìm thấy người dùng");
        }

        List<User> users = userRepository.findByFullNameContainingIgnoreCase(query);
        List<Map<String, Object>> result = new ArrayList<>();
        User currentUser = currentUserOpt.get();
        
        for (User u : users) {
            if (u.getId().equals(currentUser.getId())) continue;
            
            // If current user is a normal USER, do not show ADMIN or MODERATOR in search results
            if (currentUser.getRole() == com.pbl5.enums.Role.USER) {
                if (u.getRole() == com.pbl5.enums.Role.ADMIN || u.getRole() == com.pbl5.enums.Role.MODERATOR) {
                    continue;
                }
            }
            
            Map<String, Object> map = new HashMap<>();
            map.put("id", u.getId());
            map.put("fullName", u.getFullName());
            map.put("avatar", u.getAvatar());
            result.add(map);
        }
        return result;
    }

    @Transactional
    public void updateOnboarding(String email, OnboardingRequest request) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            User user = userOpt.get();

            if (request.getFullName() == null || request.getFullName().trim().isEmpty()) {
                throw new IllegalArgumentException("Tên hiển thị không được bỏ trống");
            }

            if (!request.getFullName().equals(user.getFullName()) && userRepository.existsByFullName(request.getFullName())) {
                throw new IllegalArgumentException("Tên hiển thị này đã có người sử dụng. Vui lòng chọn tên khác.");
            }

            if (request.getPhoneNumber() != null && !request.getPhoneNumber().equals(user.getPhoneNumber()) && userRepository.existsByPhoneNumber(request.getPhoneNumber())) {
                throw new IllegalArgumentException("Số điện thoại này đã được sử dụng. Vui lòng nhập số khác.");
            }

            user.setFullName(request.getFullName().trim());
            user.setPhoneNumber(request.getPhoneNumber());
            user.setDateOfBirth(request.getDateOfBirth());
            user.setGender(request.getGender());

            userRepository.save(user);
        } else {
            throw new RuntimeException("Không tìm thấy người dùng");
        }
    }

    @Transactional
    public void updateProfile(String email, ProfileUpdateRequest request) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            User user = userOpt.get();

            if (request.getFullName() == null || request.getFullName().trim().isEmpty()) {
                throw new IllegalArgumentException("Tên hiển thị không được bỏ trống");
            }

            if (!request.getFullName().equals(user.getFullName()) && userRepository.existsByFullName(request.getFullName())) {
                throw new IllegalArgumentException("Tên hiển thị này đã có người sử dụng.");
            }

            if (request.getPhoneNumber() != null && !request.getPhoneNumber().equals(user.getPhoneNumber()) && userRepository.existsByPhoneNumber(request.getPhoneNumber())) {
                throw new IllegalArgumentException("Số điện thoại này đã được sử dụng.");
            }

            user.setFullName(request.getFullName().trim());
            user.setPhoneNumber(request.getPhoneNumber());
            user.setDateOfBirth(request.getDateOfBirth());
            user.setGender(request.getGender());
            user.setBio(request.getBio());
            user.setRelationshipStatus(request.getRelationshipStatus());

            userRepository.save(user);
        } else {
            throw new RuntimeException("Không tìm thấy người dùng");
        }
    }

    @Transactional
    public String updateAvatar(String email, String avatarUrl) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setAvatar(avatarUrl);
            userRepository.save(user);
            return user.getAvatar();
        }
        throw new RuntimeException("Không tìm thấy người dùng");
    }

    @Transactional
    public String updateCover(String email, String coverUrl) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setCover(coverUrl);
            userRepository.save(user);
            return user.getCover();
        }
        throw new RuntimeException("Không tìm thấy người dùng");
    }
}
