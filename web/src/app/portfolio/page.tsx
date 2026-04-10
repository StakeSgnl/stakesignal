'use client'

import { useWallet } from '@solana/wallet-adapter-react'

export default function PortfolioPage() {
  const { publicKey } = useWallet()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Portfolio</h2>
        <p className="text-muted-foreground mt-1">
          Your active positions and accumulated yield
        </p>
      </div>

      {!publicKey ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Connect your wallet to view positions
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-2xl font-bold">0</div>
              <div className="text-xs text-muted-foreground">Active Positions</div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">0.00</div>
              <div className="text-xs text-muted-foreground">Total Staked (LST)</div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-green-400">0.00</div>
              <div className="text-xs text-muted-foreground">Yield Earned</div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            <p>No positions yet</p>
            <p className="text-sm mt-1">Place a position on an active market to start earning yield</p>
          </div>
        </div>
      )}
    </div>
  )
}
