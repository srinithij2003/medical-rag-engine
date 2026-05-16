'use client';

import { useState } from 'react';

import { streamExtraction } from '@/lib/api';
import { Extraction } from '@/types/clinical';

export function useExtractionStream() {
  const [streamText, setStreamText] = useState('');
  const [result, setResult] = useState<Extraction | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string>('');

  async function start(text: string) {
    setError(null);
    setStreamText('');
    setResult(null);
    setIsStreaming(true);

    try {
      await streamExtraction(text, (event) => {
        if (event.type === 'meta') setModel(event.model);
        if (event.type === 'token') setStreamText((prev) => prev + event.delta);
        if (event.type === 'result') setResult(event.result);
        if (event.type === 'error') setError(event.message);
      });
    } catch (streamError) {
      setError(streamError instanceof Error ? streamError.message : 'Streaming failed');
    } finally {
      setIsStreaming(false);
    }
  }

  return { start, streamText, result, isStreaming, error, model };
}
