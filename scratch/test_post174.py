import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "http://localhost:5000/api/moderate"
payload = {
    "content": "con chó ngu ngốc nhà mày",
    "imageUrl": None,
    "videoUrl": "https://res.cloudinary.com/dptmicerz/video/upload/v1778895304/dprl2ekxqwtcoicruy2n.mp4"
}

headers = {
    "Content-Type": "application/json"
}

try:
    print("Sending moderation request...")
    response = requests.post(url, json=payload, headers=headers, timeout=300)
    print("Status Code:", response.status_code)
    data = response.json()
    with open("scratch/response_post174.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Saved response to scratch/response_post174.json")
except Exception as e:
    print("Error:", e)
