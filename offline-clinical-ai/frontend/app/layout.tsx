import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Offline Clinical Intelligence Platform',
  description: 'Privacy-first on-prem local LLM extraction stack'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body">{children}</body>
    </html>
  );
}
