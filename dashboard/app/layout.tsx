import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EcoRouter Mission Control — Carbon & Latency-Aware Workflow Scheduler',
  description: 'Dispatcher picking model, location, and timing per step — proving savings instead of asserting.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080c14] text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
