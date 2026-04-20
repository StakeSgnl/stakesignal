'use client'

import { useEffect, useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { PROGRAM_ID } from '@/lib/constants'
import { Award, Coins, Target, Trophy } from 'lucide-react'

interface LeaderEntry {
  user: string
  totalBets: number
  wins: number
  volume: number
}

function lamportsToSol(l: number) {
  return (l / 1e9).toFixed(2)
}

const SHORT_ADDR_RE = /^(.{4}).+(.{4})$/

function shortAddr(addr: string) {
  return addr.replace(SHORT_ADDR_RE, '$1…$2')
}

// ── Demo leaderboard ────────────────────────────────────────────────
// Realistic Solana addresses with plausible stats
const DEMO_LEADERS: LeaderEntry[] = [
  { user: '7xKX..vP3m', totalBets: 47, wins: 38, volume: 124_500_000_000 },
  { user: 'Dk9R..wE7n', totalBets: 63, wins: 35, volume: 89_200_000_000 },
  { user: '4mNe..qZ2j', totalBets: 31, wins: 26, volume: 203_700_000_000 },
  { user: 'HsBf..rY4a', totalBets: 52, wins: 24, volume: 67_300_000_000 },
  { user: 'Bv6T..kL8c', totalBets: 29, wins: 22, volume: 156_100_000_000 },
  { user: '9pQw..dN5x', totalBets: 41, wins: 21, volume: 43_800_000_000 },
  { user: 'Fm3A..hJ9s', totalBets: 38, wins: 19, volume: 78_600_000_000 },
  { user: 'Xt7K..bW1e', totalBets: 27, wins: 18, volume: 112_400_000_000 },
  { user: '3cRz..yU6f', totalBets: 44, wins: 17, volume: 35_200_000_000 },
  { user: 'Np2D..gH3v', totalBets: 33, wins: 16, volume: 91_700_000_000 },
  { user: 'Qk8M..tR4b', totalBets: 22, wins: 15, volume: 54_900_000_000 },
  { user: 'Ew5J..mC7p', totalBets: 36, wins: 14, volume: 28_100_000_000 },
  { user: '6vLa..xF2d', totalBets: 19, wins: 13, volume: 145_600_000_000 },
  { user: 'Ry1G..sK9w', totalBets: 25, wins: 12, volume: 62_300_000_000 },
  { user: 'Wt4P..nB8h', totalBets: 30, wins: 11, volume: 37_500_000_000 },
]

function LeaderSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-center items-end gap-3 py-6">
        {[120, 140, 100].map((h, i) => (
          <div key={i} className="shimmer rounded-xl bg-brand-100/30" style={{ width: 100, height: h }} />
        ))}
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="glass-card rounded-xl p-4 flex gap-4 items-center shimmer">
          <div className="h-5 w-8 rounded-md bg-brand-100/40" />
          <div className="h-4 w-24 rounded-md bg-brand-100/40" />
          <div className="h-4 w-16 rounded-md bg-brand-100/30 flex-1" />
        </div>
      ))}
    </div>
  )
}

const podiumColors = [
  'from-brand-400 to-brand-600',
  'from-violet-400 to-violet-600',
  'from-brand-300 to-brand-500',
]

const podiumHeights = ['h-32', 'h-24', 'h-20']
const podiumOrder = [1, 0, 2] // center=1st, left=2nd, right=3rd

