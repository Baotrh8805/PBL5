document.addEventListener("DOMContentLoaded", () => {
    const statusBadge = document.getElementById("status-badge");
    const pingBtn = document.getElementById("ping-btn");
    const responseText = document.getElementById("server-response");

    // Khi mới tải lên, kiểm tra xem máy chủ có phản hồi không
    statusBadge.className = "badge wait";
    fetch('/api/hello')
        .then(response => {
            if(response.ok) {
                statusBadge.innerText = "Máy chủ Online!";
                statusBadge.className = "badge success";
            }
        })
        .catch(() => {
            statusBadge.innerText = "Chưa kết nối được Server!";
            statusBadge.className = "badge error";
        });

    // Khi người dùng bấm nút Test
    pingBtn.addEventListener("click", () => {
        pingBtn.innerText = "Đang gửi...";
        pingBtn.disabled = true;
        responseText.innerText = "";
        
        const startTime = Date.now();
        
        fetch('/api/hello')
            .then(res => res.json())
            .then(data => {
                const latency = Date.now() - startTime;
                setTimeout(() => {
                    pingBtn.innerText = "Gửi lệnh \"Ping\" lên Server";
                    pingBtn.disabled = false;
                    responseText.innerHTML = `✅ Nhận lại: "${data.message}"<br><small>Độ trễ: ${latency}ms</small>`;
                    responseText.style.color = "#27ae60";
                }, 500); // Thêm độ trễ giả để thấy hiệu ứng
            })
            .catch(error => {
                pingBtn.innerText = "Thử lại";
                pingBtn.disabled = false;
                responseText.innerText = "❌ Lỗi: Không thể nhận dữ liệu từ server!";
                responseText.style.color = "#c0392b";
            });
    });
});
