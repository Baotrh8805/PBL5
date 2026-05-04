package com.pbl5.dto;

import com.pbl5.enums.PostStatus;

public class ModerationResult {
    private PostStatus status;
    private Double bestScore;
    private Double nsfwScore;
    private Double violenceScore;
    private Double hateSpeechScore;
    private Boolean violationDetected;
    private String detectedText;
    private String mediaType;
    private String nsfwBox;
    private String violenBox;
    private String hateSpeechWord;
    private Integer highestScoreFrameSecond;
    private Integer totalFramesAnalyzed;

    public ModerationResult(PostStatus status, Double bestScore, Double nsfwScore,
            Double violenceScore, Double hateSpeechScore,
            Boolean violationDetected, String detectedText, String mediaType,
            String nsfwBox, String violenBox, String hateSpeechWord,
            Integer highestScoreFrameSecond, Integer totalFramesAnalyzed) {
        this.status = status;
        this.bestScore = bestScore;
        this.nsfwScore = nsfwScore;
        this.violenceScore = violenceScore;
        this.hateSpeechScore = hateSpeechScore;
        this.violationDetected = violationDetected;
        this.detectedText = detectedText;
        this.mediaType = mediaType;
        this.nsfwBox = nsfwBox;
        this.violenBox = violenBox;
        this.hateSpeechWord = hateSpeechWord;
        this.highestScoreFrameSecond = highestScoreFrameSecond;
        this.totalFramesAnalyzed = totalFramesAnalyzed;
    }

    public PostStatus getStatus() {
        return status;
    }

    public void setStatus(PostStatus status) {
        this.status = status;
    }

    public Double getBestScore() {
        return bestScore;
    }

    public void setBestScore(Double bestScore) {
        this.bestScore = bestScore;
    }

    public Double getNsfwScore() {
        return nsfwScore;
    }

    public void setNsfwScore(Double nsfwScore) {
        this.nsfwScore = nsfwScore;
    }

    public Double getViolenceScore() {
        return violenceScore;
    }

    public void setViolenceScore(Double violenceScore) {
        this.violenceScore = violenceScore;
    }

    public Double getHateSpeechScore() {
        return hateSpeechScore;
    }

    public void setHateSpeechScore(Double hateSpeechScore) {
        this.hateSpeechScore = hateSpeechScore;
    }

    public Boolean getViolationDetected() {
        return violationDetected;
    }

    public void setViolationDetected(Boolean violationDetected) {
        this.violationDetected = violationDetected;
    }

    public String getDetectedText() {
        return detectedText;
    }

    public void setDetectedText(String detectedText) {
        this.detectedText = detectedText;
    }

    public String getMediaType() {
        return mediaType;
    }

    public void setMediaType(String mediaType) {
        this.mediaType = mediaType;
    }

    public String getNsfwBox() {
        return nsfwBox;
    }

    public void setNsfwBox(String nsfwBox) {
        this.nsfwBox = nsfwBox;
    }

    public String getViolenBox() {
        return violenBox;
    }

    public void setViolenBox(String violenBox) {
        this.violenBox = violenBox;
    }

    public String getHateSpeechWord() {
        return hateSpeechWord;
    }

    public void setHateSpeechWord(String hateSpeechWord) {
        this.hateSpeechWord = hateSpeechWord;
    }

    public Integer getHighestScoreFrameSecond() {
        return highestScoreFrameSecond;
    }

    public void setHighestScoreFrameSecond(Integer highestScoreFrameSecond) {
        this.highestScoreFrameSecond = highestScoreFrameSecond;
    }

    public Integer getTotalFramesAnalyzed() {
        return totalFramesAnalyzed;
    }

    public void setTotalFramesAnalyzed(Integer totalFramesAnalyzed) {
        this.totalFramesAnalyzed = totalFramesAnalyzed;
    }
}
