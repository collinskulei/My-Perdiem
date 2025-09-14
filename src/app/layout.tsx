/**
 * @file This file defines the root layout for the entire application.
 * It sets up the HTML structure, includes global styles, fonts, and the Toaster component for notifications.
 */
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

// Initialize the Inter font with specified subsets and a CSS variable.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

/**
 * Metadata for the application, used for SEO and browser tab information.
 */
export const metadata: Metadata = {
  title: 'My Perdiem',
  description: 'Simplify how employees request and manage per diem allowances.',
};

/**
 * The root layout component that wraps all pages in the application.
 * @param {object} props - The properties for the component.
 * @param {React.ReactNode} props.children - The child components (pages) to be rendered within this layout.
 * @returns {JSX.Element} The root HTML structure of the application.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to Google Fonts for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Link to the Inter font stylesheet */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} font-body antialiased`}>
        {children}
        {/* The Toaster component is included here to be available globally for displaying notifications. */}
        <Toaster />
      </body>
    </html>
  );
}
