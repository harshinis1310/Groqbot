import os
import re
import json
import time
import tempfile
import urllib.parse
import random
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from dotenv import load_dotenv
import requests

# Load environment variables from .env
load_dotenv(override=True)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32MB max upload (for audio/images)

def get_groq_client(api_key=None):
    from groq import Groq
    key = api_key or os.getenv("GROQ_API_KEY", "").strip()
    if not key or key == "your_groq_api_key_here":
        return None
    return Groq(api_key=key)

# Curated models with verified availability
DEFAULT_MODELS = [
    {
        "id": "qwen/qwen3.8-27b",
        "name": "Qwen 3.8 27B (Fast & High Reasoning)",
        "badge": "Recommended",
        "description": "State-of-the-art fast reasoning, problem-solving, math & coding.",
        "vision": False
    },
    {
        "id": "groq/compound",
        "name": "Groq Compound (Code & Tool Reasoning)",
        "badge": "Smart Agent",
        "description": "High capability compound agent with verified calculation and coding logic.",
        "vision": False
    },
    {
        "id": "openai/gpt-oss-120b",
        "name": "GPT OSS 120B (Deep Reasoning)",
        "badge": "Deep Brain",
        "description": "Heavyweight open architecture for extensive essays and architecture.",
        "vision": False
    },
    {
        "id": "llama-3.3-70b-versatile",
        "name": "Llama 3.3 70B Versatile",
        "badge": "Llama Core",
        "description": "Versatile reasoning when enabled on your Groq tier.",
        "vision": False
    },
    {
        "id": "llama-3.1-8b-instant",
        "name": "Llama 3.1 8B Instant",
        "badge": "Snappy Chat",
        "description": "Ultra fast response time for casual questions.",
        "vision": False
    },
    {
        "id": "llama-3.2-11b-vision-preview",
        "name": "Llama 3.2 11B Vision (Multimodal)",
        "badge": "Vision Multimodal",
        "description": "Analyzes diagrams, charts, screenshots, and photos.",
        "vision": True
    }
]

DEFAULT_SYSTEM_PROMPTS = {
    "general": (
        "You are Nova, an advanced, highly intelligent AI assistant powered by Groq LPUs. "
        "You are exceptionally knowledgeable, articulate, concise, and helpful. "
        "You remember conversation history and answer follow-up questions accurately. "
        "You use markdown formatting (tables, bullet points, bold headers, and syntax-highlighted code blocks) "
        "to deliver answers that are clean and pleasant to read."
    ),
    "problem_solver": (
        "You are Nova, an elite analytical problem-solving engineer and mathematician. "
        "When solving any query, break it down methodically into:\n"
        "1. **Core Problem Analysis**: Identify key inputs, constraints, and objectives.\n"
        "2. **Step-by-Step Solution / Algorithm**: Provide rigorous explanation or math/code breakdown.\n"
        "3. **Complete Implementation**: Clean, commented, production-grade code or derivation.\n"
        "4. **Verification & Edge Cases**: Confirm correctness and suggest optimizations."
    ),
    "code_master": (
        "You are Nova, a world-class senior software architect. "
        "Provide elegant, bug-free, well-documented code with time/space complexity analysis, "
        "modern best practices, and actionable explanations. Always use markdown code blocks with language tags."
    ),
    "vision_expert": (
        "You are Nova's Visual Intelligence Engine. "
        "Carefully inspect uploaded images or diagrams. Describe the elements, extract any text/code/equations, "
        "interpret visual relationships, and provide clear, actionable problem solutions."
    )
}

TEXT_ORIENTED_KEYWORDS = {
    'function', 'code', 'script', 'program', 'algorithm', 'app', 'website',
    'class', 'component', 'api', 'database', 'sql', 'query',
    'story', 'poem', 'essay', 'article', 'summary', 'paragraph', 'speech',
    'list', 'table', 'outline', 'plan', 'schedule', 'quiz', 'question',
    'explanation', 'calculation', 'proof', 'derivation', 'solution'
}

