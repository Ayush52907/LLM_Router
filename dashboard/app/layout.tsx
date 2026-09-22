import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EcoRouter — Carbon-Aware LLM Scheduler',
  description: 'Routes each subtask to the right model, in the right place, at the right time. Savings proven, not asserted.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased" style={{ background: 'var(--background)', color: 'var(--text-primary)' }}>
        {children}
      </body>
    </html>
  );
}
