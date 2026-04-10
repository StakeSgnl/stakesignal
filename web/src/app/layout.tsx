import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Providers } from './providers'
import { WalletButton } from '@/components/WalletButton'
import './globals.css'

export const metadata: Metadata = {
  title: 'StakeSignal',
  description: 'Prediction markets backed by liquid staking tokens',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <header className="border-b px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <h1 className="text-lg font-semibold text-brand-700">StakeSignal</h1>
                <nav className="flex gap-4 text-sm text-muted-foreground">
                  <Link href="/" className="hover:text-foreground transition-colors">Markets</Link>
                  <Link href="/portfolio" className="hover:text-foreground transition-colors">Portfolio</Link>
                  <Link href="/leaderboard" className="hover:text-foreground transition-colors">Leaderboard</Link>
                </nav>
              </div>
              <WalletButton />
            </header>
            <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