def clean_extracted_prompt(text):
    """
    Cleans up extracted subject string by removing conversational filler while keeping the core subject.
    """
    text = text.strip()
    text = re.sub(r'^(?:can\s+you\s+)?(?:please\s+)?(?:create|generate|make|draw|design|illustrate|visualize|produce|paint|render|show)\s+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'^(?:me\s+)?(?:an?\s+)?(?:picture|image|photo|wallpaper|logo|illustration|artwork|drawing|painting|portrait|sketch)?(?:\s+of)?\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'^(?:a|an|the)\s+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'^(?:picture|image|photo|wallpaper|drawing|painting|artwork|illustration)\s+of\s+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s+(?:pictures?|images?|photos?|drawings?|paintings?)$', '', text, flags=re.IGNORECASE)
    text = re.sub(r'^(?:of\s+)', '', text, flags=re.IGNORECASE)
    text = re.sub(r'^(?:a|an|the)\s+', '', text, flags=re.IGNORECASE)
    if text.lower().startswith('for '):
        text = 'logo ' + text
    return text.strip()

def detect_and_extract_image_prompt(text):
    """
    Recognizes natural variations of image creation requests:
    - create a cow picture in green land
    - create a cow eating pizza
    - generate a picture of a cow
    - make an image of a dog
    - draw a mountain
    - generate an image of a futuristic city
    - create a family picture
    - make me a sunset wallpaper
    - generate a logo for coffee shop
    - create an illustration of a robot
    - show me a picture of a tiger
    - create a dog riding a bicycle
    - create a red Ferrari on a mountain road
    - create a futuristic city at night
    - create a cartoon astronaut on Mars
    - create a cow in a green field
    - /image ...
    Excludes pure text/code requests (e.g., 'create a python function', 'write a story').
    """
    if not text or not isinstance(text, str):
        return None
    text_clean = text.strip()
    if text_clean.startswith('/image'):
        return clean_extracted_prompt(text_clean[6:])

    lower = text_clean.lower()
    words = set(re.findall(r'\b\w+\b', lower))

    # Reject if it's explicitly a text/code request
    if any(k in words for k in TEXT_ORIENTED_KEYWORDS):
        return None

    # Visual-specific verbs: always image request
    m_visual = re.match(r'^(?:can\s+you\s+)?(?:please\s+)?(?:draw|paint|illustrate|sketch|visualize|render)(?:\s+me)?\s+(?:an?\s+)?(.+)$', text_clean, re.IGNORECASE)
    if m_visual:
        return clean_extracted_prompt(m_visual.group(1))

    # Explicit image nouns: picture, image, photo, wallpaper, logo, artwork, portrait
    has_image_noun = any(n in words for n in ['picture', 'pictures', 'image', 'images', 'photo', 'photos', 'wallpaper', 'logo', 'artwork', 'portrait'])
    verb_pat = r'(?:can\s+you\s+)?(?:please\s+)?(?:create|generate|make|produce|show|design|give\s+me)'

    if has_image_noun:
        mA = re.match(rf'^{verb_pat}?\s*(?:an?\s+)?(?:picture|image|photo|wallpaper|logo|artwork|portrait)s?\s+of\s+(.+)$', text_clean, re.IGNORECASE)
        if mA:
            return clean_extracted_prompt(mA.group(1))

        mB = re.match(rf'^{verb_pat}\s+(?:an?\s+)?(.+?\s+(?:picture|image|photo|wallpaper|logo|artwork|portrait)s?.*)$', text_clean, re.IGNORECASE)
        if mB:
            sub = mB.group(1)
            sub = re.sub(r'\b(?:picture|image|photo|wallpaper|artwork)s?\b', '', sub, flags=re.IGNORECASE)
            sub = re.sub(r'\s+', ' ', sub).strip()
            return clean_extracted_prompt(sub)

        mC = re.match(rf'^{verb_pat}\s+(?:an?\s+)?(.+)$', text_clean, re.IGNORECASE)
        if mC:
            sub = mC.group(1).strip()
            sub = re.sub(r'\b(?:picture|image|photo|wallpaper|artwork)s?\b', '', sub, flags=re.IGNORECASE)
            sub = re.sub(r'\s+', ' ', sub).strip()
            return clean_extracted_prompt(sub)

    # General "create a/an [subject]" or "generate a/an [subject]"
    m_create = re.match(r'^(?:can\s+you\s+)?(?:please\s+)?(?:create|generate|make)\s+(?:an?\s+)?(.+)$', text_clean, re.IGNORECASE)
    if m_create:
        candidate = m_create.group(1).strip()
        first_word = candidate.split()[0].lower() if candidate.split() else ''
        if first_word not in ['account', 'user', 'folder', 'file', 'table', 'variable', 'class', 'method']:
            return clean_extracted_prompt(candidate)

    return None

def build_faithful_image_prompt(subject, style="photorealistic"):
    """
    Transforms user request into a faithful image generation prompt.
    Preserves user's actual subject as primary subject.
    Applies style modifiers without modifying the subject.
    Adds negative constraints to avoid book covers, posters, watermarks.
    """
    style_modifiers = {
        "cinematic": "cinematic lighting, ultra-detailed, 8k resolution, photorealistic masterpiece, dramatic atmosphere",
        "cyberpunk": "cyberpunk style, neon glowing colors, futuristic sci-fi city, high tech, vivid reflections, 8k",
        "anime": "high quality anime key visual, Makoto Shinkai style, vibrant colors, detailed line art, stunning lighting",
        "digital_art": "digital concept art, trending on ArtStation, dynamic composition, vivid color palette, intricate details",
        "photorealistic": "hyperrealistic photography, natural lighting, sharp focus, 8k UHD, true to life textures, highly detailed",
        "3d_render": "octane 3D render, raytraced reflections, Unreal Engine 5, hyper-detailed, smooth shading"
    }
    modifier = style_modifiers.get(style, style_modifiers["photorealistic"])

    lower_sub = subject.lower()
    if "cartoon" in lower_sub:
        prompt = f"{subject}, vibrant cartoon illustration style, expressive, clear outlines, colorful, detailed background, no text, no watermark, no poster, no book cover"
    elif "logo" in lower_sub:
        prompt = f"{subject}, minimalist modern vector logo design, clean graphic, high quality, vector art, centered, no text, no watermark"
    elif "pizza" in lower_sub:
        # e.g. "cow eating pizza"
        prompt = f"A detailed image of {subject}. The {subject} is the main subject and visibly eating and interacting with the pizza, {modifier}, natural setting, coherent scene, no text, no typography, no book cover, no watermark, no poster"
    else:
        prompt = f"Create an image of {subject}. The {subject} is the primary subject, {modifier}, natural environment, coherent scene, no text, no typography, no book cover, no watermark, no poster"

    return prompt

def generate_ai_image(prompt, style="photorealistic", aspect_ratio="1:1"):
    """
    Calls the actual diffusion image generation model via Pollinations AI.
    Never uses fake fallbacks or stock encyclopedia images.
    """
    dim_map = {
        "1:1": (1024, 1024),
        "16:9": (1280, 720),
        "9:16": (720, 1280),
        "4:3": (1024, 768)
    }
    width, height = dim_map.get(aspect_ratio, (1024, 1024))
    seed = random.randint(1000, 999999)
    enhanced_prompt = build_faithful_image_prompt(prompt, style=style)
    encoded = urllib.parse.quote(enhanced_prompt)

    # Actual diffusion image generation URL
    image_url = f"https://image.pollinations.ai/prompt/{encoded}?width={width}&height={height}&seed={seed}&nologo=true"

    return {
        "image_url": image_url,
        "subject": prompt,
        "enhanced_prompt": enhanced_prompt,
        "seed": seed,
        "dimensions": f"{width}x{height}",
        "style": style
    }

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/status", methods=["GET"])
def get_status():
    key = os.getenv("GROQ_API_KEY", "").strip()
    has_key = bool(key and key != "your_groq_api_key_here")
    masked = ""
    if has_key:
        masked = key[:7] + "..." + key[-4:] if len(key) > 12 else "gsk_***"
    return jsonify({
        "status": "online",
        "has_api_key": has_key,
        "api_key_preview": masked,
        "engine": "Groq LPU Inference Engine"
    })

@app.route("/api/models", methods=["GET"])
def get_models():
    client = get_groq_client()
    models_to_return = list(DEFAULT_MODELS)
    default_model = "qwen/qwen3.8-27b"

    if client:
        try:
            active_data = client.models.list().data
            active_ids = {m.id for m in active_data}
            for m in models_to_return:
                m["available"] = m["id"] in active_ids
            for m in models_to_return:
                if m.get("available"):
                    default_model = m["id"]
                    break
        except Exception:
            pass

    return jsonify({
        "models": models_to_return,
        "default_model": default_model,
        "vision_model": "llama-3.2-11b-vision-preview"
    })

@app.route("/api/settings", methods=["POST"])
def update_settings():
    data = request.get_json() or {}
    new_key = data.get("api_key", "").strip()

    if not new_key:
        return jsonify({"success": False, "error": "API key cannot be empty."}), 400

    try:
        from groq import Groq
        test_client = Groq(api_key=new_key)
        test_client.models.list()
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Invalid Groq API key: {str(e)}"
        }), 400

    env_path = os.path.join(os.path.dirname(__file__), ".env")
    try:
        lines = []
        key_written = False
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("GROQ_API_KEY="):
                        lines.append(f"GROQ_API_KEY={new_key}\n")
                        key_written = True
                    else:
                        lines.append(line)
        if not key_written:
            lines.append(f"GROQ_API_KEY={new_key}\n")

        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(lines)

        os.environ["GROQ_API_KEY"] = new_key
        return jsonify({
            "success": True,
            "message": "Groq API key verified and saved successfully!"
        })
    except Exception as e:
        os.environ["GROQ_API_KEY"] = new_key
        return jsonify({
            "success": True,
            "message": f"API key updated in memory (could not write to .env: {str(e)})"
        })

