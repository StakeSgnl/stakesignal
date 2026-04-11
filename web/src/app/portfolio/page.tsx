'use client'

import { useEffect, useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { PROGRAM_ID } from '@/lib/constants'
import Link from 'next/link'

interface Position {
  pubkey: string
  market: string
  prediction: boolean
  amount: number
  yieldEarned: number
}

function lamportsToSol(l: number) {
  return (l / 1e9).toFixed(4)
}

export default function PortfolioPage() {
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<{ wins: number; totalBets: number; volume: number } | null>(null)

  useEffect(() => {
    if (!publicKey) return
    let cancelled = false
    setLoading(true)

    async function fetchPositions() {
      try {
        const programKey = new PublicKey(PROGRAM_ID)
        const accounts = await connection.getProgramAccounts(programKey, {
          filters: [
            { memcmp: { offset: 8, bytes: publicKey!.toBase58() } },
          ],
        })

        if (cancelled) return

        const parsed: Position[] = []
        for (const { pubkey, account } of accounts) {
          try {
            const d = account.data
            // Position: discriminator(8) + user(32) + market(32) + side(1) + lst_amount(8) + yield_at_entry(8) + placed_at(8) + claimed(1) + bump(1)
            if (d.length < 89) continue
            let off = 8
            const user = new PublicKey(d.subarray(off, off + 32)).toBase58(); off += 32
            const market = new PublicKey(d.subarray(off, off + 32)).toBase58(); off += 32
            if (user !== publicKey!.toBase58()) continue
            const prediction = d[off] === 0; off += 1 // Side::Yes = 0, Side::No = 1
            const amount = Number(d.readBigUInt64LE(off)); off += 8
            const yieldEarned = Number(d.readBigUInt64LE(off))

            parsed.push({
              pubkey: pubkey.toBase58(),
              market,
              prediction,
              amount,
              yieldEarned,
            })
          } catch {
            // skip non-position accounts
          }
        }

        setPositions(parsed)
      } catch (err) {
        console.error('[portfolio]', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // Also try to fetch user stats
    async function fetchStats() {
      try {
        const programKey = new PublicKey(PROGRAM_ID)
        const statsSeed = new TextEncoder().encode('signal_stats')
        const [statsPda] = PublicKey.findProgramAddressSync(
          [statsSeed, publicKey!.toBuffer()],
          programKey
        )
        const info = await connection.getAccountInfo(statsPda)
        if (!info || cancelled) return

        const d = info.data
        let off = 8 // discriminator
        off += 32 // user pubkey
        const totalBets = Number(d.readBigUInt64LE(off)); off += 8
        const wins = Number(d.readBigUInt64LE(off)); off += 8
        off += 8 // total_yield_earned
        const volume = Number(d.readBigUInt64LE(off))

        setStats({ wins, totalBets, volume })
      } catch {
        // no stats account yet
      }
    }

    fetchPositions()
    fetchStats()
    return () => { cancelled = true }
  }, [publicKey, connection])

  const totalStaked = positions.reduce((s, p) => s + p.amount, 0)
  const totalYield = positions.reduce((s, p) => s + p.yieldEarned, 0)

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
      ) : loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border bg-card p-4 text-center">
                <div className="h-8 w-16 mx-auto rounded bg-muted animate-pulse" />
                <div className="h-3 w-20 mx-auto rounded bg-muted animate-pulse mt-2" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-2xl font-bold">{positions.length}</div>
              <div className="text-xs text-muted-foreground">Active Positions</div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{lamportsToSol(totalStaked)}</div>
              <div className="text-xs text-muted-foreground">Total Staked (LST)</div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{lamportsToSol(totalYield)}</div>
              <div className="text-xs text-muted-foreground">Yield Earned</div>
            </div>
          </div>

          {stats && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border bg-card p-4 text-center">
                <div className="text-xl font-bold">
                  {stats.totalBets > 0 ? Math.round((stats.wins / stats.totalBets) * 100) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">Win Rate</div>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <div className="text-xl font-bold">{stats.totalBets}</div>
                <div className="text-xs text-muted-foreground">Total Positions</div>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <div className="text-xl font-bold">{lamportsToSol(stats.volume)}</div>
                <div className="text-xs text-muted-foreground">Total Volume</div>
              </div>
            </div>
          )}

          {positions.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
              <p>No positions yet</p>
              <p className="text-sm mt-1">
                <Link href="/" className="text-brand-600 hover:underline">
                  Browse markets
                </Link>{' '}
                to start earning yield while you predict
              </p>
            </div>
          ) : (
            <div className="rounded-lg border bg-card divide-y">
              <div className="grid grid-cols-5 gap-4 px-4 py-2 text-xs text-muted-foreground font-semibold">
                <div>Market</div>
                <div>Side</div>
                <div>Amount</div>
                <div>Yield</div>
                <div>Action</div>
              </div>
              {positions.map((p) => (
                <div key={p.pubkey} className="grid grid-cols-5 gap-4 px-4 py-3 text-sm items-center">
                  <Link href={`/market/${p.market}`} className="text-brand-600 hover:underline font-mono text-xs">
                    {p.market.slice(0, 8)}...
                  </Link>
                  <span className={`font-semibold ${p.prediction ? 'text-blue-400' : 'text-red-400'}`}>
                    {p.prediction ? 'YES' : 'NO'}
                  </span>
                  <span>{lamportsToSol(p.amount)} LST</span>
                  <span className="text-green-400">{lamportsToSol(p.yieldEarned)}</span>
                  <button className="text-xs text-muted-foreground border rounded px-2 py-1 opacity-50 cursor-not-allowed" disabled title="Coming soon">
                    Early Exit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
