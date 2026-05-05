import os
import sys
import io

# Force UTF-8 output to prevent Windows console UnicodeEncodeError
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import cv2
import numpy as np
import torch
import torch.nn as nn
import tempfile
from transformers import AutoModel, AutoTokenizer
from flask import Flask, request, jsonify
import urllib.request
import requests
import re
import math
import logging
import transformers.modeling_utils as modeling_utils
modeling_utils.check_torch_load_is_safe = lambda: None
import unicodedata
import easyocr
from vietocr.tool.predictor import Predictor
from vietocr.tool.config import Cfg
from PIL import Image

# Khởi tạo mô hình nhận diện của VietOCR
config = Cfg.load_config_from_name('vgg_seq2seq')
config['cnn']['pretrained'] = False
config['predictor']['beamsearch'] = False
config['device'] = 'cuda' if torch.cuda.is_available() else 'cpu'
vietocr_predictor = Predictor(config)

# Khởi tạo EasyOCR (Chỉ dùng bộ thư viện gốc để lấy thuật toán phát hiện vùng chữ - CRAFT)
reader = easyocr.Reader(['vi'])

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Debug: Kiểm tra working directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEBUG_FILE = os.path.join(SCRIPT_DIR, "kiem_tra_ocr.txt")
print(f"[INIT] Script directory: {SCRIPT_DIR}")
print(f"[INIT] Debug file path: {DEBUG_FILE}")


def append_debug_line(message: str):
    try:
        with open(DEBUG_FILE, "a", encoding="utf-8") as f:
            f.write(message + "\n")
            f.flush()
    except Exception as e:
        print(f"[DEBUG_FILE_ERROR] {e}")


class NSFWModel(nn.Module):
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
    def __init__(self):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2, 2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2, 2),
            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2, 2),
            nn.Flatten(), nn.ReLU(), nn.Linear(128 * 7 * 7, 512)
        )
        self.rnn = nn.GRU(512, 256, num_layers=2, batch_first=True)
        self.fc = nn.Sequential(nn.Linear(256, 128), nn.ReLU(), nn.Dropout(0.3), nn.Linear(128, 2))

    def forward(self, x):
        if x.dim() == 4:
            features = self.cnn(x)
            features = features.unsqueeze(1)
        else:
            features = x
        rnn_out, _ = self.rnn(features)
        out = rnn_out[:, -1, :]
        out = self.fc(out)
        return out

class TokenClassificationModel(nn.Module):
    def __init__(self, model_name='vinai/phobert-base', num_labels=3, dropout_prob=0.15):
        super().__init__()
        self.num_labels = num_labels
        self.phobert = AutoModel.from_pretrained(model_name)
        self.config = self.phobert.config
        self.dropout = nn.Dropout(dropout_prob)
        self.classifier = nn.Linear(self.config.hidden_size, num_labels)

    def forward(self, input_ids, attention_mask=None):
        outputs = self.phobert(
            input_ids=input_ids,
            attention_mask=attention_mask,
            output_hidden_states=False
        )
        sequence_output = outputs.last_hidden_state
        sequence_output = self.dropout(sequence_output)
        logits = self.classifier(sequence_output)
        return logits

# --- MODERATION LOGIC ---

