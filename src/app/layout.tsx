/**
 * @file This file defines the root layout for the entire application.
 * It sets up the HTML structure, includes global styles, fonts, and the Toaster component for notifications.
 */
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

// Initialize the Inter font with specified subsets and a CSS variable.
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

/**
 * Metadata for the application, used for SEO and browser tab information.
 */
export const metadata: Metadata = {
  title: 'PerdiemPro',
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
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        {/* The Toaster component is included here to be available globally for displaying notifications. */}
        <Toaster />
      </body>
    </html>
  );
}
