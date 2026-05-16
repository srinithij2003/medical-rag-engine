import json
from collections.abc import AsyncGenerator

import httpx

from backend.utils.config import settings


class OllamaClient:
    def __init__(self) -> None:
        self.base_url = settings.ollama_base_url.rstrip('/')
        self.timeout = settings.ollama_timeout_seconds

    async def list_models(self) -> list[str]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(f'{self.base_url}/models')
            response.raise_for_status()
            data = response.json().get('data', [])
            return [item.get('id', '') for item in data if item.get('id')]

    async def chat_completion(self, model: str, system_prompt: str, user_prompt: str) -> str:
        payload = {
            'model': model,
            'temperature': settings.ollama_temperature,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt},
            ],
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f'{self.base_url}/chat/completions', json=payload)
            response.raise_for_status()
            return response.json()['choices'][0]['message']['content']

    async def stream_chat_completion(
        self,
        model: str,
        system_prompt: str,
        user_prompt: str,
    ) -> AsyncGenerator[str, None]:
        payload = {
            'model': model,
            'temperature': settings.ollama_temperature,
            'stream': True,
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt},
            ],
        }
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream('POST', f'{self.base_url}/chat/completions', json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith('data: '):
                        continue
                    raw = line.removeprefix('data: ').strip()
                    if raw == '[DONE]':
                        break
                    chunk = json.loads(raw)
                    delta = chunk.get('choices', [{}])[0].get('delta', {}).get('content')
                    if delta:
                        yield delta


ollama_client = OllamaClient()
