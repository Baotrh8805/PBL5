# PBL5 - Mạng xã hội LC Network

## Yêu cầu
- Java 17 (JDK)
- Maven 3.x
- Python 3.11.x ([Tải tại đây](https://www.python.org/downloads/release/python-3119/) → chọn **Windows installer 64-bit**)

---

## Hướng dẫn chạy dự án (lần đầu)

**Bước 1** — Clone hoặc pull code mới nhất:
```bash
git pull origin admin
```

**Bước 2** — Kiểm tra Python 3.11 đã có chưa:
```bash
py -3.11 --version
```

**Bước 3** — Tạo môi trường ảo Python (chỉ làm **1 lần duy nhất**):
```bash
py -3.11 -m venv src/main/model/venv
```

**Bước 4** — Cài thư viện AI (chỉ làm **1 lần duy nhất**):
```bash
src/main/model/venv/Scripts/pip install -r src/main/model/requirements.txt
```

**Bước 5** — Chạy dự án:
```bash
mvn spring-boot:run
```

> Spring Boot sẽ tự động khởi động Flask AI ở port 5000. Không cần chạy Python thủ công.
> Truy cập ứng dụng tại: http://localhost:8080

---

## Những lần chạy sau

Chỉ cần:
```bash
mvn spring-boot:run
```

Nếu `requirements.txt` có thay đổi sau khi pull, chạy thêm:
```bash
src/main/model/venv/Scripts/pip install -r src/main/model/requirements.txt
```
