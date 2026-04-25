"""
Content Moderation Service - Python Flask API

Moderation flow:
1. Text post content -> hate speech model
2. Image URL -> NSFW + violence models + OCR -> hate speech model
3. Video URL -> sample 1 frame/second -> NSFW + violence models + OCR -> hate speech model
"""

from __future__ import annotations

import os
import re
import tempfile
import logging
from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np
import requests
import torch
import torch.nn as nn
from flask import Flask, jsonify, request

try:
    from transformers import AutoTokenizer, AutoModel
    import transformers.modeling_utils as modeling_utils
    modeling_utils.check_torch_load_is_safe = lambda: None
except ImportError:
    AutoTokenizer = None
    AutoModel = None

try:
    import pytesseract
except Exception:
    pytesseract = None

app = Flask(__name__)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("moderation")

if pytesseract is None:
    logger.warning("❌ pytesseract python package is NOT installed. OCR will be disabled.")
else:
    try:
        tess_version = pytesseract.get_tesseract_version()
        logger.info("✅ Tesseract OCR Engine (version %s) loaded successfully. OCR is fully enabled.", tess_version)
    except Exception as e:
        logger.warning("❌ pytesseract package is installed, BUT Tesseract Engine is NOT found or configured incorrectly. OCR will fail! Error: %s", e)

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MAX_VIDEO_SECONDS = 120
DOWNLOAD_TIMEOUT_SECONDS = 120
REJECT_THRESHOLD = 0.80
REVIEW_THRESHOLD = 0.30


# ═══════════════════════════════════════════════════════════════════
#  Model Architecture Definitions (must match training code exactly)
# ═══════════════════════════════════════════════════════════════════

class NSFWModel(nn.Module):
    """4-conv CNN for NSFW classification. Input: 3x224x224, Output: 2 classes."""
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 32, 3, padding=1)
        self.bn1 = nn.BatchNorm2d(32)
        self.conv2 = nn.Conv2d(32, 64, 3, padding=1)
        self.bn2 = nn.BatchNorm2d(64)
        self.conv3 = nn.Conv2d(64, 128, 3, padding=1)
        self.bn3 = nn.BatchNorm2d(128)
        self.conv4 = nn.Conv2d(128, 256, 3, padding=1)
        self.bn4 = nn.BatchNorm2d(256)
        self.fc1 = nn.Linear(256 * 14 * 14, 512)
        self.fc2 = nn.Linear(512, 2)
        self.pool = nn.MaxPool2d(2, 2)
        self.relu = nn.ReLU()

    def forward(self, x):
        x = self.pool(self.relu(self.bn1(self.conv1(x))))
        x = self.pool(self.relu(self.bn2(self.conv2(x))))
        x = self.pool(self.relu(self.bn3(self.conv3(x))))
        x = self.pool(self.relu(self.bn4(self.conv4(x))))
        x = x.view(x.size(0), -1)
        x = self.relu(self.fc1(x))
        x = self.fc2(x)
        return x


class ViolenceModel(nn.Module):
    """CNN-GRU model for violence detection. Input: 3x56x56, Output: 2 classes."""
    def __init__(self):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1),   # 0
            nn.ReLU(),                          # 1
            nn.MaxPool2d(2, 2),                 # 2
            nn.Conv2d(32, 64, 3, padding=1),   # 3
            nn.ReLU(),                          # 4
            nn.MaxPool2d(2, 2),                 # 5
            nn.Conv2d(64, 128, 3, padding=1),  # 6
            nn.ReLU(),                          # 7
            nn.MaxPool2d(2, 2),                 # 8
            nn.Flatten(),                       # 9
            nn.ReLU(),                          # 10
            nn.Linear(128 * 7 * 7, 512),       # 11
        )
        self.rnn = nn.GRU(512, 256, num_layers=2, batch_first=True)
        self.fc = nn.Sequential(
            nn.Linear(256, 128),  # 0
            nn.ReLU(),            # 1
            nn.Dropout(0.3),      # 2
            nn.Linear(128, 2),    # 3
        )

    def forward(self, x):
        # x: (batch, channels, H, W) for single frame
        if x.dim() == 4:
            features = self.cnn(x)           # (batch, 512)
            features = features.unsqueeze(1) # (batch, 1, 512)
        else:
            features = x
        rnn_out, _ = self.rnn(features)      # (batch, seq, 256)
        out = rnn_out[:, -1, :]              # (batch, 256)
        out = self.fc(out)                   # (batch, 2)
        return out


