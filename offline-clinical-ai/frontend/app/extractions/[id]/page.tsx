import { DashboardShell } from '@/components/dashboard-shell';

export default function ExtractionDetailPage({ params }: { params: { id: string } }) {
  return (
    <DashboardShell>
      <h2 className="font-heading text-3xl font-black">Extraction #{params.id}</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Detailed extraction history page placeholder. Connect this to `/extractions/:id` backend retrieval endpoint.
      </p>
    </DashboardShell>
  );
}
