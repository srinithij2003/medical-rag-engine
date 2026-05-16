'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/upload', label: 'Upload & Extract' },
  { href: '/patients', label: 'Patient History' },
  { href: '/admin', label: 'Admin Settings' }
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 p-4 md:flex-row">
      <aside className="w-full rounded-2xl border bg-[var(--surface)] p-4 md:w-72">
        <h1 className="text-2xl font-black tracking-tight">Clinical Intelligence</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Offline privacy-first extraction</p>
        <nav className="mt-6 space-y-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-xl px-3 py-2 text-sm font-semibold transition',
                pathname === item.href
                  ? 'bg-cyan-500 text-white shadow-glow'
                  : 'hover:bg-cyan-100/50 dark:hover:bg-cyan-900/30'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 flex items-center justify-between rounded-xl border p-3">
          <span className="text-xs uppercase tracking-wide text-[var(--muted)]">Theme</span>
          <ThemeToggle />
        </div>
      </aside>
      <main className="flex-1 rounded-2xl border bg-[var(--surface)] p-4 md:p-6">{children}</main>
    </div>
  );
}