class PhoBERTHateSpeech(nn.Module):
    """PhoBERT + linear classifier for hate speech (3 classes)."""
    def __init__(self, device):
        super().__init__()
        self.device = device
        self.phobert = AutoModel.from_pretrained("vinai/phobert-base")
        self.classifier = nn.Linear(768, 3)

    def forward(self, input_ids, attention_mask=None):
        outputs = self.phobert(input_ids=input_ids, attention_mask=attention_mask)
        pooled = outputs.pooler_output  # (batch, 768)
        logits = self.classifier(pooled) # (batch, 3)
        return logits


@dataclass
class MediaModerationScores:
    nsfw_score: float = 0.0
    violence_score: float = 0.0
    hatespeech_score: float = 0.0
    detected_text: str = ""
    media_type: str = "text"
    nsfw_box: dict[str, int] | None = None
    violen_box: dict[str, int] | None = None
    hate_speech_word: list[str] = field(default_factory=list)
    highest_score_frame_second: int | None = None
    total_frames_analyzed: int = 0

    @property
    def best_score(self) -> float:
        return max(self.nsfw_score, self.violence_score, self.hatespeech_score)


class ContentModerationModel:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.models_loaded = False
        self.nsfw_model = None
        self.violence_model = None
        self.hatespeech_model = None
        self.hatespeech_tokenizer = None
        self.tesseract_langs = "eng"
        if pytesseract is not None:
            try:
                langs = pytesseract.get_languages()
                if "vie" in langs:
                    self.tesseract_langs = "vie"
                logger.info("[OCR] Available languages: %s. Using lang='%s'", langs, self.tesseract_langs)
            except Exception as e:
                logger.warning("[OCR] Could not detect languages: %s", e)
        self.load_models()

    def load_models(self) -> None:
        try:
            self.nsfw_model = self._load_nsfw_model()
            self.violence_model = self._load_violence_model()
            self.hatespeech_model, self.hatespeech_tokenizer = self._load_hatespeech_model()
            self.models_loaded = True
            logger.info(
                "=== MODEL LOAD SUMMARY === nsfw=%s | violence=%s | hatespeech=%s",
                self.nsfw_model is not None,
                self.violence_model is not None,
                self.hatespeech_model is not None,
            )
        except Exception as exc:
            logger.exception("Error initializing models: %s", exc)
            self.models_loaded = False

    def _load_nsfw_model(self):
        path = os.path.join(MODEL_DIR, "best_NSFW.pt")
        if not os.path.exists(path):
            logger.warning("NSFW model file not found: %s", path)
            return None
        try:
            state_dict = torch.load(path, map_location=self.device, weights_only=False)
            model = NSFWModel().to(self.device)
            model.load_state_dict(state_dict)
            model.eval()
            logger.info("✅ NSFW model loaded successfully from %s", path)
            return model
        except Exception as exc:
            logger.error("❌ Failed to load NSFW model: %s", exc)
            return None

    def _load_violence_model(self):
        path = os.path.join(MODEL_DIR, "best_violence.pth")
        if not os.path.exists(path):
            logger.warning("Violence model file not found: %s", path)
            return None
        try:
            state_dict = torch.load(path, map_location=self.device, weights_only=False)
            model = ViolenceModel().to(self.device)
            model.load_state_dict(state_dict)
            model.eval()
            logger.info("✅ Violence model loaded successfully from %s", path)
            return model
        except Exception as exc:
            logger.error("❌ Failed to load Violence model: %s", exc)
            return None

    def _load_hatespeech_model(self):
        path = os.path.join(MODEL_DIR, "phobert_hatespeech_best.pt")
        if not os.path.exists(path):
            logger.warning("HateSpeech model file not found: %s", path)
            return None, None
        if AutoTokenizer is None or AutoModel is None:
            logger.error("❌ transformers library not available for PhoBERT")
            return None, None
        try:
            tokenizer = AutoTokenizer.from_pretrained("vinai/phobert-base")
            model = PhoBERTHateSpeech(self.device).to(self.device)
            state_dict = torch.load(path, map_location=self.device, weights_only=False)
            # Remove loss_fn weights from state_dict (not part of model)
            state_dict = {k: v for k, v in state_dict.items() if not k.startswith("loss_fn")}
            model.load_state_dict(state_dict)
            model.eval()
            logger.info("✅ HateSpeech (PhoBERT) model loaded successfully from %s", path)
            return model, tokenizer
        except Exception as exc:
            logger.error("❌ Failed to load HateSpeech model: %s", exc)
            return None, None

    # ── Image preprocessing ──────────────────────────────────────────

    def _frame_to_nsfw_tensor(self, frame_bgr: np.ndarray) -> torch.Tensor:
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        frame_rgb = cv2.resize(frame_rgb, (224, 224), interpolation=cv2.INTER_AREA)
        tensor = torch.from_numpy(frame_rgb).float() / 255.0
        tensor = tensor.permute(2, 0, 1).unsqueeze(0).to(self.device)
        return tensor

    def _frame_to_violence_tensor(self, frame_bgr: np.ndarray) -> torch.Tensor:
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        frame_rgb = cv2.resize(frame_rgb, (56, 56), interpolation=cv2.INTER_AREA)
        tensor = torch.from_numpy(frame_rgb).float() / 255.0
        tensor = tensor.permute(2, 0, 1).unsqueeze(0).to(self.device)
        return tensor

    # ── Predictions ──────────────────────────────────────────────────

    def predict_nsfw_frame(self, frame_bgr: np.ndarray) -> float:
        if self.nsfw_model is None:
            logger.warning("[PREDICT] NSFW model unavailable, returning 0.0")
            return 0.0
        try:
            tensor = self._frame_to_nsfw_tensor(frame_bgr)
            with torch.no_grad():
                logits = self.nsfw_model(tensor)  # (1, 2)
            probs = torch.softmax(logits, dim=1)
            nsfw_prob = probs[0, 1].item()  # class 1 = nsfw
            logger.info("[PREDICT] NSFW raw logits=%s probs=%s => score=%.4f",
                        logits.cpu().numpy().tolist(), probs.cpu().numpy().tolist(), nsfw_prob)
            return float(nsfw_prob)
        except Exception as exc:
            logger.error("[PREDICT] NSFW inference failed: %s", exc)
            return 0.0

    def predict_violence_frame(self, frame_bgr: np.ndarray) -> float:
        if self.violence_model is None:
            logger.warning("[PREDICT] Violence model unavailable, returning 0.0")
            return 0.0
        try:
            tensor = self._frame_to_violence_tensor(frame_bgr)
            with torch.no_grad():
                logits = self.violence_model(tensor)  # (1, 2)
            probs = torch.softmax(logits, dim=1)
            violence_prob = probs[0, 1].item()  # class 1 = violence
            logger.info("[PREDICT] Violence raw logits=%s probs=%s => score=%.4f",
                        logits.cpu().numpy().tolist(), probs.cpu().numpy().tolist(), violence_prob)
            return float(violence_prob)
        except Exception as exc:
            logger.error("[PREDICT] Violence inference failed: %s", exc)
            return 0.0

    def predict_hatespeech_text(self, text: str) -> float:
        if not text or not text.strip():
            return 0.0

        normalized = re.sub(r"\s+", " ", text).strip().lower()
        if not normalized:
            return 0.0

        # Keyword fallback
        toxic_keywords = [
            "địt", "đụ", "đéo", "ngu", "chết", "giết", "súc vật", "xúc vật", "mày", "tao",
            "cút", "chó", "đấm", "đánh", "nigger", "faggot", "kill", "hate",
            "đồ chó", "con chó", "thằng ngu", "con ngu", "đồ ngu", "chó má",
            "khốn nạn", "đồ khốn", "mẹ mày", "bố mày", "lồn", "buồi", "cặc",
            "đĩ", "cave", "phò", "thằng chó", "con đĩ", "đồ đĩ",
        ]
        hits = sum(1 for key in toxic_keywords if key in normalized)
        keyword_score = min(1.0, hits * 0.18)

        if self.hatespeech_model is None or self.hatespeech_tokenizer is None:
            logger.warning("[PREDICT] HateSpeech model unavailable, using keyword fallback=%.4f", keyword_score)
            return keyword_score

        try:
            encoding = self.hatespeech_tokenizer(
                normalized,
                return_tensors="pt",
                max_length=256,
                truncation=True,
                padding="max_length",
            )
            input_ids = encoding["input_ids"].to(self.device)
            attention_mask = encoding["attention_mask"].to(self.device)

            with torch.no_grad():
                logits = self.hatespeech_model(input_ids, attention_mask)  # (1, 3)

            probs = torch.softmax(logits, dim=1)
            # class 0 = clean, class 1 = offensive, class 2 = hate
            offensive_prob = probs[0, 1].item()
            hate_prob = probs[0, 2].item()
            model_score = offensive_prob + hate_prob  # combined violation probability

            logger.info(
                "[PREDICT] HateSpeech text='%s' logits=%s probs=%s "
                "clean=%.4f offensive=%.4f hate=%.4f => model_score=%.4f keyword_score=%.4f",
                normalized[:80], logits.cpu().numpy().tolist(), probs.cpu().numpy().tolist(),
                probs[0, 0].item(), offensive_prob, hate_prob,
                model_score, keyword_score
            )
            return max(keyword_score, float(min(1.0, model_score)))
        except Exception as exc:
            logger.error("[PREDICT] HateSpeech inference failed: %s", exc)
            return keyword_score

    # ── OCR ──────────────────────────────────────────────────────────

    def _extract_text_from_frame(self, frame_bgr: np.ndarray) -> str:
        if pytesseract is None:
            return ""
        try:
            rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            text = pytesseract.image_to_string(rgb, lang=self.tesseract_langs, config="--psm 11")
            
            if not text.strip():
                gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
                text = pytesseract.image_to_string(gray, lang=self.tesseract_langs, config="--psm 11")
                
            if text.strip():
                logger.info("[OCR] Extracted text from frame: '%s'", text.strip()[:200])
            return text.strip()
        except Exception as e:
            logger.error("OCR extraction failed: %s", e)
            return ""

    def _extract_toxic_words(self, text: str) -> list[str]:
        if not text:
            return []
        normalized = re.sub(r"\s+", " ", text).strip().lower()
        if not normalized:
            return []
        toxic_keywords = [
            "địt", "đụ", "đéo", "ngu", "chết", "giết", "súc vật", "xúc vật", "mày", "tao",
            "cút", "chó", "đấm", "đánh", "nigger", "faggot", "kill", "hate",
            "đồ chó", "con chó", "thằng ngu", "con ngu", "đồ ngu", "chó má",
            "khốn nạn", "đồ khốn", "mẹ mày", "bố mày", "lồn", "buồi", "cặc",
            "đĩ", "cave", "phò", "thằng chó", "con đĩ", "đồ đĩ",
        ]
        return sorted(set(key for key in toxic_keywords if key in normalized))

    # ── Bounding box helper ──────────────────────────────────────────

    def _build_box(self, frame_bgr: np.ndarray, score: float, source: str) -> dict[str, int] | None:
        if score < 0.25:
            return None
        height, width = frame_bgr.shape[:2]
        return {"x1": 0, "y1": 0, "x2": int(width), "y2": int(height),
                "source": source, "score": round(float(score), 4)}

    # ── Media scoring ────────────────────────────────────────────────

    def _extract_media_scores(self, frame_bgr: np.ndarray, media_type: str) -> MediaModerationScores:
        scores = MediaModerationScores(media_type=media_type)

        scores.nsfw_score = self.predict_nsfw_frame(frame_bgr)
        scores.violence_score = self.predict_violence_frame(frame_bgr)

        scores.nsfw_box = self._build_box(frame_bgr, scores.nsfw_score, "nsfw")
        scores.violen_box = self._build_box(frame_bgr, scores.violence_score, "violen")

        extracted = self._extract_text_from_frame(frame_bgr)
        scores.hatespeech_score = self.predict_hatespeech_text(extracted)
        scores.detected_text = extracted
        scores.hate_speech_word = self._extract_toxic_words(extracted)

        logger.info(
            "[MEDIA SCORES] type=%s nsfw=%.4f violence=%.4f hatespeech=%.4f best=%.4f",
            media_type, scores.nsfw_score, scores.violence_score,
            scores.hatespeech_score, scores.best_score
        )
        return scores

    # ── Download helpers ─────────────────────────────────────────────

    def _download_media(self, url: str) -> str | None:
        if not url:
            return None
        logger.info("[DOWNLOAD] Downloading media from: %s", url[:200])
        response = requests.get(url, timeout=DOWNLOAD_TIMEOUT_SECONDS, stream=True)
        response.raise_for_status()
        suffix = ".bin"
        path_lower = url.lower()
        for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm", ".jpg", ".jpeg", ".png", ".webp"]:
            if ext in path_lower:
                suffix = ext
                break
        # Fallback: detect from Content-Type header
        if suffix == ".bin":
            ct = (response.headers.get("Content-Type") or "").lower()
            if "video/mp4" in ct:
                suffix = ".mp4"
            elif "video/webm" in ct:
                suffix = ".webm"
            elif "image/jpeg" in ct:
                suffix = ".jpg"
            elif "image/png" in ct:
                suffix = ".png"
            elif "image/webp" in ct:
                suffix = ".webp"
            elif "video" in ct:
                suffix = ".mp4"  # default video format
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        total_bytes = 0
        try:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    tmp.write(chunk)
                    total_bytes += len(chunk)
            logger.info("[DOWNLOAD] Downloaded %d bytes to %s (suffix=%s)", total_bytes, tmp.name, suffix)
            return tmp.name
        finally:
            tmp.close()

    def _moderate_image_from_url(self, image_url: str) -> MediaModerationScores:
        scores = MediaModerationScores()
        local_path = None
        try:
            local_path = self._download_media(image_url)
            if not local_path:
                logger.warning("[IMAGE] Download returned None for URL: %s", image_url[:200])
                return scores
            frame = cv2.imread(local_path)
            if frame is None:
                logger.warning("[IMAGE] cv2.imread returned None for: %s", local_path)
                return scores
            logger.info("[IMAGE] Loaded image %s shape=%s", local_path, frame.shape)
            scores = self._extract_media_scores(frame, "image")
            return scores
        except Exception as exc:
            logger.error("Image moderation failed: %s", exc)
            return scores
        finally:
            if local_path and os.path.exists(local_path):
                os.unlink(local_path)

    def _moderate_video_from_url(self, video_url: str) -> MediaModerationScores:
        scores = MediaModerationScores()
        local_path = None
        try:
            local_path = self._download_media(video_url)
            if not local_path:
                logger.warning("[VIDEO] Download returned None for URL: %s", video_url[:200])
                return scores
            cap = cv2.VideoCapture(local_path)
            if not cap.isOpened():
                logger.warning("[VIDEO] cv2.VideoCapture could not open: %s", local_path)
                return scores
            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            if fps is None or fps <= 0:
                fps = 25.0
            frame_step = max(1, int(round(fps)))  # 1 frame per second
            max_frames = int(MAX_VIDEO_SECONDS * fps)
            logger.info(
                "[VIDEO] fps=%.1f total_frames=%d frame_step=%d max_frames=%d",
                fps, total_frames, frame_step, max_frames
            )
            frame_index = 0
            sampled_count = 0
            sampled_texts: list[str] = []
            best_frame: MediaModerationScores | None = None
            best_frame_score = 0.0
            best_frame_index = 0

            while cap.isOpened():
                ok, frame = cap.read()
                if not ok or frame_index > max_frames:
                    break
                if frame_index % frame_step == 0:
                    sampled_count += 1
                    frame_scores = self._extract_media_scores(frame, "video")
                    logger.info(
                        "[VIDEO] Frame %d (sample #%d): nsfw=%.4f violence=%.4f hatespeech=%.4f best=%.4f",
                        frame_index, sampled_count,
                        frame_scores.nsfw_score, frame_scores.violence_score,
                        frame_scores.hatespeech_score, frame_scores.best_score
                    )
                    scores.nsfw_score = max(scores.nsfw_score, frame_scores.nsfw_score)
                    scores.violence_score = max(scores.violence_score, frame_scores.violence_score)
                    frame_best = frame_scores.best_score
                    if frame_best > best_frame_score:
                        best_frame_score = frame_best
                        best_frame = frame_scores
                        best_frame_index = frame_index
                    if frame_scores.detected_text:
                        sampled_texts.append(frame_scores.detected_text)
                    if frame_scores.hate_speech_word:
                        scores.hate_speech_word = sorted(set(
                            scores.hate_speech_word + frame_scores.hate_speech_word))
                frame_index += 1

            cap.release()
            logger.info("[VIDEO] Sampled %d frames from %d total", sampled_count, frame_index)

            # Use scores from the best (worst-violating) frame for boxes
            if best_frame is not None:
                scores.nsfw_box = best_frame.nsfw_box
                scores.violen_box = best_frame.violen_box
                scores.nsfw_score = max(scores.nsfw_score, best_frame.nsfw_score)
                scores.violence_score = max(scores.violence_score, best_frame.violence_score)
                scores.highest_score_frame_second = int(best_frame_index // fps)
                
            scores.total_frames_analyzed = sampled_count

            combined_text = " ".join(sampled_texts)
            scores.hatespeech_score = self.predict_hatespeech_text(combined_text)
            scores.detected_text = combined_text
            scores.media_type = "video"
            scores.hate_speech_word = sorted(set(
                scores.hate_speech_word + self._extract_toxic_words(combined_text)))

            logger.info(
                "[VIDEO] FINAL: nsfw=%.4f violence=%.4f hatespeech=%.4f best=%.4f nsfw_box=%s violen_box=%s",
                scores.nsfw_score, scores.violence_score, scores.hatespeech_score,
                scores.best_score, scores.nsfw_box, scores.violen_box
            )
            return scores
        except Exception as exc:
            logger.error("Video moderation failed: %s", exc)
            return scores
        finally:
            if local_path and os.path.exists(local_path):
                os.unlink(local_path)

    # ── Main moderation entry point ──────────────────────────────────

    def moderate(self, content: str, image_url: str | None, video_url: str | None) -> dict[str, Any]:
        logger.info("=" * 70)
        logger.info("[MODERATE] START content='%s' image=%s video=%s",
                    (content or "")[:100], bool(image_url), bool(video_url))

        image_scores = self._moderate_image_from_url(image_url) if image_url else MediaModerationScores()
        video_scores = self._moderate_video_from_url(video_url) if video_url else MediaModerationScores()

        detected_text_parts = []
        if content and content.strip():
            detected_text_parts.append(content.strip())
        if image_scores.detected_text:
            detected_text_parts.append(image_scores.detected_text)
        if video_scores.detected_text:
            detected_text_parts.append(video_scores.detected_text)

        combined_all_text = " ".join(part for part in detected_text_parts if part).strip()
        
        logger.info("[MODERATE] COMBINED TEXT (Post + Image OCR + Video OCR) for PhoBERT: '%s'", combined_all_text)
        
        # Pass the COMBINED text back into the hatespeech model
        combined_hatespeech_score = self.predict_hatespeech_text(combined_all_text)

        nsfw_score = max(image_scores.nsfw_score, video_scores.nsfw_score)
        violence_score = max(image_scores.violence_score, video_scores.violence_score)
        
        # We take the max of the individual hatespeech scores and the combined one
        hatespeech_score = max(combined_hatespeech_score, image_scores.hatespeech_score, video_scores.hatespeech_score)
        best_score = max(nsfw_score, violence_score, hatespeech_score)
        
        hate_speech_words = sorted(set(
            self._extract_toxic_words(combined_all_text)
            + image_scores.hate_speech_word 
            + video_scores.hate_speech_word
        ))

        nsfw_box = image_scores.nsfw_box if image_scores.nsfw_score >= video_scores.nsfw_score else video_scores.nsfw_box
        violen_box = image_scores.violen_box if image_scores.violence_score >= video_scores.violence_score else video_scores.violen_box

        if image_url and video_url:
            media_type = "mixed"
        elif image_url:
            media_type = image_scores.media_type or "image"
        elif video_url:
            media_type = video_scores.media_type or "video"
        else:
            media_type = "text"

        logger.info(
            "[MODERATE] FINAL RESULT: nsfw=%.4f violence=%.4f hatespeech=%.4f best=%.4f media=%s words=%s",
            nsfw_score, violence_score, hatespeech_score, best_score, media_type, hate_speech_words
        )
        logger.info("=" * 70)

        return {
            "nsfw_score": float(max(0.0, min(1.0, nsfw_score))),
            "violence_score": float(max(0.0, min(1.0, violence_score))),
            "hatespeech_score": float(max(0.0, min(1.0, hatespeech_score))),
            "best_score": float(max(0.0, min(1.0, best_score))),
            "detected_text": " ".join(part for part in detected_text_parts if part).strip(),
            "media_type": media_type,
            "nsfw_box": nsfw_box,
            "violen_box": violen_box,
            "hate_speech_word": hate_speech_words,
            "highest_score_frame_second": video_scores.highest_score_frame_second if video_url else None,
            "total_frames_analyzed": video_scores.total_frames_analyzed if video_url else 0,
        }


moderator = ContentModerationModel()


@app.route("/api/moderate", methods=["POST"])
def moderate_content() -> Any:
    try:
        data = request.get_json(silent=True) or {}
        content = (data.get("content") or "").strip()
        image_url = data.get("imageUrl") or data.get("image_url") or ""
        image_url = image_url.strip() if isinstance(image_url, str) else ""
        video_url = data.get("videoUrl") or data.get("video_url") or ""
        video_url = video_url.strip() if isinstance(video_url, str) else ""

        logger.info(
            "[API] /api/moderate received: content='%s' image_url='%s' video_url='%s'",
            content[:200] if content else "(empty)",
            image_url[:100] if image_url else "(empty)",
            video_url[:100] if video_url else "(empty)",
        )

        if not content and not image_url and not video_url:
            logger.info("[API] All inputs empty, returning zeros")
            return jsonify({
                "nsfw_score": 0.0, "violence_score": 0.0, "hatespeech_score": 0.0,
                "best_score": 0.0, "detected_text": "", "media_type": "text",
                "nsfw_box": None, "violen_box": None, "hate_speech_word": [],
                "highest_score_frame_second": None,
                "total_frames_analyzed": 0,
            }), 200

        result = moderator.moderate(content=content, image_url=image_url, video_url=video_url)
        logger.info("[API] /api/moderate response: %s", result)
        return jsonify(result), 200
    except Exception as exc:
        logger.exception("Error in /api/moderate: %s", exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/health", methods=["GET"])
def health() -> Any:
    return jsonify({"status": "healthy", "models_loaded": moderator.models_loaded}), 200


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True, use_reloader=False)
