const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

async function parseResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.detail || data?.error || response.statusText || 'Request failed';
    throw new Error(message);
  }
  return data;
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body,
    cache: 'no-store',
  });

  return parseResponse(response);
}

export async function login(username, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function getHealth() {
  return request('/health', { method: 'GET' });
}

export async function getModels(token) {
  return request('/models', {
    method: 'GET',
    token,
  });
}

export async function selectModel(model, token) {
  return request('/models/select', {
    method: 'POST',
    token,
    body: JSON.stringify({ model }),
  });
}

export async function extractText(text, token, patientId, uploadId) {
  return request('/extract', {
    method: 'POST',
    token,
    body: JSON.stringify({ text, patient_id: patientId || null, upload_id: uploadId || null }),
  });
}

export function streamExtraction(text, token, onEvent, patientId, uploadId) {
  return new Promise(async (resolve, reject) => {
    const response = await fetch(`${apiBase}/extract/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text, patient_id: patientId || null, upload_id: uploadId || null }),
    });

    if (!response.ok || !response.body) {
      const message = response.statusText || 'Streaming request failed';
      reject(new Error(message));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        resolve();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';

      for (const frame of frames) {
        const dataLine = frame
          .split('\n')
          .find((line) => line.startsWith('data: '));
        if (!dataLine) continue;
        const payload = dataLine.slice(6);
        try {
          const parsed = JSON.parse(payload);
          onEvent(parsed);
        } catch (_) {
          onEvent({ type: 'error', message: 'Invalid stream payload received' });
        }
      }
    }
  });
}

export async function uploadFile(file, token, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiBase}/upload`);

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress(percent);
    };

    xhr.onload = () => {
      try {
        const data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data?.detail || data?.error || 'Upload failed'));
        }
      } catch {
        reject(new Error('Upload returned invalid response'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}

export async function runOCR(file, token) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${apiBase}/ocr`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  return parseResponse(response);
}

export async function listPatients(token) {
  return request('/patients', {
    method: 'GET',
    token,
  });
}

export async function createPatient(payload, token) {
  return request('/patients', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export async function getPatientHistory(patientId, token) {
  return request(`/patients/${patientId}/history`, {
    method: 'GET',
    token,
  });
}

export async function listExtractions(token, patientId) {
  const suffix = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : '';
  return request(`/extractions${suffix}`, {
    method: 'GET',
    token,
  });
}
