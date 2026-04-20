sed -i '' 's/new CommentResponse(/new CommentResponse(\n                c.getId(),\n                c.getContent(),\n                c.getUser().getId(),/g' src/main/java/com/pbl5/controller/PostController.java

sed -i '' 's/CommentResponse response = new CommentResponse(/CommentResponse response = new CommentResponse(\n            comment.getId(),\n            comment.getContent(),\n            user.getId(),/g' src/main/java/com/pbl5/controller/PostController.java

sed -i '' 's/return new PostResponse(/return new PostResponse(\n            post.getId(),\n            post.getContent(),\n            post.getImageUrl(),\n            post.getCreatedAt(),\n            post.getUser().getId(),/g' src/main/java/com/pbl5/controller/PostController.java

