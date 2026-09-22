import type { Metadata } from 'next';
import './globals.css';
import StyledRegistry from '../lib/styled-registry';

export const metadata: Metadata = {
  title: 'EcoRouter — Carbon-Aware LLM Scheduler',
  description: 'Routes each subtask to the right model, in the right place, at the right time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StyledRegistry>{children}</StyledRegistry>
      </body>
    </html>
  );
}
