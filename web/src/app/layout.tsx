import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Providers } from './providers'
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
                  <a href="/" className="hover:text-foreground transition-colors">Markets</a>
                  <a href="/portfolio" className="hover:text-foreground transition-colors">Portfolio</a>
                  <a href="/leaderboard" className="hover:text-foreground transition-colors">Leaderboard</a>
                </nav>
              </div>
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
