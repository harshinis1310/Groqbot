import requests
import json
import time

BASE_URL = "http://127.0.0.1:5000"

def test_status():
    print("\n--- TEST 1: Status & API Key ---")
    resp = requests.get(f"{BASE_URL}/api/status")
    assert resp.status_code == 200, f"Status check failed: {resp.status_code}"
    data = resp.json()
    print("Status:", data)
    assert data.get("has_api_key") is True, "API Key should be configured"
    print("PASS: Status & API Key verified")

def test_image_intent_prompts():
    print("\n--- TEST 2: Image Intent Prompts in Chat ---")
    prompts = [
        ("create a cow eating pizza", "cow eating pizza"),
        ("create a cow picture in green land", "cow in green land"),
        ("create a dog riding a bicycle", "dog riding a bicycle"),
        ("create a red Ferrari on a mountain road", "red Ferrari on a mountain road"),
        ("create a futuristic city at night", "futuristic city at night")
    ]
    
    for user_prompt, expected_sub in prompts:
        resp = requests.post(f"{BASE_URL}/api/chat", json={
            "messages": [{"role": "user", "content": user_prompt}],
            "stream": False
        })
        assert resp.status_code == 200, f"Failed for '{user_prompt}': {resp.status_code} - {resp.text}"
        data = resp.json()
        html = data.get("response", "")
        assert "generated-image-card" in html, f"Expected image card in response for '{user_prompt}'"
        assert "View Full Image" in html, f"Missing View Full Image button for '{user_prompt}'"
        assert "Download Image" in html, f"Missing Download Image button for '{user_prompt}'"
        assert "Regenerate" in html, f"Missing Regenerate button for '{user_prompt}'"
        assert "Subject:" in html, f"Missing Subject label for '{user_prompt}'"
        assert "pollinations.ai" in html, f"Expected Pollinations AI diffusion URL for '{user_prompt}'"
        assert "wikipedia" not in html.lower(), f"Unrelated Wikipedia URL found in '{user_prompt}'!"
        print(f"PASS: '{user_prompt}' -> Image Card generated with subject: '{data.get('subject')}'")

def test_code_not_image():
    print("\n--- TEST 3: Disambiguation - Text/Code must NOT trigger image generator ---")
    resp = requests.post(f"{BASE_URL}/api/chat", json={
        "messages": [{"role": "user", "content": "create a python function to compute fibonacci numbers"}],
        "stream": False
    })
    assert resp.status_code == 200, f"Failed: {resp.status_code}"
    data = resp.json()
    html = data.get("response", "")
    assert "generated-image-card" not in html, "Code request should NOT generate an image card!"
    assert "def " in html or "fibonacci" in html.lower(), "Expected python code response"
    print("PASS: 'create a python function' successfully routed to Groq LLM code architect")

def test_multiturn_conversation():
    print("\n--- TEST 4: Multi-Turn Context Memory ---")
    messages = [
        {"role": "user", "content": "Hello, my secret codename is CyberPhoenix-99."},
        {"role": "assistant", "content": "Greetings! I have recorded your codename as CyberPhoenix-99."},
        {"role": "user", "content": "What is my secret codename?"}
    ]
    resp = requests.post(f"{BASE_URL}/api/chat", json={
        "messages": messages,
        "stream": False
    })
    assert resp.status_code == 200, f"Failed: {resp.status_code}"
    data = resp.json()
    reply = data.get("response", "")
    print(f"LLM Reply: {reply}")
    assert "CyberPhoenix" in reply or "99" in reply, "LLM did not remember codename from multi-turn context"
    print("PASS: Multi-turn context remembered across conversation turns")

def test_image_studio_endpoint():
    print("\n--- TEST 5: Image Studio Endpoint ---")
    payload = {
        "prompt": "a majestic cybernetic lion with glowing eyes",
        "style": "photorealistic",
        "aspect_ratio": "16:9"
    }
    resp = requests.post(f"{BASE_URL}/api/generate-image", json=payload)
    assert resp.status_code == 200, f"Failed: {resp.status_code}"
    data = resp.json()
    assert data.get("success") is True, f"Image studio generation failed: {data}"
    assert "image_url" in data, "Missing image_url in data"
    assert data.get("dimensions") == "1280x720", f"Unexpected dimensions: {data.get('dimensions')}"
    print(f"PASS: Image Studio generated: {data.get('image_url')}")

def test_image_proxy():
    print("\n--- TEST 6: Image Proxy Endpoint ---")
    # Generate URL first
    gen_resp = requests.post(f"{BASE_URL}/api/generate-image", json={
        "prompt": "a small cute red apple",
        "style": "photorealistic",
        "aspect_ratio": "1:1"
    }).json()
    img_url = gen_resp["image_url"]
    
    proxy_resp = requests.get(f"{BASE_URL}/api/image-proxy", params={
        "url": img_url,
        "download": "1",
        "filename": "apple.jpg"
    }, timeout=45)
    assert proxy_resp.status_code == 200, f"Proxy failed: {proxy_resp.status_code}"
    assert "attachment" in proxy_resp.headers.get("Content-Disposition", ""), "Proxy missing download header"
    assert len(proxy_resp.content) > 1000, "Proxy returned too small content"
    print(f"PASS: Image proxy downloaded {len(proxy_resp.content)} bytes with Content-Disposition")

if __name__ == "__main__":
    test_status()
    test_image_intent_prompts()
    test_code_not_image()
    test_multiturn_conversation()
    test_image_studio_endpoint()
    test_image_proxy()
    print("\n========================================================")
    print("ALL VERIFICATION SUITE TESTS PASSED PERFECTLY!")
    print("========================================================")
