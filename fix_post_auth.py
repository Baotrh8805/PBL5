import sys

with open('src/main/java/com/pbl5/controller/PostController.java', 'r') as f:
    text = f.read()

# 1. Imports
text = text.replace('import com.pbl5.repository.PostRepository;', 'import com.pbl5.enums.FriendshipStatus;\nimport com.pbl5.model.Friendship;\nimport com.pbl5.repository.FriendshipRepository;\nimport com.pbl5.repository.PostRepository;')

# 2. Autowired
text = text.replace('    private PostRepository postRepository;', '    private PostRepository postRepository;\n\n    @Autowired\n    private FriendshipRepository friendshipRepository;')

# 3. getAuthenticatedUser
canViewPost = """
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

    private User getAuthenticatedUser"""
text = text.replace('    private User getAuthenticatedUser', canViewPost)

# 4. Update getAllPosts loop
old_loop_1 = """            // Kiểm tra quyền xem bài viết
            boolean canView = false;
            boolean isMine = p.getUser().getId().equals(currentUser.getId());
            
            if (p.getVisibility() == PostVisibility.PUBLIC) {
                canView = true;
            } else if (p.getVisibility() == PostVisibility.PRIVATE) {
                canView = isMine;
            } else if (p.getVisibility() == PostVisibility.FRIENDS) {
                // TODO: Logic kiểm tra bạn bè ở đây, hiện tại coi như xem được hoặc chỉ cho phép nếu isMine
                canView = true; // Sẽ update sau khi có bảng Friend
            }

            if (canView) {"""
new_loop_1 = """            if (canViewPost(p, currentUser)) {"""
text = text.replace(old_loop_1, new_loop_1)

# 5. Update getUserPosts loop
old_loop_2 = """        for (Post p : posts) {
            responses.add(convertToResponse(p, currentUser));
        }"""
new_loop_2 = """        for (Post p : posts) {
            if (canViewPost(p, currentUser)) {
                responses.add(convertToResponse(p, currentUser));
            }
        }"""
text = text.replace(old_loop_2, new_loop_2)

# 6. CommentResponse 1
text = text.replace("""            responses.add(new CommentResponse(
                c.getId(),
                c.getContent(),
                authorName,
                authorAvatar,""", """            responses.add(new CommentResponse(
                c.getId(),
                c.getContent(),
                c.getUser().getId(),
                authorName,
                authorAvatar,""")

# 7. CommentResponse 2
text = text.replace("""        CommentResponse response = new CommentResponse(
            comment.getId(),
            comment.getContent(),
            authorName,
            authorAvatar,""", """        CommentResponse response = new CommentResponse(
            comment.getId(),
            comment.getContent(),
            user.getId(),
            authorName,
            authorAvatar,""")

# 8. PostResponse
text = text.replace("""        return new PostResponse(
            post.getId(),
            post.getContent(),
            post.getImageUrl(),
            post.getCreatedAt(),
            authorName,
            authorAvatar,""", """        return new PostResponse(
            post.getId(),
            post.getContent(),
            post.getImageUrl(),
            post.getCreatedAt(),
            post.getUser().getId(),
            authorName,
            authorAvatar,""")

# 9. Avatar
text = text.replace('String authorAvatar = "https://ui-avatars.com/api/?name=" + authorName.replace(" ", "+") + "&background=00d1b2&color=fff";', 'String authorAvatar = post.getUser().getAvatar() != null ? post.getUser().getAvatar() : \n            "https://ui-avatars.com/api/?name=" + authorName.replace(" ", "+") + "&background=00d1b2&color=fff";')

with open('src/main/java/com/pbl5/controller/PostController.java', 'w') as f:
    f.write(text)
