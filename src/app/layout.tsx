/**
 * @file This file defines the root layout for the entire application.
 * It sets up the HTML structure, includes global styles, fonts, and the Toaster component for notifications.
 */
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { ThemeProvider } from 'next-themes';
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
        {/* Google tag (gtag.js) */}
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-KLRRFCRXS3"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
          
            gtag('config', 'G-KLRRFCRXS3');
          `}
        </Script>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          {/* The Toaster component is included here to be available globally for displaying notifications. */}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
