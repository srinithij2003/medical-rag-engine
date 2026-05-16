import { StreamEvent } from '@/types/clinical';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

function authHeaders() {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('ocip_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(username: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!response.ok) throw new Error('Login failed');
  return response.json();
}

export async function fetchModels() {
  const response = await fetch(`${API_BASE}/models`, { headers: { ...authHeaders() } });
  if (!response.ok) throw new Error('Failed to fetch models');
  return response.json();
}

export async function uploadFile(file: File) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: form,
    headers: { ...authHeaders() }
  });
  if (!response.ok) throw new Error('Upload failed');
  return response.json();
}

export async function runOCR(file: File) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${API_BASE}/ocr`, {
    method: 'POST',
    body: form,
    headers: { ...authHeaders() }
  });
  if (!response.ok) throw new Error('OCR failed');
  return response.json();
}

export async function streamExtraction(
  text: string,
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const response = await fetch(`${API_BASE}/extract/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok || !response.body) {
    throw new Error('Streaming request failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';

    for (const frame of frames) {
      const line = frame
        .split('\n')
        .find((item) => item.startsWith('data: '));
      if (!line) continue;
      const payload = line.slice(6);
      onEvent(JSON.parse(payload) as StreamEvent);
    }
  }
}
