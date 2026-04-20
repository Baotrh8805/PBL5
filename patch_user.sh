sed -i '' '/import com.pbl5.dto.OnboardingRequest;/a\
import com.pbl5.dto.ProfileUpdateRequest;\
' src/main/java/com/pbl5/controller/UserController.java

cat << 'JAVA_EOF' >> src/main/java/com/pbl5/controller/UserController.java

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @RequestHeader(value="Authorization", required=false) String authHeader,
            @RequestBody ProfileUpdateRequest request) {

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).body("Chưa đăng nhập");
        }

        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token)) {
            return ResponseEntity.status(401).body("Token không hợp lệ");
        }

        String email = tokenProvider.getEmailFromJWT(token);
        Optional<User> userOpt = userRepository.findByEmail(email);

        if (userOpt.isPresent()) {
            User user = userOpt.get();
            
            if (request.getFullName() == null || request.getFullName().trim().isEmpty()) {
                return ResponseEntity.status(400).body(java.util.Map.of("message", "Tên hiển thị không được bỏ trống"));
            }

            if (!request.getFullName().equals(user.getFullName()) && userRepository.existsByFullName(request.getFullName())) {
                return ResponseEntity.status(400).body(java.util.Map.of("message", "Tên hiển thị này đã có người sử dụng."));
            }

            if (request.getPhoneNumber() != null && !request.getPhoneNumber().equals(user.getPhoneNumber()) && userRepository.existsByPhoneNumber(request.getPhoneNumber())) {
                return ResponseEntity.status(400).body(java.util.Map.of("message", "Số điện thoại này đã được sử dụng."));
            }
            
            user.setFullName(request.getFullName().trim());
            user.setPhoneNumber(request.getPhoneNumber());
            user.setDateOfBirth(request.getDateOfBirth());
            user.setGender(request.getGender());
            user.setBio(request.getBio());
            user.setRelationshipStatus(request.getRelationshipStatus());

            userRepository.save(user);

            return ResponseEntity.ok(java.util.Map.of("message", "Cập nhật thông tin thành công!"));
        }

        return ResponseEntity.status(404).body("Không tìm thấy người dùng");
    }
JAVA_EOF
sed -i '' 's/^}$//g' src/main/java/com/pbl5/controller/UserController.java
echo "}" >> src/main/java/com/pbl5/controller/UserController.java
