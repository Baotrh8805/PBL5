package com.pbl5.controller;

import com.pbl5.service.FileUploadService;
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
    private FileUploadService fileUploadService;

    @PostMapping("/image")
    public ResponseEntity<?> uploadImage(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("File rỗng.");
        }

        try {
            String imageUrl = fileUploadService.uploadImage(file);

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
            String videoUrl = fileUploadService.uploadVideo(file);

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