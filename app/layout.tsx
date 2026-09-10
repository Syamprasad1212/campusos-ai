import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CampusOS AI | University Workflow Automation Platform',
  description: 'Describe what you need. CampusOS gets it done.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
