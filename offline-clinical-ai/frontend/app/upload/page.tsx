'use client';

import { useState } from 'react';

import { DashboardShell } from '@/components/dashboard-shell';
import { JsonViewer } from '@/components/json-viewer';
import { UploadDropzone } from '@/components/upload-dropzone';
import { runOCR, uploadFile } from '@/lib/api';
import { useExtractionStream } from '@/hooks/use-extraction-stream';

export default function UploadPage() {
  const [fileName, setFileName] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { start, streamText, result, isStreaming, error, model } = useExtractionStream();

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    setFileName(file.name);

    try {
      await uploadFile(file);
      const ocr = await runOCR(file);
      setOcrText(ocr.text || '');
      await start(ocr.text || '');
    } catch (eventError) {
      setUploadError(eventError instanceof Error ? eventError.message : 'Upload flow failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <DashboardShell>
      <h2 className="font-heading text-3xl font-black">Upload & Extract</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Drag in patient reports and stream JSON extraction instantly.</p>

      <div className="mt-6">
        <UploadDropzone onFile={handleFile} isLoading={uploading || isStreaming} />
      </div>

      {fileName ? <p className="mt-4 text-sm text-[var(--muted)]">File: {fileName}</p> : null}
      {uploadError ? <p className="mt-2 text-sm text-rose-500">{uploadError}</p> : null}
      {error ? <p className="mt-2 text-sm text-rose-500">{error}</p> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">OCR Text</h3>
          <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap text-sm">{ocrText || 'No text yet.'}</pre>
        </section>

        <section className="rounded-2xl border p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Streaming Output ({model || '...'})</h3>
          <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap text-sm">{streamText || 'Waiting...'}</pre>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Validated JSON</h3>
        {result ? <JsonViewer value={result} /> : <p className="mt-3 text-sm text-[var(--muted)]">No validated output yet.</p>}
      </section>
    </DashboardShell>
  );
}
