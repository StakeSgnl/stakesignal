'use client'

import { useEffect, useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { PROGRAM_ID } from '@/lib/constants'

interface LeaderEntry {
  user: string
  totalBets: number
  wins: number
  volume: number
}

function lamportsToSol(l: number) {
  return (l / 1e9).toFixed(2)
}

function shortAddr(addr: string) {
  return addr.slice(0, 4) + '...' + addr.slice(-4)
}

export default function LeaderboardPage() {
  const { connection } = useConnection()
  const [leaders, setLeaders] = useState<LeaderEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchLeaderboard() {
      try {
        const programKey = new PublicKey(PROGRAM_ID)
        const accounts = await connection.getProgramAccounts(programKey)
        if (cancelled) return

        const entries: LeaderEntry[] = []
        for (const { account } of accounts) {
          try {
            const d = account.data
            // UserStats: discriminator(8) + user(32) + total_bets(8) + wins(8) + volume(8)
            if (d.length < 64 || d.length > 80) continue
            let off = 8
            const user = new PublicKey(d.subarray(off, off + 32)).toBase58(); off += 32
            const totalBets = Number(d.readBigUInt64LE(off)); off += 8
            const wins = Number(d.readBigUInt64LE(off)); off += 8
            const volume = Number(d.readBigUInt64LE(off))

            if (totalBets > 0) {
              entries.push({ user, totalBets, wins, volume })
            }
          } catch {
            // skip non-stat accounts
          }
        }

        setLeaders(entries.sort((a, b) => b.wins - a.wins).slice(0, 50))
      } catch (err) {
        console.error('[leaderboard]', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchLeaderboard()
    return () => { cancelled = true }
  }, [connection])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Leaderboard</h2>
        <p className="text-muted-foreground mt-1">Top predictors by win count</p>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-card divide-y">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-4 py-3 flex gap-4 items-center">
              <div className="h-4 w-6 rounded bg-muted animate-pulse" />
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-4 w-12 rounded bg-muted animate-pulse flex-1" />
            </div>
          ))}
        </div>
      ) : leaders.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          <p>No data yet</p>
          <p className="text-sm mt-1">Leaderboard populates as users place positions on markets</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card divide-y">
          <div className="grid grid-cols-5 gap-4 px-4 py-2 text-xs text-muted-foreground font-semibold">
            <div>#</div>
            <div>User</div>
            <div>Wins / Total</div>
            <div>Win Rate</div>
            <div>Volume</div>
          </div>
          {leaders.map((l, i) => (
            <div key={l.user} className="grid grid-cols-5 gap-4 px-4 py-3 text-sm items-center">
              <div className={`font-bold ${i < 3 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                {i + 1}
              </div>
              <div className="font-mono text-xs">{shortAddr(l.user)}</div>
              <div>{l.wins} / {l.totalBets}</div>
              <div className="text-blue-400 font-semibold">
                {Math.round((l.wins / l.totalBets) * 100)}%
              </div>
              <div>{lamportsToSol(l.volume)} LST</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
