import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PharmaCortex — Pharmaceutical Intelligence Terminal',
  description: 'Bloomberg Terminal-style pharmaceutical intelligence for physicians. Adversarial drug rep brief generation, FAERS signals, clinical trial analysis.',
  keywords: ['pharmaceutical', 'physician', 'clinical intelligence', 'drug information', 'FAERS', 'clinical trials'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
