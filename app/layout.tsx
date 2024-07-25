import React from 'react';
import './globals.css';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { light } from '@clerk/themes';
import Header from './components/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Medical Card',
  description: 'Medical Card Early Access',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: light,
        variables: {
          colorPrimary: "#ff3132",
          colorText: "black"
        }
      }}
    >
      <html lang='en'>
        <body className={inter.className}>
          <Header />
          <main className='container mx-auto'>
            <div className='flex items-start justify-center min-h-screen'>
              <div className='mt-0'>{children}</div>
            </div>
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}