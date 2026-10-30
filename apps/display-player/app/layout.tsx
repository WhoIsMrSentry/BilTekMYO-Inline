import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const sans = Plus_Jakarta_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'BilTekMYO İnline Display',
  description: 'Okul yayın ekranı',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={sans.variable} lang="tr">
      <body>{children}</body>
    </html>
  );
}