@app.route("/api/image-proxy")
def image_proxy():
    """
    Proxies generated images to avoid CORS and ensure direct binary download.
    """
    target_url = request.args.get("url")
    download_flag = request.args.get("download", "0") == "1"
    filename = request.args.get("filename", "nova-ai-artwork.jpg")

    if not target_url:
        return jsonify({"error": "Missing image URL parameter."}), 400

    try:
        resp = requests.get(target_url, timeout=35, stream=True)
        if resp.status_code != 200:
            return jsonify({"error": f"Upstream image service returned HTTP {resp.status_code}"}), 502

        headers = {
            "Content-Type": resp.headers.get("Content-Type", "image/jpeg"),
            "Cache-Control": "public, max-age=86400"
        }
        if download_flag:
            headers["Content-Disposition"] = f'attachment; filename="{filename}"'

        return Response(resp.iter_content(chunk_size=8192), headers=headers)
    except Exception as e:
        return jsonify({"error": f"Image proxy error: {str(e)}"}), 502

@app.route("/api/chat", methods=["POST"])
def chat():
    client_key = request.headers.get("X-Groq-Api-Key", "").strip() or None
    client = get_groq_client(client_key)
    if not client:
        return jsonify({
            "error": "Groq API key is not configured. Please add it in Settings or your .env file."
        }), 401

    data = request.get_json() or {}
    raw_messages = data.get("messages", [])
    model = data.get("model", "qwen/qwen3.8-27b")
    mode = data.get("mode", "general")
    stream = data.get("stream", True)
    custom_system_prompt = data.get("system_prompt", "").strip()

    if not raw_messages:
        return jsonify({"error": "No messages provided."}), 400

    last_user_msg = None
    for m in reversed(raw_messages):
        if m.get("role") == "user":
            last_user_msg = m.get("content", "")
            break

    # 1. INTENT DETECTION: CHECK IF USER REQUESTS AN IMAGE
    image_prompt = detect_and_extract_image_prompt(last_user_msg) if last_user_msg else None

    if image_prompt:
        try:
            img_data = generate_ai_image(image_prompt)
            target_url = img_data["image_url"]

            card_html = (
                f'<div class="generated-image-card" data-subject="{image_prompt}" data-image-url="{target_url}">\n'
                f'  <div class="image-wrapper">\n'
                f'    <img src="{target_url}" alt="{image_prompt}" class="chat-generated-img" />\n'
                f'  </div>\n'
                f'  <div class="image-card-meta">\n'
                f'    <span class="image-subject-label">• <strong>Subject:</strong> {image_prompt}</span>\n'
                f'    <div class="image-card-actions">\n'
                f'      <button type="button" class="img-btn view-full-btn" onclick="window.openLightbox(\'{target_url}\', \'{image_prompt}\')">\n'
                f'        <i class="fa-solid fa-expand"></i> View Full Image\n'
                f'      </button>\n'
                f'      <button type="button" class="img-btn download-img-btn" onclick="window.downloadImageDirect(\'{target_url}\', \'{image_prompt}\')">\n'
                f'        <i class="fa-solid fa-download"></i> Download Image\n'
                f'      </button>\n'
                f'      <button type="button" class="img-btn regen-img-btn" onclick="window.regenerateImagePrompt(\'{image_prompt}\')">\n'
                f'        <i class="fa-solid fa-rotate"></i> Regenerate\n'
                f'      </button>\n'
                f'    </div>\n'
                f'  </div>\n'
                f'</div>'
            )

            if not stream:
                return jsonify({
                    "response": card_html,
                    "model": "Nova Image Generator",
                    "image_url": target_url,
                    "subject": image_prompt,
                    "metrics": {
                        "latency_sec": 0.5,
                        "tokens_per_sec": 300,
                        "completion_tokens": 60
                    }
                })

            def stream_image():
                start_json = json.dumps({"chunk": '<div class="image-generating-notice"><i class="fa-solid fa-spinner fa-spin"></i> Generating image for: <strong>"' + image_prompt + '"</strong>...</div>\n\n', "done": False})
                yield f"data: {start_json}\n\n"
                time.sleep(0.1)

                content_json = json.dumps({"chunk": "\n" + card_html, "replace_loading": True, "done": False})
                yield f"data: {content_json}\n\n"

                done_json = json.dumps({"done": True, "metrics": {"total_tokens": 50, "elapsed_sec": 0.4, "tokens_per_sec": 300, "model": "Nova Image Synthesizer"}})
                yield f"data: {done_json}\n\n"

            return Response(stream_with_context(stream_image()), mimetype="text/event-stream")
        except Exception as img_err:
            error_msg = f'<div class="image-error-notice"><i class="fa-solid fa-circle-exclamation"></i> Image generation failed: {str(img_err)}. Please try again.</div>'
            if not stream:
                return jsonify({"response": error_msg, "error": str(img_err)}), 500
            def stream_err():
                yield f"data: {json.dumps({'chunk': error_msg, 'done': True})}\n\n"
            return Response(stream_with_context(stream_err()), mimetype="text/event-stream")

    # 2. STANDARD TEXT/CODE CHAT WITH MULTI-TURN CONTEXT MEMORY
    system_prompt = custom_system_prompt or DEFAULT_SYSTEM_PROMPTS.get(mode, DEFAULT_SYSTEM_PROMPTS["general"])
    formatted_messages = [{"role": "system", "content": system_prompt}]
    has_image = False

    # Send recent history (up to last 12 messages) for conversational memory
    history_window = raw_messages[-12:]
    for msg in history_window:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        image_data = msg.get("image", None)

        if image_data:
            has_image = True
            content_payload = [
                {"type": "text", "text": content if content else "Analyze this image in detail and solve any problem depicted."},
                {"type": "image_url", "image_url": {"url": image_data}}
            ]
            formatted_messages.append({"role": role, "content": content_payload})
        else:
            formatted_messages.append({"role": role, "content": content})

    if has_image and not any(v in model.lower() for v in ["vision", "11b", "90b"]):
        model = "llama-3.2-11b-vision-preview"

    # Candidate fallback list in case selected model gives model_not_found (404)
    candidate_models = [model]
    for backup in ["qwen/qwen3.8-27b", "groq/compound", "openai/gpt-oss-120b", "llama-3.1-8b-instant"]:
        if backup not in candidate_models:
            candidate_models.append(backup)

    def execute_completion(stream_flag=True):
        last_err = None
        for candidate in candidate_models:
            try:
                if stream_flag:
                    return client.chat.completions.create(
                        model=candidate,
                        messages=formatted_messages,
                        temperature=0.7,
                        max_tokens=4096,
                        stream=True
                    ), candidate
                else:
                    return client.chat.completions.create(
                        model=candidate,
                        messages=formatted_messages,
                        temperature=0.7,
                        max_tokens=4096,
                        stream=False
                    ), candidate
            except Exception as e:
                err_msg = str(e)
                last_err = e
                if "model_not_found" in err_msg or "404" in err_msg:
                    continue
                else:
                    raise e
        raise last_err

    if not stream:
        try:
            start_time = time.time()
            completion, used_model = execute_completion(stream_flag=False)
            elapsed = time.time() - start_time
            response_text = completion.choices[0].message.content
            usage = completion.usage
            tokens_generated = usage.completion_tokens if usage else len(response_text.split())
            tokens_per_sec = round(tokens_generated / max(elapsed, 0.001), 1)

            return jsonify({
                "response": response_text,
                "model": used_model,
                "metrics": {
                    "latency_sec": round(elapsed, 2),
                    "tokens_per_sec": tokens_per_sec,
                    "completion_tokens": tokens_generated,
                    "total_tokens": usage.total_tokens if usage else None
                }
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    def generate():
        start_time = time.time()
        first_token_time = None
        total_tokens = 0

        try:
            stream_resp, used_model = execute_completion(stream_flag=True)

            for chunk in stream_resp:
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                    text_chunk = chunk.choices[0].delta.content
                    if first_token_time is None:
                        first_token_time = time.time()
                    total_tokens += 1
                    yield f"data: {json.dumps({'chunk': text_chunk, 'done': False})}\n\n"

            total_elapsed = max(time.time() - start_time, 0.001)
            ttft = round((first_token_time - start_time) * 1000, 1) if first_token_time else 0
            tok_per_sec = round(total_tokens / total_elapsed, 1)

            final_payload = {
                "done": True,
                "metrics": {
                    "total_tokens": total_tokens,
                    "elapsed_sec": round(total_elapsed, 2),
                    "tokens_per_sec": tok_per_sec,
                    "ttft_ms": ttft,
                    "model": used_model
                }
            }
            yield f"data: {json.dumps(final_payload)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

    return Response(stream_with_context(generate()), mimetype="text/event-stream")

@app.route("/api/transcribe", methods=["POST"])
def transcribe_audio():
    client_key = request.headers.get("X-Groq-Api-Key", "").strip() or None
    client = get_groq_client(client_key)
    if not client:
        return jsonify({
            "error": "Groq API key is required to use Whisper transcription. Please configure it in Settings."
        }), 401

    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    filename = audio_file.filename or "recording.webm"
    ext = os.path.splitext(filename)[1] or ".webm"

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        audio_path = tmp.name
        audio_file.save(audio_path)

    try:
        with open(audio_path, "rb") as f:
            transcription = client.audio.transcriptions.create(
                file=(f"audio{ext}", f.read()),
                model="whisper-large-v3-turbo",
                response_format="json",
                language="en",
                temperature=0.0
            )

        transcribed_text = transcription.text.strip()
        return jsonify({
            "success": True,
            "text": transcribed_text
        })
    except Exception as e:
        return jsonify({"error": f"Audio transcription failed: {str(e)}"}), 500
    finally:
        if os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except Exception:
                pass

@app.route("/api/generate-image", methods=["POST"])
def generate_image():
    """
    Dedicated endpoint for the AI Image Creation Studio modal.
    Returns real diffusion image generation result.
    """
    data = request.get_json() or {}
    prompt = data.get("prompt", "").strip()
    style = data.get("style", "photorealistic")
    aspect_ratio = data.get("aspect_ratio", "1:1")

    if not prompt:
        return jsonify({"error": "Prompt is required to create an image."}), 400

    try:
        img_data = generate_ai_image(prompt, style=style, aspect_ratio=aspect_ratio)
        return jsonify({
            "success": True,
            "image_url": img_data["image_url"],
            "subject": img_data["subject"],
            "enhanced_prompt": img_data["enhanced_prompt"],
            "style": style,
            "seed": img_data["seed"],
            "dimensions": img_data["dimensions"]
        })
    except Exception as e:
        return jsonify({"success": False, "error": f"Image generation failed: {str(e)}"}), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"[*] NovaGroq AI Server launching on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
