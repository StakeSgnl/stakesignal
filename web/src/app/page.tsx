'use client'

import { useConnection } from '@solana/wallet-adapter-react'
import { useQuery } from '@tanstack/react-query'
import { PublicKey } from '@solana/web3.js'
import { PROGRAM_ID } from '@/lib/constants'
import Link from 'next/link'

interface Market {
  pubkey: string
  marketId: number
  title: string
  yesPool: number
  noPool: number
  totalBettors: number
  resolveAt: number
  status: 'Open' | 'Resolved' | 'Cancelled'
  result: boolean | null
}

function lamportsToSol(l: number) {
  return (l / 1e9).toFixed(2)
}

function timeLeft(ts: number) {
  const diff = ts - Date.now() / 1000
  if (diff <= 0) return 'Ended'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  return d > 0 ? `${d}d ${h}h` : `${h}h`
}

export default function HomePage() {
  const { connection } = useConnection()

  const { data: markets = [], isLoading: loading } = useQuery<Market[]>({
    queryKey: ['markets', connection.rpcEndpoint],
    queryFn: async () => {
      if (!PROGRAM_ID) return []

      const programKey = new PublicKey(PROGRAM_ID)
      const accounts = await connection.getProgramAccounts(programKey)
      const parsed: Market[] = []

      for (const { pubkey, account } of accounts) {
        try {
          const d = account.data
          if (d.length < 100) continue
          let off = 8 // skip discriminator
          // Try to detect PredictionMarket by checking field patterns
          const marketId = Number(d.readBigUInt64LE(off)); off += 8
          // title: String (4 + bytes)
          const titleLen = d.readUInt32LE(off); off += 4
          if (titleLen > 128 || titleLen === 0) continue
          const title = d.subarray(off, off + titleLen).toString('utf8'); off += titleLen
          // description: String (4 + bytes)
          const descLen = d.readUInt32LE(off); off += 4
          if (descLen > 256) continue
          off += descLen
          // creator: Pubkey (32)
          off += 32
          // lst_mint: Pubkey (32)
          off += 32
          // yes_pool: u64
          const yesPool = Number(d.readBigUInt64LE(off)); off += 8
          // no_pool: u64
          const noPool = Number(d.readBigUInt64LE(off)); off += 8
          // total_bettors: u32
          const totalBettors = d.readUInt32LE(off); off += 4
          // created_at: i64
          off += 8
          // resolve_at: i64
          const resolveAt = Number(d.readBigInt64LE(off)); off += 8
          // status: enum (1 byte)
          const statusByte = d[off]; off += 1
          const status = statusByte === 0 ? 'Open' : statusByte === 1 ? 'Resolved' : 'Cancelled'
          // result: Option<bool>
          const resultTag = d[off]; off += 1
          const result = resultTag === 1 ? d[off] === 1 : null

          parsed.push({
            pubkey: pubkey.toBase58(),
            marketId,
            title,
            yesPool,
            noPool,
            totalBettors,
            resolveAt,
            status: status as Market['status'],
            result,
          })
        } catch {
          // skip non-market accounts
        }
      }

      return parsed.sort((a, b) => b.marketId - a.marketId)
    },
    staleTime: 30_000,
  })

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Active Markets</h2>
        <p className="text-muted-foreground mt-1">Earn staking yield while you predict</p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-5 space-y-4">
              <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
              <div className="flex justify-between">
                <div className="h-8 w-20 rounded bg-muted animate-pulse" />
                <div className="h-8 w-20 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : markets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">No markets yet</p>
          <p className="text-sm mt-2">Markets are created by the crank when interesting price movements are detected</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {markets.map((m) => {
            const total = m.yesPool + m.noPool
            const yesPct = total > 0 ? Math.round((m.yesPool / total) * 100) : 50
            return (
              <Link key={m.pubkey} href={`/market/${m.pubkey}`}>
                <div className="rounded-lg border bg-card p-5 space-y-3 hover:border-primary/50 transition-colors cursor-pointer">
                  <h3 className="font-semibold text-sm">{m.title}</h3>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{lamportsToSol(total)} LST</span>
                    <span>{m.totalBettors} positions</span>
                    <span>{m.status === 'Open' ? timeLeft(m.resolveAt) : m.status}</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 text-center p-2 rounded bg-blue-500/10 border border-blue-500/20">
                      <div className="text-blue-400 font-bold text-sm">YES {yesPct}%</div>
                      <div className="text-[10px] text-muted-foreground">{lamportsToSol(m.yesPool)}</div>
                    </div>
                    <div className="flex-1 text-center p-2 rounded bg-red-500/10 border border-red-500/20">
                      <div className="text-red-400 font-bold text-sm">NO {100 - yesPct}%</div>
                      <div className="text-[10px] text-muted-foreground">{lamportsToSol(m.noPool)}</div>
                    </div>
                  </div>
                  {m.status === 'Resolved' && (
                    <div className={`text-xs font-bold ${m.result ? 'text-blue-400' : 'text-red-400'}`}>
                      Resolved: {m.result ? 'YES' : 'NO'}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
