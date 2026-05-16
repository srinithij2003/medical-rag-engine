import Link from 'next/link';

import { DashboardShell } from '@/components/dashboard-shell';

const cards = [
  { title: 'Offline Inference', value: 'Enabled', detail: 'All LLM calls target local Ollama runtime' },
  { title: 'Supported Models', value: 'Gemma / Llama / Qwen / Phi', detail: 'Switch dynamically in admin settings' },
  { title: 'Streaming Extract', value: 'SSE', detail: 'Partial JSON rendered in real-time' },
  { title: 'Data Safety', value: 'No Cloud Telemetry', detail: 'Designed for HIPAA-sensitive deployments' }
];

export default function DashboardPage() {
  return (
    <DashboardShell>
      <h2 className="font-heading text-3xl font-black">Clinical Operations Dashboard</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Upload notes, stream extraction, and audit every action locally.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <article key={card.title} className="rounded-2xl border p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{card.title}</p>
            <p className="mt-2 text-xl font-bold">{card.value}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{card.detail}</p>
          </article>
        ))}
      </div>
      <div className="mt-6 flex gap-3">
        <Link href="/upload" className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white">
          Start Extraction
        </Link>
        <Link href="/patients" className="rounded-xl border px-4 py-2 text-sm font-semibold">
          View Patient History
        </Link>
      </div>
    </DashboardShell>
  );
}
