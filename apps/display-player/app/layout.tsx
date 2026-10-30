import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter, JetBrains_Mono, Quicksand } from 'next/font/google';
import { defaultTheme, ThemeBackdrop, themeBootScript } from '@biltekmyo/theme';
import '@biltekmyo/theme/theme.css';
import './globals.css';
import './themes/index.css';

const sans = Quicksand({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap', preload: false });
const ui = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-ui', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-mono', display: 'swap' });
const serif = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-serif', display: 'swap', preload: false });

export const metadata: Metadata = {
  title: 'BilTekMYO İnline Display',
  description: 'Okul yayın ekranı',
};
export const viewport: Viewport = { themeColor: defaultTheme.themeColor };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${sans.variable} ${ui.variable} ${mono.variable} ${serif.variable}`} data-palette={defaultTheme.id} lang="tr" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head>
      <body><ThemeBackdrop surface="display" />{children}</body>
    </html>
  );
}
