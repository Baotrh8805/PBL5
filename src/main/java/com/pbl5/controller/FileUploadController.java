package com.pbl5.controller;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/upload")
public class FileUploadController {

    @Autowired
    private Cloudinary cloudinary;

    @PostMapping("/image")
    public ResponseEntity<?> uploadImage(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("File rỗng.");
        }

        try {
            // Tải ảnh trực tiếp lên Cloudinary thay vì lưu vào ổ cứng
            Map uploadResult = cloudinary.uploader().upload(file.getBytes(), ObjectUtils.emptyMap());

            // Nhận một link https nét và vĩnh viễn từ Cloudinary trả về
            String imageUrl = uploadResult.get("secure_url").toString();

            // Trả về url có thể truy cập 24/7 từ Cloudinary cho Frontend
            Map<String, String> response = new HashMap<>();
            response.put("imageUrl", imageUrl);
            response.put("url", imageUrl);
            return ResponseEntity.ok(response);

        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Lỗi tải ảnh lên Cloudinary: " + e.getMessage());
        }
    }

    @PostMapping("/video")
    public ResponseEntity<?> uploadVideo(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("File rỗng.");
        }

        try {
            // Tải video trực tiếp lên Cloudinary
            Map uploadResult = cloudinary.uploader().upload(file.getBytes(),
                    ObjectUtils.asMap("resource_type", "video"));

            // Nhận một link https từ Cloudinary trả về
            String videoUrl = uploadResult.get("secure_url").toString();

            // Trả về url có thể truy cập 24/7 từ Cloudinary cho Frontend
            Map<String, String> response = new HashMap<>();
            response.put("videoUrl", videoUrl);
            response.put("url", videoUrl);
            return ResponseEntity.ok(response);

        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Lỗi tải video lên Cloudinary: " + e.getMessage());
        }
    }
}