'use client'

import { useState } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { useQuery } from '@tanstack/react-query'
import { PublicKey } from '@solana/web3.js'
import { PROGRAM_ID } from '@/lib/constants'
import Link from 'next/link'
import { Activity, Calendar, CalendarDays, CalendarRange, Clock, Coins, Globe, Landmark, Server, TrendingUp, Users, Zap } from 'lucide-react'

type TimeHorizon = 'all' | 'daily' | 'weekly' | 'monthly'
type CategoryFilter = 'all' | 'network' | 'mev' | 'defi' | 'validators'

interface Market {
  pubkey: string
  marketId: number
  title: string
  yesPool: number
  noPool: number
  totalBettors: number
  createdAt: number
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
  const m = Math.floor((diff % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatResolveUTC(ts: number) {
  const d = new Date(ts * 1000)
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = d.getUTCDate()
  const h = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${month} ${day}, ${h}:${min} UTC`
}

function detectHorizon(createdAt: number, resolveAt: number): 'daily' | 'weekly' | 'monthly' {
  const durationDays = (resolveAt - createdAt) / 86400
  if (durationDays <= 2) return 'daily'
  if (durationDays <= 14) return 'weekly'
  return 'monthly'
}

function detectCategory(title: string, desc?: string): 'network' | 'mev' | 'defi' | 'validators' {
  const t = (title + ' ' + (desc || '')).toLowerCase()
  if (t.includes('jito') || t.includes('priority fee') || t.includes('mev') || t.includes('bribe') || t.includes('bundle') || t.includes('tip')) return 'mev'
  if (t.includes('staked') || t.includes('validator') || t.includes('epoch') || t.includes('stake pool')) return 'validators'
  if (t.includes('token') || t.includes('tvl') || t.includes('mcap') || t.includes('market cap') || t.includes('swap') || t.includes('liquidity') || t.includes('defi')) return 'defi'
  return 'network'
}

const horizonMeta: Record<Exclude<TimeHorizon, 'all'>, { label: string; icon: typeof Calendar; color: string }> = {
  daily:   { label: 'Daily',   icon: Calendar,      color: 'bg-amber-500/10 text-amber-700 border-amber-200/50' },
  weekly:  { label: 'Weekly',  icon: CalendarDays,   color: 'bg-brand-500/10 text-brand-700 border-brand-200/50' },
  monthly: { label: 'Monthly', icon: CalendarRange,  color: 'bg-violet-500/10 text-violet-700 border-violet-200/50' },
}

const categoryMeta: Record<Exclude<CategoryFilter, 'all'>, { label: string; icon: typeof Globe; color: string }> = {
  network:    { label: 'Network',    icon: Globe,    color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200/50' },
  mev:        { label: 'MEV',        icon: Zap,      color: 'bg-orange-500/10 text-orange-700 border-orange-200/50' },
  defi:       { label: 'DeFi',       icon: TrendingUp, color: 'bg-blue-500/10 text-blue-700 border-blue-200/50' },
  validators: { label: 'Validators', icon: Server,   color: 'bg-violet-500/10 text-violet-700 border-violet-200/50' },
}

function SkeletonCard() {
  return (
    <div className="glass-card rounded-xl p-5 space-y-4 shimmer">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-3/4 rounded-md bg-brand-100/60" />
          <div className="h-3 w-1/2 rounded-md bg-brand-100/40" />
        </div>
        <div className="h-6 w-16 rounded-full bg-brand-100/40" />
      </div>
      <div className="h-2.5 w-full rounded-full bg-brand-100/30" />
      <div className="flex justify-between">
        <div className="h-3 w-20 rounded-md bg-brand-100/40" />
        <div className="h-3 w-20 rounded-md bg-brand-100/40" />
      </div>
    </div>
  )
}

export default function HomePage() {
  const { connection } = useConnection()
  const [horizon, setHorizon] = useState<TimeHorizon>('all')
  const [category, setCategory] = useState<CategoryFilter>('all')

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
          let off = 8
          const marketId = Number(d.readBigUInt64LE(off)); off += 8
          const titleLen = d.readUInt32LE(off); off += 4
          if (titleLen > 128 || titleLen === 0 || off + titleLen > d.length) continue
          const title = d.subarray(off, off + titleLen).toString('utf8'); off += titleLen
          if (off + 4 > d.length) continue
          const descLen = d.readUInt32LE(off); off += 4
          if (descLen > 256 || off + descLen > d.length) continue
          off += descLen
          off += 32 // creator
          off += 32 // lst_mint
          // Need at least 8+8+4+8+8+1+1+1 = 39 bytes remaining
          if (off + 39 > d.length) continue
          const yesPool = Number(d.readBigUInt64LE(off)); off += 8
          const noPool = Number(d.readBigUInt64LE(off)); off += 8
          const totalBettors = d.readUInt32LE(off); off += 4
          const createdAt = Number(d.readBigInt64LE(off)); off += 8
          const resolveAt = Number(d.readBigInt64LE(off)); off += 8
          const statusByte = d[off]; off += 1
          const status = statusByte === 0 ? 'Open' : statusByte === 1 ? 'Resolved' : 'Cancelled'
          const resultTag = d[off]; off += 1
          const result = resultTag === 1 && off < d.length ? d[off] === 1 : null

          parsed.push({
            pubkey: pubkey.toBase58(),
            marketId,
            title,
            yesPool,
            noPool,
            totalBettors,
            createdAt,
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
    staleTime: 10_000,
  })

  // Apply filters
  const filtered = markets.filter((m) => {
    if (horizon !== 'all' && detectHorizon(m.createdAt, m.resolveAt) !== horizon) return false
    if (category !== 'all' && detectCategory(m.title) !== category) return false
    return true
  })

  const totalPooled = markets.reduce((s, m) => s + m.yesPool + m.noPool, 0)
  const totalSignalers = markets.reduce((s, m) => s + m.totalBettors, 0)
  const openCount = markets.filter((m) => m.status === 'Open').length

  return (
    <div className="space-y-6">
      {/* Hero strip */}
      <div className="glass-card-elevated rounded-2xl px-6 py-5 animate-fade-up">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Stake. Predict. Earn yield.
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your LST works while you wait &mdash; deposit mSOL or jitoSOL and earn staking yield on every position.
        </p>

        {!loading && markets.length > 0 && (
          <div className="flex flex-wrap gap-4 mt-4">
            <span className="signal-badge bg-brand-500/10 text-brand-700 animate-scale-in">
              <Activity className="h-3.5 w-3.5" />
              {openCount} live
            </span>
            <span className="signal-badge bg-emerald-500/10 text-emerald-700 animate-scale-in" style={{ animationDelay: '80ms' }}>
              <Coins className="h-3.5 w-3.5" />
              {lamportsToSol(totalPooled)} LST pooled
            </span>
            <span className="signal-badge bg-violet-500/10 text-violet-700 animate-scale-in" style={{ animationDelay: '160ms' }}>
              <Users className="h-3.5 w-3.5" />
              {totalSignalers} signalers
            </span>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Time horizon tabs */}
        <div className="flex bg-white/50 backdrop-blur-sm rounded-full p-1 border border-white/40">
          {(['all', 'daily', 'weekly', 'monthly'] as TimeHorizon[]).map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                horizon === h
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {h === 'all' ? 'All' : h.charAt(0).toUpperCase() + h.slice(1)}
            </button>
          ))}
        </div>

        {/* Category filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'network', 'mev', 'defi', 'validators'] as CategoryFilter[]).map((c) => {
            const meta = c !== 'all' ? categoryMeta[c] : null
            const CatIcon = meta?.icon
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  category === c
                    ? c === 'all'
                      ? 'bg-foreground text-background border-foreground'
                      : meta!.color + ' border'
                    : 'bg-white/40 text-muted-foreground border-white/40 hover:bg-white/60 hover:text-foreground'
                }`}
              >
                {CatIcon && <CatIcon className="h-3 w-3" />}
                {c === 'all' ? 'All' : meta!.label}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center mb-4">
            <TrendingUp className="h-6 w-6 text-brand-500" />
          </div>
          <p className="text-lg font-semibold text-foreground">
            {markets.length === 0 ? 'No signals detected' : 'No matching signals'}
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
            {markets.length === 0
              ? 'Signals appear when the crank detects notable price movements on supported assets.'
              : 'Try adjusting the filters to see more signals.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((m, idx) => {
            const total = m.yesPool + m.noPool
            const yesPct = total > 0 ? Math.round((m.yesPool / total) * 100) : 50
            const isOpen = m.status === 'Open'
            const hz = detectHorizon(m.createdAt, m.resolveAt)
            const hzInfo = horizonMeta[hz]
            const cat = detectCategory(m.title)
            const catInfo = categoryMeta[cat]
            const HzIcon = hzInfo.icon
            const CatIcon = catInfo.icon
            const borderCat = `border-cat-${cat}`

            return (
              <Link key={m.pubkey} href={`/market/${m.pubkey}`}>
                <div
                  className={`glass-card rounded-xl p-5 space-y-3.5 hover:shadow-glass-lg hover:border-brand-200 transition-all cursor-pointer group card-hover-lift animate-fade-up ${borderCat}`}
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  {/* Tags row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${hzInfo.color}`}>
                      <HzIcon className="h-2.5 w-2.5" />
                      {hzInfo.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catInfo.color}`}>
                      <CatIcon className="h-2.5 w-2.5" />
                      {catInfo.label}
                    </span>
                    <span className={`ml-auto signal-badge shrink-0 text-[10px] py-0.5 ${
                      isOpen
                        ? 'bg-emerald-500/10 text-emerald-700'
                        : m.status === 'Resolved'
                          ? 'bg-brand-100 text-brand-700'
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {isOpen && <span className="live-dot" />}
                      {isOpen ? 'Live' : m.status}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-sm leading-snug group-hover:text-brand-700 transition-colors">
                    {m.title}
                  </h3>

                  {/* Sentiment bar */}
                  <div className="space-y-1.5">
                    {total > 0 ? (
                      <>
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span className="text-emerald-600">YES {yesPct}%</span>
                          <span className="text-violet-600">NO {100 - yesPct}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden bg-violet-500/15 flex sentiment-bar-glow">
                          <div
                            className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full rounded-full animate-bar-width relative z-10"
                            style={{ width: `${yesPct}%`, animationDelay: `${idx * 60 + 200}ms` }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-2 rounded-full bg-muted/40 flex items-center justify-center">
                        <span className="text-[9px] text-muted-foreground font-medium">No positions yet</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom meta */}
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      {lamportsToSol(total)} LST
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {m.totalBettors}
                    </span>
                    <span className="flex items-center gap-1 ml-auto">
                      <Clock className="h-3 w-3" />
                      {isOpen ? timeLeft(m.resolveAt) : m.status}
                    </span>
                  </div>

                  {m.status === 'Resolved' && (
                    <div className={`text-xs font-bold ${m.result ? 'text-emerald-600' : 'text-violet-600'}`}>
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

