import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/contexts/ThemeContext';

export const metadata: Metadata = {
  title: 'Jtrac',
  description: 'Track your todos and workouts',
  manifest: '/manifest.json',
  applicationName: 'Jtrac',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Jtrac' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('fittrack-theme');if(t&&t!=='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
      </head>
      <body className="bg-gray-950 text-white antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
