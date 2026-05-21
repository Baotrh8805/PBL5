import requests
import json

url = "http://127.0.0.1:5000/api/moderate"
payload = {
    "content": "",
    "imageUrl": "https://res.cloudinary.com/dptmicerz/image/upload/v1779250923/kkzdiat2vqeg1yoldzko.jpg",
    "videoUrl": ""
}

try:
    print("Sending request to Python Flask server...")
    response = requests.post(url, json=payload, timeout=30)
    print(f"Status Code: {response.status_code}")
    data = response.json()
    with open("scratch/response_post182.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Successfully wrote response to scratch/response_post182.json")
except Exception as e:
    print(f"Error: {e}")
