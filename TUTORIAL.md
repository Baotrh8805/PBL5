# Tutorial hiểu dự án PBL5 — LC Network

## Mục lục
1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Cơ sở dữ liệu](#4-cơ-sở-dữ-liệu)
5. [Luồng xác thực (Auth)](#5-luồng-xác-thực-auth)
6. [Bài viết & Kiểm duyệt AI](#6-bài-viết--kiểm-duyệt-ai)
7. [Kết bạn](#7-kết-bạn)
8. [Chat realtime](#8-chat-realtime)
9. [Thông báo realtime](#9-thông-báo-realtime)
10. [Phân quyền (Role)](#10-phân-quyền-role)
11. [Toàn bộ API Endpoints](#11-toàn-bộ-api-endpoints)
12. [Cách chạy dự án](#12-cách-chạy-dự-án)

---

## 1. Tổng quan dự án

**LC Network** là mạng xã hội với các tính năng:
- Đăng ký / đăng nhập (Email + Google OAuth2)
- Đăng bài viết (text, ảnh, video)
- Kết bạn, chat realtime
- Thông báo realtime
- Kiểm duyệt nội dung tự động bằng AI (NSFW, bạo lực, ngôn từ thù ghét)
- Hệ thống Admin và Moderator quản lý nội dung

---

## 2. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────┐
│                  FRONTEND                        │
│  HTML/CSS/JS tĩnh (trong /resources/static/)    │
│  - index.html    → Trang đăng nhập/đăng ký      │
│  - home.html     → Feed bài viết                │
│  - profile.html  → Trang cá nhân                │
│  - friends.html  → Quản lý bạn bè               │
│  - admin.html    → Trang quản trị Admin          │
└────────────────┬────────────────────────────────┘
                 │ HTTP REST API + WebSocket
┌────────────────▼────────────────────────────────┐
│           SPRING BOOT BACKEND (port 8080)        │
│                                                  │
│  Controller → Service → Repository → Database   │
│                                                  │
│  Security: JWT + Spring Security + OAuth2        │
│  WebSocket: STOMP over SockJS                    │
└──────┬─────────────────────────┬────────────────┘
       │                         │
┌──────▼──────┐         ┌────────▼────────┐
│  PostgreSQL  │         │  Flask AI       │
│  (Supabase  │         │  (port 5000)    │
│   Cloud DB) │         │  - NSFW model   │
└─────────────┘         │  - Violence     │
                        │  - Hate speech  │
                        │  - OCR (VietOCR)│
                        └─────────────────┘
```

**Công nghệ sử dụng:**

| Thành phần | Công nghệ |
|---|---|
| Backend | Spring Boot 3.2.5, Java 17 |
| Database | PostgreSQL (Supabase cloud) |
| Xác thực | JWT (HS512) + OAuth2 Google |
| Lưu ảnh | Cloudinary |
| Email | Gmail SMTP |
| Realtime | WebSocket (STOMP + SockJS) |
| AI Moderation | Python Flask, PyTorch, PhoBERT |
| Build | Maven |

---

## 3. Cấu trúc thư mục

```
src/main/
├── java/com/pbl5/
│   ├── Application.java          ← Điểm khởi động Spring Boot
│   ├── config/
│   │   ├── SecurityConfig.java   ← Cấu hình bảo mật, phân quyền
│   │   ├── WebSocketConfig.java  ← Cấu hình WebSocket/STOMP
│   │   ├── CloudinaryConfig.java ← Cấu hình lưu ảnh Cloudinary
│   │   ├── ModerationApiLauncher.java ← Tự khởi động Flask AI
│   │   └── AsyncConfig.java      ← Cấu hình thread pool async
│   ├── controller/               ← Nhận HTTP request, trả response
│   ├── service/                  ← Logic nghiệp vụ
│   ├── repository/               ← Truy vấn database (JPA)
│   ├── model/                    ← Entity (ánh xạ bảng DB)
│   ├── dto/                      ← Data Transfer Object (request/response)
│   ├── enums/                    ← Các kiểu enum
│   └── security/                 ← JWT filter, UserDetails, OAuth2
├── model/                        ← Python AI
│   ├── moderate.py               ← Flask API kiểm duyệt
│   ├── requirements.txt          ← Thư viện Python
│   ├── best_NSFW.pt              ← Model NSFW
│   ├── best_violence.pth         ← Model bạo lực
│   └── phobert_hatespeech_best.pt← Model ngôn từ thù ghét
└── resources/
    ├── application.properties    ← Cấu hình ứng dụng
    └── static/                   ← Frontend
        ├── index.html
        ├── html/
        └── js/, css/
```

---

## 4. Cơ sở dữ liệu

### Các bảng chính

```
users
├── id, email, full_name, password (BCrypt)
├── username, gender, bio, phone_number, date_of_birth
├── avatar, cover (URL Cloudinary)
├── provider (LOCAL | GOOGLE)
├── status (INACTIVE | ACTIVE | WARNING | BANNED)
├── role (USER | MODERATOR | ADMIN)
└── verification_code, reset_password_token

posts
├── id, content, image_url, video_url
├── visibility (PUBLIC | FRIENDS | PRIVATE)
├── status (ACTIVE | PENDING_REVIEW | AUTO_REJECTED)
├── best_score, nsfw_score, violence_score, hate_speech_score
├── violation_rate, nsfw_box, violen_box, hate_speech_word
├── created_at
└── user_id (FK → users)

friendships
├── id
├── requester_id (FK → users)
├── receiver_id (FK → users)
└── status (PENDING | ACCEPTED | DECLINED)

messages
├── id, content
├── sender_id, receiver_id (FK → users)
├── sent_at, is_read

notifications
├── id, type (LIKE_POST | COMMENT_POST | NEW_FRIEND_REQUEST | FRIEND_REQUEST_ACCEPTED)
├── message, is_read, created_at
├── user_id (người nhận)
└── actor_id (người thực hiện)

likes        → post_id + user_id
comments     → id, content, post_id, user_id, created_at
login_history → id, user_id, ip_address, provider, login_at
```

---

## 5. Luồng xác thực (Auth)

### Đăng ký

```
Client gửi POST /api/auth/register
    { username, email, password, fullName, gender, phone, dateOfBirth }
         │
         ▼
AuthService.register()
    1. Kiểm tra trùng: email, username, phone, fullName
    2. Mã hóa password bằng BCrypt
    3. Tạo OTP 6 số → lưu RAM (hết hạn sau 60 giây)
    4. Tạo User với status = INACTIVE
    5. Gửi email chứa mã OTP
         │
         ▼
Client nhập OTP → POST /api/auth/verify?email=...&code=...
    → Đúng: user.status = ACTIVE → cho đăng nhập
    → Sai/hết hạn: báo lỗi
```

### Đăng nhập

```
Client gửi POST /api/auth/login { email, password }
         │
         ▼
AuthService.login()
    1. Tìm user theo email hoặc username
    2. So sánh password với BCrypt
    3. Kiểm tra status:
       - INACTIVE → "Chưa kích hoạt"
       - BANNED   → "Tài khoản đã bị khóa"
       - WARNING/ACTIVE → cho qua
    4. Lưu LoginHistory (ip, thời gian)
    5. Tạo JWT token (HS512, 1 ngày hoặc 30 ngày nếu rememberMe)
         │
         ▼
Client nhận { token, role }
    → Lưu token vào localStorage
    → Redirect theo role:
       ADMIN     → /html/admin.html
       MODERATOR → /html/moderator.html
       USER      → /html/home.html
```

### Mỗi request sau đó

```
Request kèm header: Authorization: Bearer <token>
         │
         ▼
JwtAuthenticationFilter
    1. Đọc token → validate (chữ ký, hết hạn)
    2. Lấy email từ token → load UserDetails từ DB
    3. Kiểm tra status = BANNED → trả 401 ngay (đăng xuất realtime)
    4. Set Authentication vào SecurityContext
         │
         ▼
Controller xử lý request bình thường
```

### Google OAuth2

```
Client click "Đăng nhập với Google"
    → Redirect sang Google
    → Google callback → /login/oauth2/code/google
    → OAuth2AuthenticationSuccessHandler
        - Tìm user theo email
        - Nếu chưa có → tạo mới với provider = GOOGLE, status = ACTIVE
        - Tạo JWT token
        - Redirect → /?oauth_token=<token>
```

---

## 6. Bài viết & Kiểm duyệt AI

### Tạo bài viết

```
POST /api/posts { content, imageUrl, videoUrl, visibility }
         │
         ▼
PostService.createPost()
    1. Tạo Post với status = ACTIVE (hiển thị ngay)
    2. Lưu DB
    3. Gọi moderatePostAsync() → chạy BACKGROUND (không chặn user)
         │
         ▼ (background thread)
ContentModerationService.moderatePostAsync()
    → Gọi HTTP POST http://127.0.0.1:5000/api/moderate
         │
         ▼
Flask Python (moderate.py) phân tích:
    ┌─ TEXT: PhoBERT NER → phát hiện từ thù ghét (B-T, I-T tags)
    ├─ IMAGE:
    │    ├─ EasyOCR + VietOCR → đọc chữ trong ảnh → đưa vào PhoBERT
    │    ├─ NSFW CNN model → nhận diện nội dung khiêu dâm
    │    └─ Violence CNN+GRU → nhận diện bạo lực
    └─ VIDEO (1 frame/giây):
         ├─ OCR từng frame
         ├─ NSFW từng frame
         └─ Violence từng frame → lấy frame điểm cao nhất
         │
         ▼
Trả về scores: nsfw, violence, hatespeech, best_score
         │
         ▼
Java xác định status:
    best_score > 80%  → AUTO_REJECTED  (ẩn khỏi feed mọi người)
    30% ≤ score ≤ 80% → PENDING_REVIEW (chờ Moderator duyệt tay)
    score < 30%       → ACTIVE         (hiển thị bình thường)
```

### Quyền xem bài viết

| visibility | Ai xem được |
|---|---|
| PUBLIC | Tất cả (kể cả chưa đăng nhập) |
| FRIENDS | Chỉ bạn bè + chính chủ |
| PRIVATE | Chỉ chính chủ |

Bài `AUTO_REJECTED` → chỉ chính chủ thấy (biết bị từ chối), người khác không thấy.

---

## 7. Kết bạn

```
Trạng thái Friendship: PENDING → ACCEPTED

Gửi lời mời:  POST /api/friends/request/{userId}
    → Tạo Friendship(requester=tôi, receiver=bạn, status=PENDING)
    → Gửi WebSocket notification cho bạn

Chấp nhận:    POST /api/friends/accept/{userId}
    → status = ACCEPTED
    → Gửi WebSocket notification cho người gửi

Xóa bạn:      DELETE /api/friends/{userId}
    → Xóa record Friendship

Danh sách bạn:   GET /api/friends/
Lời mời nhận:    GET /api/friends/requests
Gợi ý kết bạn:  GET /api/friends/suggestions
```

---

## 8. Chat realtime

Chat dùng **WebSocket + STOMP protocol**:

```
Client kết nối:
    SockJS → /ws → STOMP handshake

Gửi tin nhắn:
    Client SEND → /app/chat
        { receiverId, content }
         │
         ▼
    ChatController.sendMessage()
        1. Lưu Message vào DB
        2. Push tới người nhận: /user/{receiverId}/queue/messages
        3. Push lại người gửi: /user/{senderId}/queue/messages

Nhận tin nhắn:
    Client subscribe /user/queue/messages
    → Nhận message realtime khi có người gửi
```

Lịch sử chat:
```
GET /api/messages/{userId}       → Lấy toàn bộ tin nhắn với 1 người
GET /api/messages/conversations  → Danh sách cuộc trò chuyện gần nhất
```

---

## 9. Thông báo realtime

```
Các sự kiện tạo thông báo:
    - Like bài viết        → LIKE_POST
    - Comment bài viết     → COMMENT_POST
    - Gửi lời mời kết bạn  → NEW_FRIEND_REQUEST
    - Chấp nhận kết bạn    → FRIEND_REQUEST_ACCEPTED

Khi sự kiện xảy ra:
    1. Lưu Notification vào DB
    2. Push WebSocket tới người nhận:
       /user/{userId}/queue/notifications

Client subscribe:
    /user/queue/notifications
    → Hiện badge số thông báo chưa đọc realtime

API:
    GET  /api/notifications          → Lấy tất cả
    GET  /api/notifications/unread-count → Số chưa đọc
    POST /api/notifications/{id}/read    → Đánh dấu đã đọc
    POST /api/notifications/read-all     → Đọc tất cả
```

---

## 10. Phân quyền (Role)

| Role | Quyền |
|---|---|
| **USER** | Đăng bài, like, comment, kết bạn, chat |
| **MODERATOR** | Xem/xóa bài vi phạm, cảnh báo/ban user |
| **ADMIN** | Tất cả quyền Moderator + quản lý Moderator, xem thống kê, xóa tài khoản |

### Trạng thái tài khoản (UserStatus)

| Status | Ý nghĩa |
|---|---|
| INACTIVE | Chưa xác thực email, chưa đăng nhập được |
| ACTIVE | Bình thường |
| WARNING | Đã bị cảnh báo, vẫn đăng nhập được |
| BANNED | Bị khóa — bị đăng xuất ngay lập tức, không đăng nhập lại được |

### Trạng thái bài viết (PostStatus)

| Status | Điểm AI | Ý nghĩa |
|---|---|---|
| ACTIVE | < 30% | Hiển thị bình thường |
| PENDING_REVIEW | 30–80% | Chờ Moderator duyệt |
| AUTO_REJECTED | > 80% | Tự động ẩn |

---

## 11. Toàn bộ API Endpoints

### Auth — `/api/auth`
| Method | URL | Mô tả |
|---|---|---|
| POST | `/register` | Đăng ký tài khoản |
| POST | `/login` | Đăng nhập → trả JWT |
| GET | `/verify` | Xác thực email bằng OTP |
| POST | `/resend-pin` | Gửi lại mã OTP |
| POST | `/forgot-password` | Yêu cầu đặt lại mật khẩu |
| POST | `/reset-password` | Đặt mật khẩu mới |

### User — `/api/users`
| Method | URL | Mô tả |
|---|---|---|
| GET | `/profile` | Profile của mình |
| GET | `/{id}` | Profile người khác |
| GET | `/search?q=` | Tìm kiếm user |
| PUT | `/onboarding` | Cập nhật thông tin lần đầu |
| PUT | `/profile` | Cập nhật profile |
| PUT | `/profile/avatar` | Đổi avatar |
| PUT | `/profile/cover` | Đổi ảnh bìa |

### Post — `/api/posts`
| Method | URL | Mô tả |
|---|---|---|
| POST | `/` | Tạo bài viết |
| GET | `/` | Feed bài viết |
| GET | `/me` | Bài của tôi |
| GET | `/user/{userId}` | Bài của người khác |
| DELETE | `/{postId}` | Xóa bài |
| PATCH | `/{postId}/visibility` | Đổi quyền xem |
| POST | `/{postId}/like` | Like / Unlike |
| GET | `/{postId}/comments` | Lấy comments |
| POST | `/{postId}/comments` | Thêm comment |

### Friends — `/api/friends`
| Method | URL | Mô tả |
|---|---|---|
| GET | `/` | Danh sách bạn bè |
| GET | `/requests` | Lời mời đang chờ |
| GET | `/suggestions` | Gợi ý kết bạn |
| POST | `/request/{userId}` | Gửi lời mời |
| POST | `/accept/{userId}` | Chấp nhận lời mời |
| DELETE | `/{userId}` | Xóa bạn / hủy lời mời |

### Messages — `/api/messages`
| Method | URL | Mô tả |
|---|---|---|
| GET | `/{userId}` | Lịch sử chat với 1 người |
| GET | `/conversations` | Danh sách cuộc trò chuyện |

### Notifications — `/api/notifications`
| Method | URL | Mô tả |
|---|---|---|
| GET | `/` | Tất cả thông báo |
| GET | `/unread-count` | Số chưa đọc |
| POST | `/{id}/read` | Đánh dấu đã đọc |
| POST | `/read-all` | Đọc tất cả |

### Moderator — `/api/moderator` *(cần role MODERATOR hoặc ADMIN)*
| Method | URL | Mô tả |
|---|---|---|
| GET | `/posts` | Tất cả bài viết |
| POST | `/posts/{id}/start-processing` | Bắt đầu xử lý vi phạm |
| DELETE | `/posts/{id}` | Xóa bài vi phạm |
| DELETE | `/comments/{id}` | Xóa bình luận |
| GET | `/users` | Danh sách user |
| PUT | `/users/{id}/warn` | Cảnh báo user |
| PUT | `/users/{id}/ban` | Khóa tài khoản |
| PUT | `/users/{id}/unban` | Mở khóa |

### Admin — `/api/admin` *(chỉ ADMIN)*
| Method | URL | Mô tả |
|---|---|---|
| GET | `/users` | Tất cả user |
| PUT | `/users/{id}/ban` | Khóa user |
| PUT | `/users/{id}/unban` | Mở khóa |
| PUT | `/users/{id}/warn` | Cảnh báo |
| DELETE | `/users/{id}` | Xóa tài khoản |
| PUT | `/users/{id}/role` | Đổi role |
| GET | `/moderators` | Danh sách moderator |
| POST | `/moderators` | Tạo moderator |
| PUT | `/moderators/{id}/lock` | Khóa moderator |
| PUT | `/moderators/{id}/activate` | Mở khóa moderator |
| GET | `/stats` | Thống kê hệ thống |
| GET | `/users/{id}/login-history` | Lịch sử đăng nhập |

---

## 12. Cách chạy dự án

Xem file [README.md](README.md) để biết hướng dẫn đầy đủ.

**Tóm tắt:**
```bash
# Lần đầu: tạo môi trường Python
py -3.11 -m venv src/main/model/venv
src/main/model/venv/Scripts/pip install -r src/main/model/requirements.txt

# Chạy dự án (Spring Boot tự khởi động Flask AI)
mvn spring-boot:run
```

Truy cập: `http://localhost:8080`
