'use client';

import { UploadCloud } from 'lucide-react';
import { useRef } from 'react';

export function UploadDropzone({
  onFile,
  isLoading
}: {
  onFile: (file: File) => void;
  isLoading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="group rounded-2xl border-2 border-dashed p-10 text-center transition hover:border-cyan-500"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <UploadCloud className="mx-auto h-10 w-10 text-cyan-500 transition group-hover:scale-110" />
      <p className="mt-3 text-base font-semibold">Drop report or click to browse</p>
      <p className="mt-1 text-sm text-[var(--muted)]">PDF, TXT, DOCX, PNG, JPG (max 25MB)</p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        disabled={isLoading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </div>
  );
}
