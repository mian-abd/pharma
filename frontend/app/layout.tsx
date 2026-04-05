import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PharmaCortex Command Center',
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
      {/* Validate hydration in a clean/incognito profile; extensions can inject attrs like `bis_skin_checked`. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
