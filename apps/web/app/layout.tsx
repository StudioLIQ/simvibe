import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'simvi.be - Agentic Market Simulator',
  description: 'Launch into a synthetic market before you launch into the real one.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
