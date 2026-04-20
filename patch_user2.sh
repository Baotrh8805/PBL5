cat << 'JAVA_EOF' >> src/main/java/com/pbl5/controller/UserController.java

    @PutMapping("/profile/avatar")
    public ResponseEntity<?> updateAvatar(
            @RequestHeader(value="Authorization", required=false) String authHeader,
            @RequestBody java.util.Map<String, String> request) {
        
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).body("Chưa đăng nhập");
        }
        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token)) return ResponseEntity.status(401).body("Token không hợp lệ");
        
        String email = tokenProvider.getEmailFromJWT(token);
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setAvatar(request.get("avatar"));
            userRepository.save(user);
            return ResponseEntity.ok(java.util.Map.of("message", "Cập nhật ảnh đại diện thành công!", "avatar", user.getAvatar()));
        }
        return ResponseEntity.status(404).body("Không tìm thấy người dùng");
    }

    @PutMapping("/profile/cover")
    public ResponseEntity<?> updateCover(
            @RequestHeader(value="Authorization", required=false) String authHeader,
            @RequestBody java.util.Map<String, String> request) {
        
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).body("Chưa đăng nhập");
        }
        String token = authHeader.substring(7);
        if (!tokenProvider.validateToken(token)) return ResponseEntity.status(401).body("Token không hợp lệ");
        
        String email = tokenProvider.getEmailFromJWT(token);
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setCover(request.get("cover"));
            userRepository.save(user);
            return ResponseEntity.ok(java.util.Map.of("message", "Cập nhật ảnh bìa thành công!", "cover", user.getCover()));
        }
        return ResponseEntity.status(404).body("Không tìm thấy người dùng");
    }
}
JAVA_EOF
sed -i '' 's/^}$//g' src/main/java/com/pbl5/controller/UserController.java
