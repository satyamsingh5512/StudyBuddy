import '../src/index.css';
// Dashboard-only glassmorphism tokens/classes (namespaced `sbd-*` / `--sbd-*`).
// Next.js requires global stylesheets to be imported from the root layout,
// but every rule inside is scoped by class/selector to the dashboard module —
// it has no visual effect on any other route.
import '../src/styles/dashboard-glass-tokens.css';
import '../src/styles/dashboard-glass.css';
import { Analytics } from '@vercel/analytics/next';
import { Inter, JetBrains_Mono, Outfit } from 'next/font/google';

import { Providers } from './Providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });
const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sbd.satym.in';
const metadataBase = new URL(
  configuredAppUrl.includes('://') ? configuredAppUrl : `https://${configuredAppUrl}`
);

export const metadata = {
  metadataBase,
  title: 'StudyBuddy - AI-Powered Study Platform',
  description: 'AI-Powered Mentoring Platform for Students - Your personal study companion',
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                const root = document.documentElement;
                let theme = 'light';

                try {
                  const storedTheme = localStorage.getItem('theme');
                  if (storedTheme === 'dark' || storedTheme === 'light') {
                    theme = storedTheme;
                  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    theme = 'dark';
                  }
                } catch (error) {
                  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    theme = 'dark';
                  }
                }

                root.classList.toggle('dark', theme === 'dark');
                root.dataset.theme = theme;
                root.style.colorScheme = theme;
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${outfit.variable} ${jetBrainsMono.variable}`}>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
