import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VR SSI Wallet - Minecraft Integration',
  description: 'Professional VR-optimized Self-Sovereign Identity Wallet with Minecraft dual-mode support',
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
}

export function generateViewport() {
  return {
    themeColor: '#3b82f6',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{
          __html: `
            // Auto-close functionality for Minecraft browser popup
            function checkAutoClose() {
              const urlParams = new URLSearchParams(window.location.search);
              const autoClose = urlParams.get('autoClose');
              const verificationId = urlParams.get('verificationId');
              
              if (autoClose === 'true' && verificationId) {
                window.minecraftAutoClose = true;
                window.minecraftVerificationId = verificationId;
                console.log('Auto-close mode enabled for verification:', verificationId);
              }
            }
            
            // Check on page load
            checkAutoClose();
            
            // Listen for hash changes (SPA navigation)
            window.addEventListener('hashchange', checkAutoClose);
            window.addEventListener('popstate', checkAutoClose);
          `
        }} />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}