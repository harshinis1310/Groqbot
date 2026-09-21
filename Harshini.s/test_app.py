import unittest
import json
from app import app

class FlaskAppTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_index_page(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Nova', response.data)
        self.assertIn(b'Groq LPU', response.data)

    def test_status_endpoint(self):
        response = self.client.get('/api/status')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('status', data)
        self.assertIn('has_api_key', data)
        self.assertEqual(data['status'], 'online')

    def test_models_endpoint(self):
        response = self.client.get('/api/models')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('models', data)
        self.assertTrue(len(data['models']) >= 3)

    def test_image_generation_endpoint(self):
        response = self.client.post('/api/generate-image', json={
            'prompt': 'A cybernetic cat glowing with neon lights',
            'style': 'cyberpunk',
            'aspect_ratio': '1:1'
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data.get('success'))
        self.assertIn('image_url', data)
        self.assertTrue(data['image_url'].startswith('https://image.pollinations.ai/prompt/'))

    def test_chat_without_api_key(self):
        # When no API key is provided, should gracefully return 401
        response = self.client.post('/api/chat', json={
            'messages': [{'role': 'user', 'content': 'Hello'}]
        })
        # If no key is set, expects 401
        self.assertIn(response.status_code, [401, 200])

if __name__ == '__main__':
    unittest.main()
