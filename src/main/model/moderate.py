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
import subprocess
import librosa
import soundfile as sf
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

class MfccHatespeechModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.embedding = nn.Linear(50000, 128)
        self.conv1 = nn.Conv1d(128, 128, kernel_size=8, padding='same')
        self.bn1 = nn.BatchNorm1d(128)
        self.relu1 = nn.ReLU()
        self.conv2 = nn.Conv1d(128, 128, kernel_size=8, padding='same')
        self.bn2 = nn.BatchNorm1d(128)
        self.relu2 = nn.ReLU()
        self.conv3 = nn.Conv1d(128, 64, kernel_size=4, padding='same')
        self.bn3 = nn.BatchNorm1d(64)
        self.relu3 = nn.ReLU()
        self.conv4 = nn.Conv1d(64, 32, kernel_size=4, padding='same')
        self.bn4 = nn.BatchNorm1d(32)
        self.relu4 = nn.ReLU()
        self.lstm1 = nn.LSTM(input_size=32, hidden_size=128, batch_first=True, bidirectional=True)
        self.lstm2 = nn.LSTM(input_size=256, hidden_size=64, batch_first=True, bidirectional=True)
        self.fc1 = nn.Linear(128, 64)
        self.relu_fc1 = nn.ReLU()
        self.fc2 = nn.Linear(64, 16)
        self.relu_fc2 = nn.ReLU()
        self.fc3 = nn.Linear(16, 3)

    def forward(self, x):
        x = self.embedding(x)
        x = x.unsqueeze(2)
        x = self.relu1(self.bn1(self.conv1(x)))
        x = self.relu2(self.bn2(self.conv2(x)))
        x = self.relu3(self.bn3(self.conv3(x)))
        x = self.relu4(self.bn4(self.conv4(x)))
        x = x.transpose(1, 2)
        x, _ = self.lstm1(x)
        x, _ = self.lstm2(x)
        x = x[:, -1, :]
        x = self.relu_fc1(self.fc1(x))
        x = self.relu_fc2(self.fc2(x))
        x = self.fc3(x)
        return x

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
        # Try load audio-based ViHSD model (mfcc features)
        self.audio_model = None
        self.audio_model_is_tf = False
        try:
            # prefer a PyTorch .pt file if present
            torch_path = os.path.join(base_dir, 'mfcc_hatespeech_model.pt')
            h5_path = os.path.join(base_dir, 'mfcc_hatespeech_model.h5')
            saved_dir = os.path.join(base_dir, 'mfcc_hatespeech_model')

            if os.path.exists(torch_path):
                try:
                    loaded = torch.load(torch_path, map_location=device)
                    # if it's a Module instance
                    if isinstance(loaded, nn.Module):
                        self.audio_model = loaded.to(device)
                        self.audio_model.eval()
                        append_debug_line("[INIT] Loaded MFCC hatespeech PyTorch model")
                        logger.info("Loaded MFCC hatespeech PyTorch model")
                    else:
                        # Dictionary. Load weights into our MfccHatespeechModel class
                        try:
                            model = MfccHatespeechModel()
                            weights = loaded['weights']
                            
                            # Map weights
                            model.embedding.weight.data = weights[0].T.clone().detach().contiguous()
                            
                            # Conv 1
                            model.conv1.weight.data = weights[1].permute(2, 1, 0).clone().detach().contiguous()
                            model.conv1.bias.data = weights[2].clone().detach().contiguous()
                            # BN 1
                            model.bn1.weight.data = weights[3].clone().detach().contiguous()
                            model.bn1.bias.data = weights[4].clone().detach().contiguous()
                            model.bn1.running_mean.data = weights[5].clone().detach().contiguous()
                            model.bn1.running_var.data = weights[6].clone().detach().contiguous()
                            
                            # Conv 2
                            model.conv2.weight.data = weights[7].permute(2, 1, 0).clone().detach().contiguous()
                            model.conv2.bias.data = weights[8].clone().detach().contiguous()
                            # BN 2
                            model.bn2.weight.data = weights[9].clone().detach().contiguous()
                            model.bn2.bias.data = weights[10].clone().detach().contiguous()
                            model.bn2.running_mean.data = weights[11].clone().detach().contiguous()
                            model.bn2.running_var.data = weights[12].clone().detach().contiguous()
                            
                            # Conv 3
                            model.conv3.weight.data = weights[13].permute(2, 1, 0).clone().detach().contiguous()
                            model.conv3.bias.data = weights[14].clone().detach().contiguous()
                            # BN 3
                            model.bn3.weight.data = weights[15].clone().detach().contiguous()
                            model.bn3.bias.data = weights[16].clone().detach().contiguous()
                            model.bn3.running_mean.data = weights[17].clone().detach().contiguous()
                            model.bn3.running_var.data = weights[18].clone().detach().contiguous()
                            
                            # Conv 4
                            model.conv4.weight.data = weights[19].permute(2, 1, 0).clone().detach().contiguous()
                            model.conv4.bias.data = weights[20].clone().detach().contiguous()
                            # BN 4
                            model.bn4.weight.data = weights[21].clone().detach().contiguous()
                            model.bn4.bias.data = weights[22].clone().detach().contiguous()
                            model.bn4.running_mean.data = weights[23].clone().detach().contiguous()
                            model.bn4.running_var.data = weights[24].clone().detach().contiguous()
                            
                            # BiLSTM 1
                            model.lstm1.weight_ih_l0.data = weights[25].T.clone().detach().contiguous()
                            model.lstm1.weight_hh_l0.data = weights[26].T.clone().detach().contiguous()
                            model.lstm1.bias_ih_l0.data = weights[27].clone().detach().contiguous()
                            model.lstm1.bias_hh_l0.data = torch.zeros(512).contiguous()
                            model.lstm1.weight_ih_l0_reverse.data = weights[28].T.clone().detach().contiguous()
                            model.lstm1.weight_hh_l0_reverse.data = weights[29].T.clone().detach().contiguous()
                            model.lstm1.bias_ih_l0_reverse.data = weights[30].clone().detach().contiguous()
                            model.lstm1.bias_hh_l0_reverse.data = torch.zeros(512).contiguous()
                            
                            # BiLSTM 2
                            model.lstm2.weight_ih_l0.data = weights[31].T.clone().detach().contiguous()
                            model.lstm2.weight_hh_l0.data = weights[32].T.clone().detach().contiguous()
                            model.lstm2.bias_ih_l0.data = weights[33].clone().detach().contiguous()
                            model.lstm2.bias_hh_l0.data = torch.zeros(256).contiguous()
                            model.lstm2.weight_ih_l0_reverse.data = weights[34].T.clone().detach().contiguous()
                            model.lstm2.weight_hh_l0_reverse.data = weights[35].T.clone().detach().contiguous()
                            model.lstm2.bias_ih_l0_reverse.data = weights[36].clone().detach().contiguous()
                            model.lstm2.bias_hh_l0_reverse.data = torch.zeros(256).contiguous()
                            
                            # FC Layers
                            model.fc1.weight.data = weights[37].T.clone().detach().contiguous()
                            model.fc1.bias.data = weights[38].clone().detach().contiguous()
                            
                            model.fc2.weight.data = weights[39].T.clone().detach().contiguous()
                            model.fc2.bias.data = weights[40].clone().detach().contiguous()
                            
                            model.fc3.weight.data = weights[41].T.clone().detach().contiguous()
                            model.fc3.bias.data = weights[42].clone().detach().contiguous()
                            
                            self.audio_model = model.to(device)
                            self.audio_model.eval()
                            
                            append_debug_line("[INIT] Successfully loaded and mapped MFCC hatespeech PyTorch model from weights dict")
                            logger.info("Successfully loaded and mapped MFCC hatespeech PyTorch model from weights dict")
                        except Exception as e_map:
                            logger.error(f"Error mapping weights dict to MfccHatespeechModel: {e_map}")
                except Exception as e:
                    logger.error(f"Error torch.load mfcc_hatespeech_model.pt: {e}")

            # If no PyTorch module loaded, try Keras HDF5/SavedModel
            if self.audio_model is None:
                try:
                    import tensorflow as _tf
                    from tensorflow import keras as _keras
                    # HDF5 format
                    if os.path.exists(h5_path):
                        self.audio_model = _keras.models.load_model(h5_path)
                        self.audio_model_is_tf = True
                        append_debug_line("[INIT] Loaded MFCC hatespeech Keras .h5 model")
                        logger.info("Loaded MFCC hatespeech Keras .h5 model")
                    # SavedModel directory
                    elif os.path.isdir(saved_dir):
                        try:
                            self.audio_model = _keras.models.load_model(saved_dir)
                            self.audio_model_is_tf = True
                            append_debug_line("[INIT] Loaded MFCC hatespeech Keras SavedModel")
                            logger.info("Loaded MFCC hatespeech Keras SavedModel")
                        except Exception as e:
                            logger.error(f"Failed loading Keras SavedModel dir: {e}")
                except Exception as e:
                    # Tensorflow not available or model load failed
                    logger.info(f"TensorFlow/Keras not available or model not found: {e}")
        except Exception as e:
            logger.error(f"Error loading mfcc_hatespeech_model: {e}")
            
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
            return 0.0, [], [], 0
        
        # Lọc bỏ nhiễu OCR
        clean_text = self.clean_vietnamese_ocr_text(text)
        
        if not clean_text:
            return 0.0, [], [], 0
        
        final_hate_score = 0.0
        text_label = 0
        violating_words = []
        detailed_tags = [] # Chứa định dạng [{"word": "...", "tag": "..."}]
        
        try:
            tokens = clean_text.split()
            if not tokens:
                return 0.0, [], [], 0

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
            
            # Danh sách các gốc từ độc hại/nhạy cảm để loại bỏ false positive từ mô hình PhoBERT NER đối với OCR nhiễu
            TOXIC_ROOTS = [
                "địt", "đụ", "đéo", "ngu", "chết", "giết", "súc vật", "xúc vật", "mày", "tao",
                "cút", "chó", "đấm", "đánh", "nigger", "faggot", "kill", "hate", "khốn", 
                "lồn", "buồi", "cặc", "đĩ", "cave", "phò", "hãm", "vú", "cu", "dâm", 
                "cmn", "vcl", "vl", "đệt", "mẹ mày", "bố mày", "óc chó", "dòi", "rác", "ngốc", "khùng", "điên"
            ]

            probs_0 = []
            probs_1 = []
            probs_2 = []
            
            for i, word_idx in enumerate(word_starts):
                pred_tag = preds[word_idx]
                tag_prob = probs[word_idx][pred_tag].item()
                
                word = tokens[i]

                # Lọc false positive từ OCR
                has_vn_accent = re.search(r'[àáảãạâầấẩẫậăằắẳẵặêềếểễệèéẻẽẹìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', word.lower())
                is_ocr_garbage = len(word) >= 10 and not has_vn_accent
                
                if is_ocr_garbage:
                    continue  # Xóa hoàn toàn từ này khỏi kết quả trả về

                # Kiểm tra xem từ đó có chứa bất kỳ gốc từ độc hại nào không
                is_toxic_word = False
                w_lower = word.lower()
                for root in TOXIC_ROOTS:
                    if " " in root:
                        if root in clean_text.lower() and w_lower in root:
                            is_toxic_word = True
                            break
                    else:
                        # Đối với các từ chửi bới rất đặc thù, cho phép khớp chuỗi con (substring)
                        if root in ["địt", "đụ", "đéo", "lồn", "cặc", "buồi", "đĩ", "cave", "phò"]:
                            if root in w_lower:
                                is_toxic_word = True
                                break
                        else:
                            # Đối với các từ dễ trùng âm/syllable sạch (cu, ngu, rác...), yêu cầu khớp chính xác từ
                            if w_lower == root:
                                is_toxic_word = True
                                break

                # Nếu PhoBERT gán nhãn vi phạm nhưng thực tế từ không nằm trong tập nhạy cảm -> override về sạch
                if (pred_tag == 1 or pred_tag == 2) and not is_toxic_word:
                    pred_tag = 0

                str_tag = id2tag.get(pred_tag, "O")

                # Lưu toàn bộ cấu trúc câu cùng với Tag để nhét vào Database
                detailed_tags.append({"word": word, "tag": str_tag})
                
                # Collect probabilities for hierarchical score calculation
                p0 = probs[word_idx][0].item()
                p1 = probs[word_idx][1].item()
                p2 = probs[word_idx][2].item()
                
                if pred_tag == 2:
                    probs_2.append(p2)
                    violating_words.append(word)
                elif pred_tag == 1:
                    probs_1.append(p1)
                    violating_words.append(word)
                else:
                    probs_0.append(p0)
                    
            if probs_2:
                final_hate_score = max(probs_2)
                text_label = 2
            elif probs_1:
                final_hate_score = max(probs_1)
                text_label = 1
            elif probs_0:
                final_hate_score = max(probs_0)
                text_label = 0
            else:
                final_hate_score = 0.0
                text_label = 0
                
        except Exception as e:
            logger.error(f"Text NER eval error: {e}")

        return float(final_hate_score), violating_words, detailed_tags, text_label

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

    def _extract_audio(self, video_path):
        """Extract audio from video file using ffmpeg; returns path to wav file or None."""
        if not video_path or not os.path.exists(video_path):
            return None
        try:
            wav_tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
            wav_tmp.close()
            cmd = [
                'ffmpeg', '-y', '-i', video_path,
                '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', wav_tmp.name
            ]
            proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
            if proc.returncode != 0:
                logger.error(f"ffmpeg failed: {proc.stderr.decode('utf-8', errors='ignore')}")
                try:
                    os.unlink(wav_tmp.name)
                except:
                    pass
                return None
            return wav_tmp.name
        except Exception as e:
            logger.error(f"Audio extract error: {e}")
            return None

    def _compute_speech_probs(self, wav_path):
        """Compute MFCC and run the audio model to get 3-class probabilities.
        Returns a dict {'clean':p0,'offensive':p1,'hate':p2} or None on failure.
        """
        if not wav_path or not os.path.exists(wav_path) or self.audio_model is None:
            return None
        try:
            y, sr = librosa.load(wav_path, sr=16000)
            if len(y) == 0:
                return {'clean': 1.0, 'offensive': 0.0, 'hate': 0.0}
            
            # Check for silence or near-silence using RMS energy
            rms = np.sqrt(np.mean(y**2))
            if rms < 0.002:
                return {'clean': 1.0, 'offensive': 0.0, 'hate': 0.0}

            # compute MFCCs (n_mfcc=40)
            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)
            # normalize
            mfcc = (mfcc - mfcc.mean()) / (mfcc.std() + 1e-6)
            
            # The loaded PyTorch model MfccHatespeechModel expects flat input of size 50000
            mfcc_flat = mfcc.flatten()
            if len(mfcc_flat) < 50000:
                mfcc_flat = np.pad(mfcc_flat, (0, 50000 - len(mfcc_flat)), mode='constant')
            else:
                mfcc_flat = mfcc_flat[:50000]
                
            # PyTorch path: shape => (1, 50000)
            tensor = torch.tensor(mfcc_flat, dtype=torch.float32).unsqueeze(0).to(device)
            with torch.no_grad():
                logits = self.audio_model(tensor)
                probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]
                
            # ensure length 3
            if len(probs) >= 3:
                p0, p1, p2 = float(probs[0]), float(probs[1]), float(probs[2])
                return {'clean': p0, 'offensive': p1, 'hate': p2}
            else:
                return None
        except Exception as e:
            logger.error(f"Compute speech probs error: {e}")
            return None

    def moderate_request(self, content, image_url, video_url):
        # Result initialization
        print(f"\n[MODERATE_REQUEST] START")
        append_debug_line("[REQUEST] /api/moderate called")
        append_debug_line(f"[REQUEST] has_content={bool(content)} has_image={bool(image_url)} has_video={bool(video_url)}")
        
        final_nsfw_score = 0.0
        final_viol_score = 0.0
        final_hate_score = 0.0
        final_nsfw_box = None
        final_viol_box = None
        
        content_hate_text = ""
        video_hate_text = ""
        
        highest_score_frame_index = None
        total_frames = 0
        total_frames_analyzed = 0
        fps = 30.0

        speech_probs = None
        speech_label = None
        speech_score = None

        # 1. Evaluate Text Content
        if content:
            append_debug_line(f"[CONTENT] len={len(content)} text={repr(content)}")
            content_hate_text = content
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
                        # Ghép OCR ảnh vào phần Video/Text chung
                        video_hate_text = (video_hate_text + " " + ocr_text).strip()
                os.remove(local_img)
            else:
                append_debug_line("[IMAGE] Download/read failed, skip OCR")

        # 3. Evaluate Video
        if video_url:
            print(f"[MODERATE_REQUEST] Processing video...")
            append_debug_line("[VIDEO] Start processing video_url")
            local_vid = self._download_file(video_url)
            if local_vid and os.path.exists(local_vid):
                # Try extract audio and compute ViHSD speech probabilities
                audio_wav = self._extract_audio(local_vid)
                if audio_wav:
                    speech_probs = self._compute_speech_probs(audio_wav)
                    try:
                        os.remove(audio_wav)
                    except:
                        pass
                    if speech_probs:
                        # choose label by highest prob
                        label = max(speech_probs.items(), key=lambda x: x[1])[0]
                        # Map string label to integer label: 'clean' -> 0, 'offensive' -> 1, 'hate' -> 2
                        label_mapping = {'clean': 0, 'offensive': 1, 'hate': 2}
                        speech_label = label_mapping.get(label, 0)
                        speech_score = float(speech_probs.get(label, 0.0))
                        
                        label_names = {0: "CLEAN", 1: "OFFENSIVE", 2: "HATE"}
                        lbl_str = label_names.get(speech_label, "CLEAN")
                        append_debug_line(f"[VIHSD_SPEECH] label={lbl_str} score={speech_score:.6f} probs={speech_probs}")
                    else:
                        append_debug_line("[VIHSD_SPEECH] Speech evaluation failed (probs is None)")
                else:
                    append_debug_line("[VIHSD_SPEECH] Audio track not found or extraction failed")
                speech_probs = None if 'speech_probs' not in locals() else speech_probs
                speech_label = None if 'speech_label' not in locals() else speech_label
                speech_score = None if 'speech_score' not in locals() else speech_score
                cap = cv2.VideoCapture(local_vid)
                if cap.isOpened():
                    fps = cap.get(cv2.CAP_PROP_FPS)
                    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    print(f"[MODERATE_REQUEST] Video FPS: {fps}")
                    append_debug_line(f"[VIDEO] Opened successfully, fps={fps}")
                    if fps <= 0: fps = 30.0
                    
                    best_vid_nsfw = 0.0
                    best_vid_viol = 0.0
                    best_vid_hate = 0.0
                    best_vid_ocr = ""
                    best_overall_score = -1.0
                    
                    frame_idx = 0
                    ocr_frame_count = 0
                    while True:
                        ret, frame = cap.read()
                        if not ret:
                            break
                        
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
                            
                            # Đánh giá hate speech ngay cho frame này
                            if ocr_text:
                                h_prob, _, _, text_label = self.evaluate_text(ocr_text)
                                # Log to kiem_tra_ocr.txt
                                label_names = {0: "CLEAN", 1: "OFFENSIVE", 2: "HATE"}
                                lbl_str = label_names.get(text_label, "CLEAN")
                                append_debug_line(f"[OCR] frame={frame_idx} sec={current_second} text={repr(ocr_text)}")
                                append_debug_line(f"[EVAL] label={lbl_str} score={h_prob:.6f}")
                            else:
                                h_prob = 0.0
                                text_label = 0
                            
                            # Tìm khung hình có vi phạm cao nhất (bất kỳ mô hình nào)
                            frame_max_score = max(n_prob, v_prob, h_prob)
                            
                            if frame_max_score > best_overall_score:
                                best_overall_score = frame_max_score
                                best_vid_nsfw = n_prob
                                best_vid_viol = v_prob
                                best_vid_hate = h_prob
                                best_vid_nsfw_box = n_box
                                best_vid_viol_box = v_box
                                best_vid_ocr = ocr_text
                                highest_score_frame_index = frame_idx
                                
                            if ocr_text:
                                ocr_frame_count += 1

                        frame_idx += 1
                    cap.release()
                    append_debug_line(f"[OCR SUMMARY] frames_with_text={ocr_frame_count}")
                    print(f"[MODERATE_REQUEST] Total frames analyzed: {total_frames_analyzed}")
                    append_debug_line(f"[VIDEO] Total frames analyzed: {total_frames_analyzed}")
                    
                    final_nsfw_score = max(final_nsfw_score, best_vid_nsfw)
                    final_viol_score = max(final_viol_score, best_vid_viol)
                    if best_vid_nsfw > 0: final_nsfw_box = best_vid_nsfw_box
                    if best_vid_viol > 0: final_viol_box = best_vid_viol_box
                    
                    # Video hate text chỉ lấy từ frame có score cao nhất
                    video_hate_text = best_vid_ocr
                else:
                    append_debug_line("[VIDEO] cv2.VideoCapture could not open file")
                os.remove(local_vid)
            else:
                append_debug_line("[VIDEO] Download failed or temp file missing")

        # 4. Evaluate Hate Speech Separately
        if not video_url:
            append_debug_line("[VIHSD_SPEECH] Post does not contain video/audio")
        # Content
        c_hate_score, _, c_detailed_tags, c_label = self.evaluate_text(content_hate_text)
        content_hate_str = " ".join([f"{item['word']}[{item['tag']}]" for item in c_detailed_tags]) if c_detailed_tags else ""
        if content_hate_text:
            label_names = {0: "CLEAN", 1: "OFFENSIVE", 2: "HATE"}
            append_debug_line(f"[OCR] content text={repr(content_hate_text)}")
            append_debug_line(f"[EVAL] label={label_names.get(c_label, 'CLEAN')} score={c_hate_score:.6f}")
        
        # Video (including image OCR from best frame or single image)
        v_hate_score, _, v_detailed_tags, v_label = self.evaluate_text(video_hate_text)
        video_hate_str = " ".join([f"{item['word']}[{item['tag']}]" for item in v_detailed_tags]) if v_detailed_tags else ""
        if video_hate_text:
            label_names = {0: "CLEAN", 1: "OFFENSIVE", 2: "HATE"}
            append_debug_line(f"[OCR] video/image text={repr(video_hate_text)}")
            append_debug_line(f"[EVAL] label={label_names.get(v_label, 'CLEAN')} score={v_hate_score:.6f}")
        # Text OCR hatespeech score
        final_hate_score = max(c_hate_score, v_hate_score)

        # Calculate best_score: ignore speech if speech_label is 0, and ignore text if text label is 0
        best_score = max(final_nsfw_score, final_viol_score)
        if speech_probs is not None and speech_label != 0:
            best_score = max(best_score, speech_score)
        if content_hate_text and c_label != 0:
            best_score = max(best_score, c_hate_score)
        if video_hate_text and v_label != 0:
            best_score = max(best_score, v_hate_score)

        print(f"[MODERATE_REQUEST] COMPLETE - best_score={best_score:.4f}\n")
        
        combined_text = (content_hate_text + " " + video_hate_text).strip()
        append_debug_line(
            f"[FINAL TEXT] len={len(combined_text)} text={repr(combined_text[:200])}"
        )
        
        detailed_tags_str = f"(Video:){video_hate_str} (Content:){content_hate_str}"
        append_debug_line(f"[REQUEST] Complete best_score={best_score:.4f} frames={total_frames_analyzed} violating_words={detailed_tags_str} detailed_tags={detailed_tags_str}")

        hatespeech_label = int(max(c_label, v_label))

        return {
            "nsfw_score": float(final_nsfw_score),
            "violence_score": float(final_viol_score),
            "hatespeech_score": float(final_hate_score),
            "hatespeech_label": hatespeech_label,
            "speech_probs": speech_probs,
            "speech_label": speech_label,
            "speech_score": speech_score,
            "best_score": float(best_score),
            "detected_text": (content_hate_text + " " + video_hate_text).strip(),
            "nsfw_box": final_nsfw_box,
            "violen_box": final_viol_box,
            "video_hate_speech": video_hate_str,
            "content_hate_speech": content_hate_str,
            "hate_speech_word": f"(Video:){video_hate_str} (Content:){content_hate_str}",
            "highest_score_frame": highest_score_frame_index,
            "total_frames": total_frames,
            "fps": float(fps)
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
