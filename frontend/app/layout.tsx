import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PharmaSignal Command Center',
  description: 'Physician-first pharmaceutical intelligence with safety signals, evidence velocity, access friction, utilization, and class-peer comparisons in one dashboard.',
  keywords: ['pharmaceutical', 'FAERS', 'FDA', 'clinical trials', 'drug safety', 'dashboard', 'command center'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
