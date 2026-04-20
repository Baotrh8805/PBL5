package com.pbl5.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/upload")
public class FileUploadController {

    private final String UPLOAD_DIR = "src/main/resources/static/uploads/";

    @PostMapping("/image")
    public ResponseEntity<?> uploadImage(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("File rỗng.");
        }

        try {
            // Tự động tạo folder nếu chưa có
            Path uploadPath = Paths.get(UPLOAD_DIR);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            // Đổi tên file để không bị trùng (dùng UUID)
            String fileName = StringUtils.cleanPath(file.getOriginalFilename());
            String newFileName = UUID.randomUUID().toString() + "-" + fileName;

            // Lưu file
            Path filePath = uploadPath.resolve(newFileName);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            // Trả về url có thể truy cập từ frontend (tĩnh được cấu hình)
            Map<String, String> response = new HashMap<>();
            response.put("imageUrl", "/uploads/" + newFileName);
            return ResponseEntity.ok(response);

        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Lỗi lưu file: " + e.getMessage());
        }
    }
}