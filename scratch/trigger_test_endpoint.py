import requests
import time

url = "http://localhost:8080/api/posts/test-moderate-direct"
params = {
    "postId": 174,
    "content": "con chó ngu ngốc nhà mày",
    "videoUrl": "https://res.cloudinary.com/dptmicerz/video/upload/v1778895304/dprl2ekxqwtcoicruy2n.mp4"
}

try:
    print("Triggering Java moderation for post 174...")
    response = requests.get(url, params=params, timeout=10)
    print("Java Server response:", response.status_code, response.text)
    
    print("Waiting 10 seconds for asynchronous moderation execution...")
    time.sleep(10)
    
    print("Finished checking.")
except Exception as e:
    print("Error:", e)
