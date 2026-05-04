package com.pbl5.controller;

import com.pbl5.enums.Provider;
import com.pbl5.enums.Role;
import com.pbl5.enums.UserStatus;
import com.pbl5.model.LoginHistory;
import com.pbl5.model.Post;
import com.pbl5.model.User;
import com.pbl5.repository.LoginHistoryRepository;
import com.pbl5.repository.PostRepository;
import com.pbl5.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Controller dành riêng cho Admin.
 * Tất cả endpoint yêu cầu role ADMIN (đã cấu hình trong SecurityConfig).
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private LoginHistoryRepository loginHistoryRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // ==================== QUẢN LÝ NGƯỜI DÙNG ====================

    /** Lấy danh sách người dùng (không bao gồm kiểm duyệt viên) */
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        List<Map<String, Object>> users = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.USER)
                .map(u -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", u.getId());
                    map.put("email", u.getEmail());
                    map.put("fullName", u.getFullName());
                    map.put("username", u.getUsername());
                    map.put("role", u.getRole());
                    map.put("status", u.getStatus());
                    map.put("provider", u.getProvider());
                    map.put("avatar", u.getAvatar());
                    return map;
                }).collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    /** Lấy thông tin chi tiết một người dùng theo ID */
    @GetMapping("/users/{id}")
    public ResponseEntity<?> getUserById(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) return ResponseEntity.status(404).body("Không tìm thấy người dùng");

        User u = userOpt.get();
        Map<String, Object> map = new HashMap<>();
        map.put("id", u.getId());
        map.put("email", u.getEmail());
        map.put("fullName", u.getFullName());
        map.put("username", u.getUsername());
        map.put("gender", u.getGender());
        map.put("bio", u.getBio());
        map.put("phoneNumber", u.getPhoneNumber());
        map.put("dateOfBirth", u.getDateOfBirth());
        map.put("role", u.getRole());
        map.put("status", u.getStatus());
        map.put("provider", u.getProvider());
        map.put("avatar", u.getAvatar());
        return ResponseEntity.ok(map);
    }

    /** Khoá tài khoản người dùng (đặt status = BANNED) */
    @PutMapping("/users/{id}/ban")
    public ResponseEntity<?> banUser(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) return ResponseEntity.status(404).body("Không tìm thấy người dùng");

        User user = userOpt.get();
        if (user.getRole() == Role.ADMIN) {
            return ResponseEntity.status(403).body("Không thể khoá tài khoản Admin khác");
        }
        user.setStatus(UserStatus.BANNED);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã khoá tài khoản người dùng ID " + id));
    }

    /** Mở khoá tài khoản người dùng (đặt status = ACTIVE) */
    @PutMapping("/users/{id}/unban")
    public ResponseEntity<?> unbanUser(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) return ResponseEntity.status(404).body("Không tìm thấy người dùng");

        User user = userOpt.get();
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã mở khoá tài khoản người dùng ID " + id));
    }

    /** Cảnh báo người dùng (đặt status = WARNING) */
    @PutMapping("/users/{id}/warn")
    public ResponseEntity<?> warnUser(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) return ResponseEntity.status(404).body("Không tìm thấy người dùng");

        User user = userOpt.get();
        user.setStatus(UserStatus.WARNING);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã gửi cảnh báo đến người dùng ID " + id));
    }

    /** Thay đổi role của người dùng (USER / MODERATOR / ADMIN) */
    @PutMapping("/users/{id}/role")
    public ResponseEntity<?> changeRole(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) return ResponseEntity.status(404).body("Không tìm thấy người dùng");

        String roleStr = body.get("role");
        if (roleStr == null) return ResponseEntity.status(400).body("Thiếu trường 'role'");

        Role newRole;
        try {
            newRole = Role.valueOf(roleStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body("Role không hợp lệ. Chỉ chấp nhận: USER, MODERATOR, ADMIN");
        }

        User user = userOpt.get();
        user.setRole(newRole);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã cập nhật role thành " + newRole + " cho người dùng ID " + id));
    }

    /** Xoá tài khoản người dùng */
    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) return ResponseEntity.status(404).body("Không tìm thấy người dùng");

        User user = userOpt.get();
        if (user.getRole() == Role.ADMIN) {
            return ResponseEntity.status(403).body("Không thể xoá tài khoản Admin");
        }
        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Đã xoá tài khoản người dùng ID " + id));
    }

    // ==================== QUẢN LÝ BÀI VIẾT ====================

    /** Lấy danh sách tất cả bài viết */
    @GetMapping("/posts")
    public ResponseEntity<?> getAllPosts() {
        List<Map<String, Object>> posts = postRepository.findAllByOrderByCreatedAtDesc().stream().map(p -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", p.getId());
            map.put("content", p.getContent());
            map.put("imageUrl", p.getImageUrl());
            map.put("visibility", p.getVisibility());
            map.put("createdAt", p.getCreatedAt());
            map.put("likeCount", p.getLikes() != null ? p.getLikes().size() : 0);
            map.put("commentCount", p.getComments() != null ? p.getComments().size() : 0);
            if (p.getUser() != null) {
                Map<String, Object> user = new HashMap<>();
                user.put("id", p.getUser().getId());
                user.put("fullName", p.getUser().getFullName());
                user.put("avatar", p.getUser().getAvatar());
                user.put("email", p.getUser().getEmail());
                map.put("user", user);
            }
            if (p.getComments() != null) {
                List<Map<String, Object>> comments = p.getComments().stream().map(c -> {
                    Map<String, Object> cm = new HashMap<>();
                    cm.put("id", c.getId());
                    cm.put("content", c.getContent());
                    cm.put("createdAt", c.getCreatedAt());
                    if (c.getUser() != null) {
                        Map<String, Object> cu = new HashMap<>();
                        cu.put("id", c.getUser().getId());
                        cu.put("fullName", c.getUser().getFullName());
                        cu.put("avatar", c.getUser().getAvatar());
                        cm.put("user", cu);
                    }
                    return cm;
                }).collect(Collectors.toList());
                map.put("comments", comments);
            }
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(posts);
    }

    /** Xoá bài viết theo ID */
    @DeleteMapping("/posts/{id}")
    public ResponseEntity<?> deletePost(@PathVariable Long id) {
        if (!postRepository.existsById(id)) {
            return ResponseEntity.status(404).body("Không tìm thấy bài viết");
        }
        postRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Đã xoá bài viết ID " + id));
    }

    // ==================== LỊCH SỬ ĐĂNG NHẬP ====================

    /** Lấy lịch sử đăng nhập của một người dùng */
    @GetMapping("/users/{id}/login-history")
    public ResponseEntity<?> getLoginHistory(@PathVariable Long id) {
        if (!userRepository.existsById(id)) {
            return ResponseEntity.status(404).body("Không tìm thấy người dùng");
        }
        List<Map<String, Object>> history = loginHistoryRepository
                .findByUserIdOrderByLoginAtDesc(id)
                .stream().map(h -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", h.getId());
                    map.put("loginAt", h.getLoginAt());
                    map.put("ipAddress", h.getIpAddress());
                    map.put("provider", h.getProvider());
                    return map;
                }).collect(Collectors.toList());
        return ResponseEntity.ok(history);
    }

    // ==================== QUẢN LÝ KIỂM DUYỆT VIÊN ====================

    /** Lấy danh sách tất cả kiểm duyệt viên */
    @GetMapping("/moderators")
    public ResponseEntity<?> getAllModerators() {
        List<Map<String, Object>> moderators = userRepository.findByRole(Role.MODERATOR).stream().map(u -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", u.getId());
            map.put("email", u.getEmail());
            map.put("fullName", u.getFullName());
            map.put("username", u.getUsername());
            map.put("status", u.getStatus());
            map.put("provider", u.getProvider());
            map.put("avatar", u.getAvatar());
            map.put("phoneNumber", u.getPhoneNumber());
            map.put("gender", u.getGender());
            map.put("dateOfBirth", u.getDateOfBirth());
            map.put("bio", u.getBio());
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(moderators);
    }

    /** Lấy thông tin chi tiết một kiểm duyệt viên theo ID */
    @GetMapping("/moderators/{id}")
    public ResponseEntity<?> getModeratorById(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) return ResponseEntity.status(404).body("Không tìm thấy kiểm duyệt viên");
        User u = userOpt.get();
        if (u.getRole() != Role.MODERATOR) return ResponseEntity.status(400).body("Người dùng này không phải kiểm duyệt viên");

        Map<String, Object> map = new HashMap<>();
        map.put("id", u.getId());
        map.put("email", u.getEmail());
        map.put("fullName", u.getFullName());
        map.put("username", u.getUsername());
        map.put("gender", u.getGender());
        map.put("bio", u.getBio());
        map.put("phoneNumber", u.getPhoneNumber());
        map.put("dateOfBirth", u.getDateOfBirth());
        map.put("status", u.getStatus());
        map.put("provider", u.getProvider());
        map.put("avatar", u.getAvatar());
        return ResponseEntity.ok(map);
    }

    /** Tạo tài khoản kiểm duyệt viên mới */
    @PostMapping("/moderators")
    public ResponseEntity<?> createModerator(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String fullName = body.get("fullName");
        String password = body.get("password");
        String username = body.get("username");

        if (email == null || email.isBlank()) return ResponseEntity.status(400).body("Email không được để trống");
        if (fullName == null || fullName.isBlank()) return ResponseEntity.status(400).body("Tên hiển thị không được để trống");
        if (password == null || password.length() < 6) return ResponseEntity.status(400).body("Mật khẩu phải có ít nhất 6 ký tự");

        if (userRepository.existsByEmail(email)) return ResponseEntity.status(409).body("Email đã được sử dụng");
        if (userRepository.existsByFullName(fullName)) return ResponseEntity.status(409).body("Tên hiển thị đã được sử dụng");
        if (username != null && !username.isBlank() && userRepository.existsByUsername(username)) {
            return ResponseEntity.status(409).body("Tên đăng nhập đã được sử dụng");
        }

        User moderator = new User();
        moderator.setEmail(email);
        moderator.setFullName(fullName);
        moderator.setPassword(passwordEncoder.encode(password));
        moderator.setUsername(username != null && !username.isBlank() ? username : null);
        moderator.setRole(Role.MODERATOR);
        moderator.setStatus(UserStatus.ACTIVE);
        moderator.setProvider(Provider.LOCAL);
        userRepository.save(moderator);

        return ResponseEntity.ok(Map.of("message", "Đã tạo tài khoản kiểm duyệt viên thành công"));
    }

    /** Cập nhật thông tin kiểm duyệt viên */
    @PutMapping("/moderators/{id}")
    public ResponseEntity<?> updateModerator(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) return ResponseEntity.status(404).body("Không tìm thấy kiểm duyệt viên");
        User user = userOpt.get();
        if (user.getRole() != Role.MODERATOR) return ResponseEntity.status(400).body("Người dùng này không phải kiểm duyệt viên");

        String email = body.get("email");
        String phoneNumber = body.get("phoneNumber");
        String gender = body.get("gender");
        String dateOfBirth = body.get("dateOfBirth");

        if (email != null && !email.isBlank()) {
            if (!email.equals(user.getEmail()) && userRepository.existsByEmail(email)) {
                return ResponseEntity.status(409).body("Email đã được sử dụng bởi tài khoản khác");
            }
            user.setEmail(email.trim());
        }
        if (phoneNumber != null) {
            String phone = phoneNumber.isBlank() ? null : phoneNumber.trim();
            if (phone != null && !phone.equals(user.getPhoneNumber()) && userRepository.existsByPhoneNumber(phone)) {
                return ResponseEntity.status(409).body("Số điện thoại đã được sử dụng bởi tài khoản khác");
            }
            user.setPhoneNumber(phone);
        }
        if (gender != null) user.setGender(gender.isBlank() ? null : gender.trim());
        if (dateOfBirth != null) {
            user.setDateOfBirth(dateOfBirth.isBlank() ? null : java.time.LocalDate.parse(dateOfBirth));
        }

        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã cập nhật thông tin kiểm duyệt viên ID " + id));
    }

    /** Khoá tài khoản kiểm duyệt viên */
    @PutMapping("/moderators/{id}/lock")
    public ResponseEntity<?> lockModerator(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) return ResponseEntity.status(404).body("Không tìm thấy kiểm duyệt viên");
        User user = userOpt.get();
        if (user.getRole() != Role.MODERATOR) return ResponseEntity.status(400).body("Người dùng này không phải kiểm duyệt viên");
        user.setStatus(UserStatus.BANNED);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã khoá tài khoản kiểm duyệt viên ID " + id));
    }

    /** Kích hoạt lại tài khoản kiểm duyệt viên */
    @PutMapping("/moderators/{id}/activate")
    public ResponseEntity<?> activateModerator(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) return ResponseEntity.status(404).body("Không tìm thấy kiểm duyệt viên");
        User user = userOpt.get();
        if (user.getRole() != Role.MODERATOR) return ResponseEntity.status(400).body("Người dùng này không phải kiểm duyệt viên");
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Đã kích hoạt lại tài khoản kiểm duyệt viên ID " + id));
    }

    /** Xoá tài khoản kiểm duyệt viên */
    @DeleteMapping("/moderators/{id}")
    public ResponseEntity<?> deleteModerator(@PathVariable Long id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) return ResponseEntity.status(404).body("Không tìm thấy kiểm duyệt viên");
        User user = userOpt.get();
        if (user.getRole() != Role.MODERATOR) return ResponseEntity.status(400).body("Người dùng này không phải kiểm duyệt viên");
        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Đã xoá tài khoản kiểm duyệt viên ID " + id));
    }

    // ==================== THỐNG KÊ ====================

    /** Thống kê tổng quan hệ thống */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        long totalUsers = userRepository.count();
        long totalPosts = postRepository.count();
        long bannedUsers = userRepository.findAll().stream()
                .filter(u -> u.getStatus() == UserStatus.BANNED).count();
        long moderators = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.MODERATOR).count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", totalUsers);
        stats.put("totalPosts", totalPosts);
        stats.put("bannedUsers", bannedUsers);
        stats.put("moderators", moderators);
        return ResponseEntity.ok(stats);
    }
}
