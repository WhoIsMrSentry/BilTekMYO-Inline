import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BilTekMYO İnline',
  description: 'Okul ekran ve AI Box yönetim paneli',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
