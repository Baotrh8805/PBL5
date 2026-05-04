// JS for Post Layout interaction

document.addEventListener("DOMContentLoaded", () => {
    // Basic interaction: send comment demo
    const commentInput = document.getElementById("comment-input");
    const sendBtn = document.querySelector(".send-comment-btn");
    const commentsList = document.querySelector(".comments-list");

    const addComment = () => {
        const text = commentInput.value.trim();
        if (text) {
            const newComment = document.createElement("div");
            newComment.className = "comment-item";
            newComment.innerHTML = `
                <img src="/uploads/default-avatar.png" class="avatar-small">
                <div class="comment-bubble">
                    <div class="comment-author">Tôi</div>
                    <div class="comment-text">${text}</div>
                </div>
            `;
            commentsList.appendChild(newComment);
            commentInput.value = "";
            
            // Scroll to bottom of comments
            const contentArea = document.querySelector(".post-interaction-content");
            contentArea.scrollTop = contentArea.scrollHeight;
        }
    };

    if (sendBtn) {
        sendBtn.addEventListener("click", addComment);
    }

    if (commentInput) {
        commentInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") addComment();
        });
    }
});
