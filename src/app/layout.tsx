import Providers from '@/components/Providers';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'FIDC Platform',
  description: 'Blockchain-based FIDC management platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
