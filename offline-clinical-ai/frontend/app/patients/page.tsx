import { DashboardShell } from '@/components/dashboard-shell';

const rows = [
  { patient: 'PT-10021', latest: 'Chest pain / HTN / aspirin', updated: '2026-05-15 11:05' },
  { patient: 'PT-10078', latest: 'Type 2 diabetes follow-up', updated: '2026-05-14 17:20' },
  { patient: 'PT-10104', latest: 'Allergy screening', updated: '2026-05-14 10:42' }
];

export default function PatientsPage() {
  return (
    <DashboardShell>
      <h2 className="font-heading text-3xl font-black">Patient History</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Recent structured extraction snapshots and retrieval-ready records.</p>
      <div className="mt-6 overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-cyan-100/40 dark:bg-cyan-900/20">
            <tr>
              <th className="px-4 py-3 text-left">Patient</th>
              <th className="px-4 py-3 text-left">Latest Extraction</th>
              <th className="px-4 py-3 text-left">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.patient} className="border-t">
                <td className="px-4 py-3 font-semibold">{row.patient}</td>
                <td className="px-4 py-3">{row.latest}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{row.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
