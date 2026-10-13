import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Syllabi — Focused study rooms, zero distraction',
  description: 'Pure monochrome collaborative study ecosystem. Share, track, and annotate syllabus documents in real time.',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
};

import { ThemeProvider } from '@/components/theme/ThemeProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-pitch text-white dark:bg-pitch dark:text-white antialiased selection:bg-white/20 selection:text-white transition-colors duration-200">
        <ThemeProvider>
          <div className="relative min-h-screen flex flex-col">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
