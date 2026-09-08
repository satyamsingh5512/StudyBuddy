import '../src/index.css';
// Dashboard-only glassmorphism tokens/classes (namespaced `sbd-*` / `--sbd-*`).
// Next.js requires global stylesheets to be imported from the root layout,
// but every rule inside is scoped by class/selector to the dashboard module —
// it has no visual effect on any other route.
import '../src/styles/dashboard-glass-tokens.css';
import '../src/styles/dashboard-glass.css';
// StudyBuddy design language. Imported LAST so its token overrides win
// the cascade. Removing this single line reverts the app to the previous theme.
import '../src/styles/studybuddy-theme.css';
import { Analytics } from '@vercel/analytics/next';
import { Inter, JetBrains_Mono, Newsreader } from 'next/font/google';

import { APPEARANCE_PREPAINT_SCRIPT } from '@/lib/appearancePrepaint';
import { Providers } from './Providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
// Editorial serif, used sparingly for quotes and empty states.
const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
});
// Primary body + heading face for the whole product.
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
    { media: '(prefers-color-scheme: light)', color: '#f5f5f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0f10' },
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
            __html: APPEARANCE_PREPAINT_SCRIPT,
          }}
        />
      </head>
      <body className={`${inter.variable} ${newsreader.variable} ${jetBrainsMono.variable}`}>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
