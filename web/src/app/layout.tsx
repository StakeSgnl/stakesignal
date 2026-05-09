import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Providers } from './providers'
import { AppShell } from '@/components/AppShell'
import './globals.css'

export const metadata: Metadata = {
  title: 'StakeSignal',
  description: 'Prediction markets backed by liquid staking tokens — earn yield while you predict',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
