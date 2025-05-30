
from flask import send_from_directory
from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import os,time
import base64
import threading
import uuid
from io import BytesIO
from diffusers import StableDiffusionPipeline

app = Flask(__name__)
CORS(app, supports_credentials=True)


IMAGE_DIR = os.path.join(os.path.dirname(__file__), "generated_images")
os.makedirs(IMAGE_DIR, exist_ok=True)

# Define model path
model_path = "C:/Users/ayushi Jalkhare/.cache/huggingface/hub/sd-turbo"

# Detect device
device = "cuda" if torch.cuda.is_available() else "cpu"

# Dictionary to store active requests (Thread-Safe)
active_requests = {}
request_lock = threading.Lock()

try:
    pipe = StableDiffusionPipeline.from_pretrained(
        model_path, 
        local_files_only=True, 
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
    ).to(device)

    # Disable safety checker (optional)
    pipe.safety_checker = None  

    print("✅ Optimized model loaded successfully!")

except Exception as e:
    print(f"❌ Error loading model: {e}")
    exit(1)

pending_events = []


import requests
from datetime import datetime

def generate_image_threaded(request_id, prompt, num_images, user_id):
    images_filenames = []

    try:
        user_folder = os.path.join(IMAGE_DIR, user_id)
        os.makedirs(user_folder, exist_ok=True)

        for _ in range(num_images):
            with request_lock:
                if request_id not in active_requests:
                    print(f"⚠️ Request {request_id} was canceled!")
                    return

            image = pipe(prompt, num_inference_steps=5, guidance_scale=7.5).images[0]
            filename = f"{uuid.uuid4().hex}.png"
            image_path = os.path.join(user_folder, filename)
            image.save(image_path)
            print(f"✅ Image saved: {image_path}")    

            images_filenames.append(f"{user_id}/{filename}")

        with request_lock:
            active_requests[request_id] = images_filenames

        print("✅ Image generation completed successfully!")

        # Notify Node.js via HTTP POST
        payload = {
            "request_id": request_id,
            "images": images_filenames,
            "timestamp": datetime.now().isoformat(),
            "error": None
        }

        response = requests.post("http://localhost:5000/image-generated-callback", json=payload)
        print(f"📤 Notified Node.js: {response.status_code}")

    except Exception as e:
        print(f"❌ Error in image generation thread: {e}")
        with request_lock:
            active_requests[request_id] = "failed"

        payload = {
            "request_id": request_id,
            "images": [],
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }

        response = requests.post("http://localhost:5000/image-generated", json=payload)
        print(f"📤 Notified Node.js about error: {response.status_code}")
   

@app.route("/generate-image", methods=["POST"])
def generate_image():
    data = request.json
    prompt = data.get("prompt")
    user_id = data.get("user_id", "guest")  # Fallback to guest
    print("📥 Received user_id in Flask:", user_id)
    try:
        num_images = int(data.get("num_images", 1))
        if num_images <= 0 or num_images > 4:
            return jsonify({"error": "num_images must be between 1 and 4"}), 400
    except ValueError:
        return jsonify({"error": "num_images must be an integer"}), 400

    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    request_id = data.get("request_id", str(uuid.uuid4()))  # use passed request_id or create new

    with request_lock:
        active_requests[request_id] = "processing"


    print(f"📌 New Image Generation Request: {request_id} by user {user_id}")

    thread = threading.Thread(target=generate_image_threaded, args=(request_id, prompt, num_images, user_id))
    thread.daemon = True
    thread.start()

    print(f"✅ Sending response for request_id: {request_id}")
    return jsonify({ "request_id": request_id, "status": "processing" })

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001)