class ContentModerationSystem:
    def __init__(self):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        
        self.nsfw_model = NSFWModel().to(device)
        self.violence_model = ViolenceModel().to(device)
        self.hatespeech_model = TokenClassificationModel(num_labels=3).to(device)
        self.tokenizer = AutoTokenizer.from_pretrained('vinai/phobert-base')
        
        # Load weights carefully
        try:
            d_nsfw = torch.load(os.path.join(base_dir, 'best_NSFW.pt'), map_location=device, weights_only=False)
            self.nsfw_model.load_state_dict(d_nsfw)
            logger.info("Successfully loaded NSFW model")
            append_debug_line("[INIT] Successfully loaded NSFW model")
        except Exception as e:
            logger.error(f"Error loading NSFW model: {e}")
            
        try:
            d_viol = torch.load(os.path.join(base_dir, 'best_violence.pth'), map_location=device, weights_only=False)
            self.violence_model.load_state_dict(d_viol)
            logger.info("Successfully loaded Violence model")
            append_debug_line("[INIT] Successfully loaded Violence model")
        except Exception as e:
            logger.error(f"Error loading Violence model: {e}")
            
        try:
            d_hate = torch.load(os.path.join(base_dir, 'phobert_hatespeech_best.pt'), map_location=device, weights_only=False)
            d_hate = {k: v for k, v in d_hate.items() if not k.startswith('loss_fn')}
            self.hatespeech_model.load_state_dict(d_hate, strict=False)
            logger.info("Successfully loaded PhoBERT Hate Speech model")
            append_debug_line("[INIT] Successfully loaded PhoBERT Hate Speech model")
        except Exception as e:
            logger.error(f"==========================Error loading PhoBERT model: {e}")
            
        self.nsfw_model.eval()
        self.violence_model.eval()
        self.hatespeech_model.eval()

        self.toxic_keywords = []

    def clean_vietnamese_ocr_text(self, text: str):
        if not text:
            return ""
        
        # Tiền xử lý giống 100% với hàm clean_word_deep trong khi train (đã fix typo)
        text = str(text).lower().strip()
        text = unicodedata.normalize('NFC', text)
        # Chỉ xóa dấu chấm và gạch ngang giữa chữ (v.l -> vl)
        text = re.sub(r'([a-z])[\.\-]([a-z])', r'\1\2', text)
        # Giữ lại chữ, số, các dấu câu cơ bản và dấu gạch dưới
        text = re.sub(r'[^\s\w\d.,!?:)_]', '', text)
        
        # Phân mảnh và loại bỏ các khoảng trắng thừa
        tokens = text.split()
        return " ".join(tokens)

    def evaluate_text(self, text: str):
        if not text.strip():
            return 0.0, [], []
        
        # Lọc bỏ nhiễu OCR
        clean_text = self.clean_vietnamese_ocr_text(text)
        
        if not clean_text:
            return 0.0, [], []
        
        final_hate_score = 0.0
        violating_words = []
        detailed_tags = [] # Chứa định dạng [{"word": "...", "tag": "..."}]
        
        try:
            tokens = clean_text.split()
            if not tokens:
                return 0.0, [], []

            # Mã hoá và ánh xạ từ ban đầu
            input_ids = [self.tokenizer.cls_token_id]
            word_starts = []
            
            for w in tokens:
                word_starts.append(len(input_ids)) # Vị trí token đầu tiên của từ W
                w_toks = self.tokenizer.encode(w, add_special_tokens=False)
                if not w_toks:
                    input_ids.append(self.tokenizer.unk_token_id)
                else:
                    input_ids.extend(w_toks)
                    
            input_ids.append(self.tokenizer.sep_token_id)
            
            # Giới hạn độ dài tránh vượt quá 256 của max_length pre-train
            if len(input_ids) > 256:
                input_ids = input_ids[:255] + [self.tokenizer.sep_token_id]
                word_starts = [idx for idx in word_starts if idx < 255]
                tokens = tokens[:len(word_starts)]

            input_tensor = torch.tensor([input_ids], dtype=torch.long).to(device)
            mask_tensor = torch.ones_like(input_tensor).to(device)
            
            with torch.no_grad():
                logits = self.hatespeech_model(input_ids=input_tensor, attention_mask=mask_tensor)
                # Dạng trả ra là NER [batch_size, sequence_length, num_labels=3]
                probs = torch.softmax(logits, dim=-1)[0]
                preds = torch.argmax(probs, dim=-1).cpu().numpy()
                
            # TAG mapping bạn dùng: 0: O, 1: B-T, 2: I-T
            id2tag = {0: "O", 1: "B-T", 2: "I-T"}
            max_prob = 0.0
            
            for i, word_idx in enumerate(word_starts):
                pred_tag = preds[word_idx]
                tag_prob = probs[word_idx][pred_tag].item()
                str_tag = id2tag.get(pred_tag, "O")
                
                # Lưu toàn bộ cấu trúc câu cùng với Tag để nhét vào Database
                detailed_tags.append({"word": tokens[i], "tag": str_tag})
                
                # Lưu lại những từ mang nhãn B-T, I-T vào violating_words
                if str_tag in ["B-T", "I-T"]:
                    violating_words.append(tokens[i])
                    max_prob = max(max_prob, tag_prob)
                    
            if violating_words:
                final_hate_score = max_prob
                
        except Exception as e:
            logger.error(f"Text NER eval error: {e}")

        return float(final_hate_score), violating_words, detailed_tags

    def evaluate_image(self, frame_bgr, frame_idx=None, second=None):
        h, w = frame_bgr.shape[:2]

        # ===== NSFW =====
        try:
            rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            resized_nsfw = cv2.resize(rgb, (224, 224))
            tensor_nsfw = torch.from_numpy(resized_nsfw).permute(2, 0, 1).float() / 255.0
            tensor_nsfw = tensor_nsfw.unsqueeze(0).to(device)

            with torch.no_grad():
                logits = self.nsfw_model(tensor_nsfw)
                nsfw_prob = torch.softmax(logits, dim=1)[0][1].item()
        except:
            nsfw_prob = 0.0

        # ===== VIOLENCE =====
        try:
            resized_viol = cv2.resize(rgb, (56, 56))
            tensor_viol = torch.from_numpy(resized_viol).permute(2, 0, 1).float() / 255.0
            tensor_viol = tensor_viol.unsqueeze(0).to(device)

            with torch.no_grad():
                logits = self.violence_model(tensor_viol)
                viol_prob = torch.softmax(logits, dim=1)[0][1].item()
        except:
            viol_prob = 0.0
            
        # ===== HATE SPEECH (OCR) =====
        # Chạy sau NSFW và Violence để đảm bảo ảnh gốc (frame_bgr) hoàn toàn nguyên vẹn, 
        # không bị bất kỳ can thiệp nào làm sai lệch tỉ lệ nhận diện NSFW/Violence.
        ocr_text = ""
        try:
            append_debug_line(f"[OCR] START frame={frame_idx} second={second}")

            # 1. Sử dụng thư viện gốc EasyOCR (mô hình CRAFT) để detector tìm vị trí khung chữ
            # Tắt detail=0 (vì muốn lấy box, set detail=1)
            # Khử bỏ text_threshold cao, dùng ngưỡng mặc định để không sót chữ
            detected_boxes = reader.readtext(frame_bgr, detail=1)

            valid_texts = []

            for idx, (bbox, _, prob) in enumerate(detected_boxes):
                # QUAN TRỌNG: Không dùng prob của EasyOCR để bỏ box nữa.
                # Vì prob này là điểm tự tin "nhận diện" của EasyOCR chứ không phải điểm "phát hiện" vùng chữ.
                # Nếu EasyOCR không dịch được tiếng Việt tốt -> prob sẽ thấp -> box sẽ bị skip oan uổng!

                # Lấy tọa độ
                (tl, tr, br, bl) = bbox
                tl = (max(0, int(tl[0])), max(0, int(tl[1])))
                br = (min(w-1, int(br[0])), min(h-1, int(br[1])))
                
                # Tránh các khung hình nhiễu méo mó làm sấp crop
                if br[1] - tl[1] <= 2 or br[0] - tl[0] <= 2:
                    continue

                # 2. Cắt (crop) vùng chữ tìm được từ ảnh gốc bgr (rgb color)
                crop_img = frame_bgr[tl[1]:br[1], tl[0]:br[0]]

                # Chuyển CV2 (BGR) sang PIL Image (RGB) cho Cỗ máy đọc VietOCR
                crop_img_rgb = cv2.cvtColor(crop_img, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(crop_img_rgb)

                # 3. Dùng VietOCR để đọc ảnh mảnh vừa crop
                text_predicted = vietocr_predictor.predict(pil_img)
                
                # Bỏ qua rác kí tự như @, ., s, v.v
                if text_predicted and len(text_predicted.strip()) > 1:
                    valid_texts.append(text_predicted)

            raw_text = " ".join(valid_texts)
            raw_text = unicodedata.normalize('NFC', raw_text)

            # 6. Làm sạch sơ bộ (loại bỏ khoảng trắng thừa)
            ocr_text = raw_text.strip()

            append_debug_line(
                f"[OCR] frame={frame_idx} sec={second} "
                f"raw={repr(raw_text)} clean={repr(ocr_text)} len={len(ocr_text)}"
            )

        except Exception as e:
            append_debug_line(f"[OCR ERROR] frame={frame_idx} error={str(e)}")
            
            
        nsfw_box = {"x1": 0, "y1": 0, "x2": w, "y2": h} if nsfw_prob > 0 else None
        viol_box = {"x1": 0, "y1": 0, "x2": w, "y2": h} if viol_prob > 0 else None

        return nsfw_prob, nsfw_box, viol_prob, viol_box, ocr_text

    def _download_file(self, url):
        if not url:
            return None

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                              "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
            }
            response = requests.get(url, headers=headers, timeout=30, stream=True)
            response.raise_for_status()

            path_lower = url.lower()
            suffix = ".jpg"
            if any(ext in path_lower for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]) or "video" in path_lower:
                suffix = ".mp4"
            elif ".png" in path_lower:
                suffix = ".png"
            elif ".webp" in path_lower:
                suffix = ".webp"

            content_type = (response.headers.get("Content-Type") or "").lower()
            if "video/" in content_type:
                suffix = ".mp4"
            elif "image/png" in content_type:
                suffix = ".png"
            elif "image/webp" in content_type:
                suffix = ".webp"
            elif "image/jpeg" in content_type:
                suffix = ".jpg"

            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        tmp.write(chunk)
                return tmp.name
        except Exception as e:
            logger.error(f"Download media failed for URL {url[:200]}: {e}")
            return None

    def moderate_request(self, content, image_url, video_url):
        # Result initialization
        print(f"\n[MODERATE_REQUEST] START")
        # Bỏ qua in content, image, video trực tiếp ra console để tránh lỗi Unicode
        # print(f"  Content: {content[:50] if content else 'None'}")
        # print(f"  Image URL: {image_url[:50] if image_url else 'None'}")
        # print(f"  Video URL: {video_url[:50] if video_url else 'None'}")
        append_debug_line("[REQUEST] /api/moderate called")
        append_debug_line(f"[REQUEST] has_content={bool(content)} has_image={bool(image_url)} has_video={bool(video_url)}")
        
        final_nsfw_score = 0.0
        final_viol_score = 0.0
        final_hate_score = 0.0
        final_nsfw_box = None
        final_viol_box = None
        final_hate_words = []
        all_detected_texts = []
        highest_score_frame_second = None
        total_frames_analyzed = 0

        # 1. Evaluate Text Content
        if content:
            append_debug_line(f"[CONTENT] len={len(content)} text={repr(content)}")
            all_detected_texts.append(content)
            print(f"[MODERATE_REQUEST] Added content text")

        # 2. Evaluate Image
        if image_url:
            print(f"[MODERATE_REQUEST] Processing image...")
            append_debug_line("[IMAGE] Start processing image_url")
            local_img = self._download_file(image_url)
            if local_img and os.path.exists(local_img):
                img = cv2.imread(local_img)
                if img is not None:
                    print(f"[MODERATE_REQUEST] Image loaded, running evaluate_image")
                    n_prob, n_box, v_prob, v_box, ocr_text = self.evaluate_image(img)
                    final_nsfw_score = max(final_nsfw_score, n_prob)
                    final_viol_score = max(final_viol_score, v_prob)
                    if n_prob > 0: final_nsfw_box = n_box
                    if v_prob > 0: final_viol_box = v_box
                    if ocr_text:
                        all_detected_texts.append(ocr_text)
                os.remove(local_img)
            else:
                append_debug_line("[IMAGE] Download/read failed, skip OCR")

        # 3. Evaluate Video (Requirement 3: 1 frame/sec, highest score frame represents video)
        if video_url:
            print(f"[MODERATE_REQUEST] Processing video...")
            append_debug_line("[VIDEO] Start processing video_url")
            local_vid = self._download_file(video_url)
            if local_vid and os.path.exists(local_vid):
                cap = cv2.VideoCapture(local_vid)
                if cap.isOpened():
                    fps = cap.get(cv2.CAP_PROP_FPS)
                    print(f"[MODERATE_REQUEST] Video FPS: {fps}")
                    append_debug_line(f"[VIDEO] Opened successfully, fps={fps}")
                    if fps <= 0: fps = 30
                    
                    best_vid_nsfw = 0.0
                    best_vid_viol = 0.0
                    best_vid_hate = 0.0
                    best_vid_nsfw_box = None
                    best_vid_viol_box = None
                    best_vid_ocr = ""
                    best_vid_hate_words = []
                    best_overall_score = -1.0
                    
                    frame_idx = 0
                    ocr_frame_count = 0
                    while True:
                        ret, frame = cap.read()
                        if not ret:
                            break
                        
                        # 1 frame per second
                        if frame_idx % max(1, int(fps)) == 0:
                            total_frames_analyzed += 1
                            print(f"[MODERATE_REQUEST] Analyzing frame {total_frames_analyzed}")
                            append_debug_line(f"[VIDEO] Analyze frame_index={frame_idx} sampled_index={total_frames_analyzed}")
                            current_second = int(frame_idx // fps)

                            n_prob, n_box, v_prob, v_box, ocr_text = self.evaluate_image(
                                frame,
                                frame_idx=frame_idx,
                                second=current_second
                            )
                            if ocr_text:
                                ocr_frame_count += 1
                            # temporary evaluate OCR to find if this frame is worst in hate speech
                            h_prob, frame_hate_words, _ = self.evaluate_text(ocr_text) if ocr_text else (0.0, [], [])
                            
                            frame_max_score = max(n_prob, v_prob, h_prob)
                            
                            if frame_max_score > best_overall_score:
                                best_overall_score = frame_max_score
                                best_vid_nsfw = n_prob
                                best_vid_viol = v_prob
                                best_vid_hate = h_prob
                                best_vid_nsfw_box = n_box
                                best_vid_viol_box = v_box
                                best_vid_ocr = ocr_text
                                best_vid_hate_words = frame_hate_words
                                highest_score_frame_second = int(frame_idx // fps)
                                
                        frame_idx += 1
                    cap.release()
                    append_debug_line(f"[OCR SUMMARY] frames_with_text={ocr_frame_count}")
                    print(f"[MODERATE_REQUEST] Total frames analyzed: {total_frames_analyzed}")
                    append_debug_line(f"[VIDEO] Total frames analyzed: {total_frames_analyzed}")
                    
                    final_nsfw_score = max(final_nsfw_score, best_vid_nsfw)
                    final_viol_score = max(final_viol_score, best_vid_viol)
                    if best_vid_nsfw > 0: final_nsfw_box = best_vid_nsfw_box
                    if best_vid_viol > 0: final_viol_box = best_vid_viol_box
                    if best_vid_ocr:
                        all_detected_texts.append(best_vid_ocr)
                    if best_vid_hate_words:
                        final_hate_words.extend(best_vid_hate_words)
                else:
                    append_debug_line("[VIDEO] cv2.VideoCapture could not open file")
                os.remove(local_vid)
            else:
                append_debug_line("[VIDEO] Download failed or temp file missing")

        # Aggregate texts and check hate speech
        combined_text = " ".join(all_detected_texts)
        append_debug_line(
            f"[FINAL TEXT] len={len(combined_text)} text={repr(combined_text[:200])}"
        )
        hate_score, hate_words, detailed_tags = self.evaluate_text(combined_text)
        final_hate_score = max(final_hate_score, hate_score)
        final_hate_words = list(set(final_hate_words + hate_words))

        best_score = max(final_nsfw_score, final_viol_score, final_hate_score)
        
        # Tạo chuỗi phản hồi các tags (VD: con[O] chó[B-T] ...)
        # Hoặc dùng json.dumps(detailed_tags) nếu cần. Ở đây nối thành chuỗi cho dễ đọc trên CSDL
        detailed_tags_str = " ".join([f"{item['word']}[{item['tag']}]" for item in detailed_tags]) if detailed_tags else ""
        
        # Thay vì chỉ lưu các từ vi phạm (VD: "chó"), ta lưu thẳng toàn bộ kết quả phân tích BIO của câu vào chung
        # biến mà Java backend đang đọc ('hate_speech_word') để Java lưu thẳng lên CSDL
        violating_words_str = detailed_tags_str if final_hate_words else ""

        print(f"[MODERATE_REQUEST] COMPLETE - best_score={best_score:.4f}\n")
        append_debug_line(f"[REQUEST] Complete best_score={best_score:.4f} frames={total_frames_analyzed} violating_words={violating_words_str} detailed_tags={detailed_tags_str}")

        return {
            "nsfw_score": float(final_nsfw_score),
            "violence_score": float(final_viol_score),
            "hatespeech_score": float(final_hate_score),
            "best_score": float(best_score),
            "detected_text": combined_text,
            "nsfw_box": final_nsfw_box,
            "violen_box": final_viol_box,
            "hate_speech_word": violating_words_str,
            "hate_speech_details": detailed_tags_str, # Trả về API chuỗi phân tích chi tiết (B-T, I-T, O)
            "highest_score_frame_second": highest_score_frame_second,
            "total_frames_analyzed": total_frames_analyzed
        }

sys_mod = ContentModerationSystem()

@app.route("/health", methods=["GET"])
def health_endpoint():
    return jsonify({"status": "ok"}), 200

@app.route("/api/moderate", methods=["POST"])
def moderate_endpoint():
    # print(f"[API] Nhận được request moderation")
    data = request.json or {}
    content = data.get("content", "")
    img = data.get("imageUrl", "")
    vid = data.get("videoUrl", "")
    
    # Bỏ qua in content ra console
    # print(f"[API] Content: {content[:100] if content else 'None'}")
    # print(f"[API] Image URL: {img[:100] if img else 'None'}")
    # print(f"[API] Video URL: {vid[:100] if vid else 'None'}")
    
    res = sys_mod.moderate_request(content, img, vid)
    
    print(f"[API] Moderation complete, returning result")
    return jsonify(res)

if __name__ == "__main__":
    # print(f"[MAIN] Khởi động Flask app tại http://127.0.0.1:5000")
    # print(f"[MAIN] Debug file sẽ được tạo tại: {DEBUG_FILE}")
    append_debug_line("[MAIN] Flask startup")
    app.run(host="127.0.0.1", port=5000, debug=False)