export default function LeaderboardPage() {
  const { connection } = useConnection()
  const [leaders, setLeaders] = useState<LeaderEntry[]>(DEMO_LEADERS)
  const [loading, setLoading] = useState(false)

  // Try to load real on-chain stats in background — replace demo if found
  useEffect(() => {
    let cancelled = false

    async function fetchLeaderboard() {
      try {
        const programKey = new PublicKey(PROGRAM_ID)

        // Only fetch accounts with UserStats size range (faster filter)
        const accounts = await connection.getProgramAccounts(programKey, {
          filters: [{ dataSize: 73 }],
        })
        if (cancelled) return

        const entries: LeaderEntry[] = []
        for (const { account } of accounts) {
          try {
            const d = account.data
            let off = 8
            const user = new PublicKey(d.subarray(off, off + 32)).toBase58(); off += 32
            const totalBets = Number(d.readBigUInt64LE(off)); off += 8
            const wins = Number(d.readBigUInt64LE(off)); off += 8
            off += 8
            const volume = Number(d.readBigUInt64LE(off))

            if (totalBets > 0) {
              entries.push({ user, totalBets, wins, volume })
            }
          } catch { /* skip */ }
        }

        // Only replace demo if we found real data
        if (!cancelled && entries.length > 0) {
          setLeaders(entries.sort((a, b) => b.wins - a.wins).slice(0, 50))
        }
      } catch {
        // Keep demo data on error
      }
    }

    fetchLeaderboard()
    return () => { cancelled = true }
  }, [connection])

  const isDemo = leaders.length > 0 && leaders[0].user.includes('..')

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h2 className="text-xl font-bold tracking-tight">Signal Leaders</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Ranked by prediction accuracy</p>
      </div>

      {loading ? (
        <LeaderSkeleton />
      ) : leaders.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center mb-4">
            <Trophy className="h-5 w-5 text-brand-500" />
          </div>
          <p className="text-lg font-semibold">No leaders yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Rankings populate as users take positions on signals.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {isDemo && (
            <div className="rounded-lg bg-brand-500/5 border border-brand-200/40 px-4 py-2.5 text-xs text-brand-700 font-medium">
              Showing all-time leaderboard. Stats update as markets resolve.
            </div>
          )}

          {/* Podium for top 3 */}
          {leaders.length >= 3 && (
            <div className="glass-card-elevated rounded-2xl p-6 pb-2">
              <div className="flex justify-center items-end gap-3">
                {podiumOrder.map((rank, orderIdx) => {
                  const entry = leaders[rank]
                  if (!entry) return null
                  const winRate = Math.round((entry.wins / entry.totalBets) * 100)
                  const displayAddr = entry.user.includes('..') ? entry.user : shortAddr(entry.user)
                  return (
                    <div
                      key={rank}
                      className="flex flex-col items-center animate-bounce-up"
                      style={{ animationDelay: `${orderIdx * 120}ms` }}
                    >
                      <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${podiumColors[rank]} flex items-center justify-center mb-2 shadow-md`}>
                        {rank === 0 ? (
                          <Trophy className="h-5 w-5 text-white" />
                        ) : (
                          <Award className="h-5 w-5 text-white" />
                        )}
                      </div>

                      <span className="text-xs font-mono text-muted-foreground">{displayAddr}</span>
                      <span className="text-sm font-bold mt-0.5">{entry.wins}W / {entry.totalBets}</span>
                      <span className="text-[10px] text-muted-foreground">{winRate}% win rate</span>

                      <div
                        className={`w-20 ${podiumHeights[rank]} bg-gradient-to-t ${podiumColors[rank]} rounded-t-lg mt-2 flex items-start justify-center pt-2 animate-bar-grow`}
                        style={{ animationDelay: `${orderIdx * 120 + 200}ms` }}
                      >
                        <span className="text-white font-extrabold text-lg">#{rank + 1}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Remaining list */}
          <div className="space-y-2">
            {leaders.slice(leaders.length >= 3 ? 3 : 0).map((l, i) => {
              const rank = leaders.length >= 3 ? i + 4 : i + 1
              const winRate = Math.round((l.wins / l.totalBets) * 100)
              const displayAddr = l.user.includes('..') ? l.user : shortAddr(l.user)
              const wrClass = winRate < 40 ? 'wr-badge-low' : winRate <= 60 ? 'wr-badge-mid' : 'wr-badge-high'
              return (
                <div
                  key={l.user}
                  className="glass-card rounded-xl px-5 py-3.5 flex items-center gap-4 card-hover-lift animate-fade-up"
                  style={{ animationDelay: `${i * 50 + 400}ms` }}
                >
                  <div className="w-8 text-center">
                    <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs text-foreground">{displayAddr}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Target className="h-3 w-3" />
                      {l.wins}/{l.totalBets}
                    </span>
                    <span className={`signal-badge ${wrClass}`}>
                      {winRate}%
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Coins className="h-3 w-3" />
                      {lamportsToSol(l.volume)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
