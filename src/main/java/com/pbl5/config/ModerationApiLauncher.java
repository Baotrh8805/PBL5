package com.pbl5.config;

import jakarta.annotation.PreDestroy;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Component
public class ModerationApiLauncher {

    private static final URI HEALTH_URI = URI.create("http://127.0.0.1:5000/health");
    private static final Path MODEL_DIR = Paths.get("src", "main", "model").toAbsolutePath().normalize();

    private volatile Process moderationProcess;

    @EventListener(ApplicationReadyEvent.class)
    public void startModerationApi() {
        if (isHealthy()) {
            System.out.println("✅ Python moderation API đã sẵn sàng tại " + HEALTH_URI);
            return;
        }

        try {
            String pythonExe = MODEL_DIR.resolve("venv/Scripts/python.exe").toString();
            ProcessBuilder processBuilder = new ProcessBuilder(pythonExe, "moderate.py");
            processBuilder.directory(MODEL_DIR.toFile());
            processBuilder.redirectErrorStream(true);
            processBuilder.inheritIO();
            moderationProcess = processBuilder.start();

            waitForHealthy(Duration.ofSeconds(20));
        } catch (IOException e) {
            System.out.println("❌ Không thể khởi động Python moderation API: " + e.getMessage());
        }
    }

    private void waitForHealthy(Duration timeout) {
        long deadline = System.currentTimeMillis() + timeout.toMillis();
        while (System.currentTimeMillis() < deadline) {
            if (isHealthy()) {
                System.out.println("✅ Python moderation API đã khởi động từ thư mục: " + MODEL_DIR);
                return;
            }

            try {
                TimeUnit.MILLISECONDS.sleep(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }

        System.out.println("⚠️ Đã khởi động tiến trình Python, nhưng /health chưa sẵn sàng sau thời gian chờ.");
    }

    private boolean isHealthy() {
        try {
            URL url = HEALTH_URI.toURL();
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(2000);
            connection.setReadTimeout(2000);
            connection.setRequestMethod("GET");
            int status = connection.getResponseCode();
            connection.disconnect();
            return status == 200;
        } catch (Exception e) {
            return false;
        }
    }

    @PreDestroy
    public void stopModerationApi() {
        Process process = moderationProcess;
        if (process != null && process.isAlive()) {
            process.destroy();
        }
    }
}