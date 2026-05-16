'use client';

import { useEffect, useState } from 'react';

import { DashboardShell } from '@/components/dashboard-shell';
import { fetchModels } from '@/lib/api';

export default function AdminPage() {
  const [models, setModels] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModels()
      .then((data) => {
        setModels(data.models || []);
        setSelected(data.selected || '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load models'));
  }, []);

  return (
    <DashboardShell>
      <h2 className="font-heading text-3xl font-black">Admin Settings</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Runtime model controls, security posture, and deployment flags.</p>

      <section className="mt-6 rounded-2xl border p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Available Local Models</h3>
        {error ? <p className="mt-3 text-sm text-rose-500">{error}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {models.map((item) => (
            <span
              key={item}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${item === selected ? 'bg-cyan-500 text-white' : ''}`}
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Security Checklist</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li>Offline mode enforced by local-only network routing.</li>
          <li>JWT required on upload/extract/model endpoints.</li>
          <li>Audit logs persisted for privileged actions.</li>
          <li>No telemetry flags enabled in environment defaults.</li>
        </ul>
      </section>
    </DashboardShell>
  );
}
