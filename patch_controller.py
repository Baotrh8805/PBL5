import sys

with open('src/main/java/com/pbl5/controller/PostController.java', 'r') as f:
    lines = f.readlines()

new_lines = []
in_get_all_posts = False
in_get_user_posts = False

for i, line in enumerate(lines):
    if "private User getAuthenticatedUser" in line:
        # Add canViewPost method right before this
        new_lines.append("""
    private boolean canViewPost(Post p, User currentUser) {
        if (p.getUser().getId().equals(currentUser.getId())) return true;
        if (p.getVisibility() == PostVisibility.PUBLIC || p.getVisibility() == null) return true;
        if (p.getVisibility() == PostVisibility.PRIVATE) return false;
        if (p.getVisibility() == PostVisibility.FRIENDS) {
            return friendshipRepository.findByUsers(currentUser, p.getUser())
                .map(f -> f.getStatus() == FriendshipStatus.ACCEPTED)
                .orElse(false);
        }
        return false;
    }
""")
    if "public ResponseEntity<?> getAllPosts" in line:
        in_get_all_posts = True
    
    if in_get_all_posts and "return ResponseEntity.ok(responses);" in line:
        in_get_all_posts = False
        
    if "public ResponseEntity<?> getUserPosts" in line:
        in_get_user_posts = True
        
    if in_get_user_posts and "return ResponseEntity.ok(responses);" in line:
        in_get_user_posts = False

new_lines.append(line)

with open('src/main/java/com/pbl5/controller/PostController.java', 'w') as f:
    f.writelines(new_lines)
