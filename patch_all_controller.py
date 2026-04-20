import sys

with open('src/main/java/com/pbl5/controller/PostController.java', 'r') as f:
    lines = f.readlines()

new_lines = []

for line in lines:
    # 1. Imports
    if "import com.pbl5.repository.PostRepository;" in line:
        new_lines.append("import com.pbl5.enums.FriendshipStatus;\nimport com.pbl5.model.Friendship;\nimport com.pbl5.repository.FriendshipRepository;\n")
        new_lines.append(line)
        continue
        
    # 2. Autowired
    if "private PostRepository postRepository;" in line:
        new_lines.append(line)
        new_lines.append("    @Autowired\n    private FriendshipRepository friendshipRepository;\n\n")
        continue
        
    # 3. canViewPost helper
    if "private User getAuthenticatedUser(" in line:
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
        new_lines.append(line)
        continue

    # 4. Update getAllPosts
    if "if (p.getVisibility() == PostVisibility.PUBLIC) {" in line:
        # replace the block with simply canView
        continue
    if "canView = true;" in line or "canView = isMine;" in line or "} else if (p.getVisibility()" in line or "canView = true; // Sẽ update" in line:
        continue
    if "boolean canView = false;" in line:
        continue
    if "boolean isMine = p.getUser().getId().equals(currentUser.getId());" in line:
        new_lines.append("            boolean canView = canViewPost(p, currentUser);\n")
        continue

    # 5. Update getUserPosts
    if "List<Post> posts = postRepository.findByUserIdOrderByCreatedAtDesc(userId);" in line:
        new_lines.append(line)
        continue
    if "responses.add(convertToResponse(p, currentUser));" in line and "getUserPosts" in "".join(new_lines[-10:]):
        new_lines.append("            if (canViewPost(p, currentUser)) {\n")
        new_lines.append("                responses.add(convertToResponse(p, currentUser));\n")
        new_lines.append("            }\n")
        continue

    # 6. Update CommentResponse instantiation issue 1
    if "responses.add(new CommentResponse(" in line:
        new_lines.append(line)
        new_lines.append("                c.getId(),\n")
        new_lines.append("                c.getContent(),\n")
        new_lines.append("                c.getUser().getId(),\n")
        continue
    if "c.getId()," in line or "c.getContent()," in line and "responses.add(new CommentResponse(" in "".join(new_lines[-5:]):
        continue

    # 7. Update CommentResponse instantiation issue 2
    if "CommentResponse response = new CommentResponse(" in line:
        new_lines.append(line)
        new_lines.append("            comment.getId(),\n")
        new_lines.append("            comment.getContent(),\n")
        new_lines.append("            user.getId(),\n")
        continue
    if "comment.getId()," in line or "comment.getContent()," in line and "CommentResponse response = new CommentResponse(" in "".join(new_lines[-5:]):
        continue

    # 8. Update PostResponse instantiation issue
    if "return new PostResponse(" in line:
        new_lines.append(line)
        new_lines.append("            post.getId(),\n")
        new_lines.append("            post.getContent(),\n")
        new_lines.append("            post.getImageUrl(),\n")
        new_lines.append("            post.getCreatedAt(),\n")
        new_lines.append("            post.getUser().getId(),\n")
        continue
    if "post.getId()," in line or "post.getContent()," in line or "post.getImageUrl()," in line or "post.getCreatedAt()," in line and "return new PostResponse(" in "".join(new_lines[-5:]):
        continue
    
    # 9. Fix UI Avatars update issue inside convertToResponse
    if "String authorAvatar = \"https://ui-avatars.com/api/?name=\" + authorName.replace(\" \", \"+\") + \"&background=00d1b2&color=fff\";" in line:
        new_lines.append("        String authorAvatar = post.getUser().getAvatar() != null ? post.getUser().getAvatar() :\n")
        new_lines.append("            \"https://ui-avatars.com/api/?name=\" + authorName.replace(\" \", \"+\") + \"&background=00d1b2&color=fff\";\n")
        continue

    new_lines.append(line)

with open('src/main/java/com/pbl5/controller/PostController.java', 'w') as f:
    f.writelines(new_lines)
