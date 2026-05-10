'use client'

import { useEffect, useState, useCallback } from 'react'
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'
import { PROGRAM_ID } from '@/lib/constants'
import idl from '@/lib/idl.json'
import Link from 'next/link'
import { Briefcase, CheckCircle, Coins, Percent, Sprout, TrendingUp, Wallet, XCircle } from 'lucide-react'

const PROGRAM_KEY = new PublicKey(PROGRAM_ID)
const enc = new TextEncoder()
const MARKET_SEED = enc.encode('signal_market')
const POSITION_SEED = enc.encode('position')
const VAULT_SEED = enc.encode('vault')

interface MarketInfo {
  marketId: number
  title: string
  lstMint: string
  status: 'Open' | 'Resolved' | 'Cancelled'
  result: boolean | null
  yesPool: number
  noPool: number
}

interface Position {
  pubkey: string
  market: string
  prediction: boolean // true = YES, false = NO
  amount: number
  yieldEarned: number
  claimed: boolean
  marketInfo: MarketInfo | null
}

function lamportsToSol(l: number) {
  return (l / 1e9).toFixed(4)
}

function parseMarketInfo(d: Buffer): MarketInfo | null {
  try {
    if (d.length < 100) return null
    let off = 8
    const marketId = Number(d.readBigUInt64LE(off)); off += 8
    const titleLen = d.readUInt32LE(off); off += 4
    if (titleLen > 128 || titleLen === 0 || off + titleLen > d.length) return null
    const title = d.subarray(off, off + titleLen).toString('utf8'); off += titleLen
    if (off + 4 > d.length) return null
    const descLen = d.readUInt32LE(off); off += 4
    if (descLen > 256 || off + descLen > d.length) return null
    off += descLen
    off += 32 // creator
    if (off + 32 + 8 + 8 + 4 + 8 + 8 + 2 > d.length) return null
    const lstMint = new PublicKey(d.subarray(off, off + 32)).toBase58(); off += 32
    const yesPool = Number(d.readBigUInt64LE(off)); off += 8
    const noPool = Number(d.readBigUInt64LE(off)); off += 8
    off += 4 // totalBettors
    off += 8 // created_at
    off += 8 // resolve_at
    const statusByte = d[off]; off += 1
    const status = statusByte === 0 ? 'Open' : statusByte === 1 ? 'Resolved' : 'Cancelled'
    const resultTag = d[off]; off += 1
    const result = resultTag === 1 && off < d.length ? d[off] === 1 : null
    return { marketId, title, lstMint, status: status as MarketInfo['status'], result, yesPool, noPool }
  } catch { return null }
}

function PortfolioSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card rounded-xl p-5 shimmer">
            <div className="h-5 w-10 rounded-md bg-brand-100/50 mb-2" />
            <div className="h-3 w-24 rounded-md bg-brand-100/40" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="glass-card rounded-xl p-5 shimmer">
            <div className="h-4 w-32 rounded-md bg-brand-100/50 mb-3" />
            <div className="h-3 w-20 rounded-md bg-brand-100/40" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PortfolioPage() {
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const anchorWallet = useAnchorWallet()
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<{ wins: number; totalBets: number; volume: number } | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [claimResult, setClaimResult] = useState<{ key: string; type: 'success' | 'error'; msg: string } | null>(null)

  const buildProgram = useCallback(() => {
    if (!anchorWallet) return null
    const prov = new AnchorProvider(connection, anchorWallet, { commitment: 'processed' })
    return new Program(idl as any, prov)
  }, [connection, anchorWallet])

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
            if (d.length < 89) continue
            let off = 8
            const user = new PublicKey(d.subarray(off, off + 32)).toBase58(); off += 32
            const market = new PublicKey(d.subarray(off, off + 32)).toBase58(); off += 32
            if (user !== publicKey!.toBase58()) continue
            const prediction = d[off] === 0; off += 1
            const amount = Number(d.readBigUInt64LE(off)); off += 8
            const yieldEarned = Number(d.readBigUInt64LE(off)); off += 8
            // claimed flag
            const claimed = d.length > off ? d[off] === 1 : false

            parsed.push({
              pubkey: pubkey.toBase58(),
              market,
              prediction,
              amount,
              yieldEarned,
              claimed,
              marketInfo: null,
            })
          } catch {
            // skip non-position accounts
          }
        }

        // Fetch market info for each position
        const marketKeys = [...new Set(parsed.map(p => p.market))]
        const marketInfoMap: Record<string, MarketInfo | null> = {}

        for (const mk of marketKeys) {
          try {
            const info = await connection.getAccountInfo(new PublicKey(mk))
            if (info) {
              marketInfoMap[mk] = parseMarketInfo(info.data as Buffer)
            }
          } catch { /* skip */ }
        }

        const enriched = parsed.map(p => ({
          ...p,
          marketInfo: marketInfoMap[p.market] || null,
        }))

        if (!cancelled) setPositions(enriched)
      } catch (err) {
        console.warn('portfolio –', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

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
        let off = 8
        off += 32
        const totalBets = Number(d.readBigUInt64LE(off)); off += 8
        const wins = Number(d.readBigUInt64LE(off)); off += 8
        off += 8
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

  async function handleClaim(position: Position) {
    const program = buildProgram()
    if (!program || !publicKey || !position.marketInfo) return

    setClaiming(position.pubkey)
    setClaimResult(null)

    try {
      const mi = position.marketInfo
      const lstMintKey = new PublicKey(mi.lstMint)
      const marketKey = new PublicKey(position.market)

      // Derive position PDA — required by the program
      const [positionPda] = PublicKey.findProgramAddressSync(
        [POSITION_SEED, marketKey.toBuffer(), publicKey.toBuffer()],
        PROGRAM_KEY
      )

      const userAta = await getAssociatedTokenAddress(lstMintKey, publicKey)

      const sig = await program.methods
        .claimWinnings()
        .accountsPartial({
          market: marketKey,
          position: positionPda,
          userTokenAccount: userAta,
          user: publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()

      setClaimResult({ key: position.pubkey, type: 'success', msg: `Claimed! TX: ${sig.slice(0, 16)}...` })
      // Remove claimed position from list
      setPositions(prev => prev.filter(p => p.pubkey !== position.pubkey))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Claim failed'
      if (msg.includes('User rejected')) {
        setClaimResult({ key: position.pubkey, type: 'error', msg: 'Transaction rejected' })
      } else if (msg.includes('AlreadyClaimed') || msg.includes('already')) {
        setClaimResult({ key: position.pubkey, type: 'error', msg: 'Already claimed' })
      } else if (msg.includes('YouLost')) {
        setClaimResult({ key: position.pubkey, type: 'error', msg: 'Position did not win' })
      } else {
        setClaimResult({ key: position.pubkey, type: 'error', msg: msg.slice(0, 100) })
      }
    } finally {
      setClaiming(null)
    }
  }

  const totalStaked = positions.reduce((s, p) => s + p.amount, 0)
  const totalYield = positions.reduce((s, p) => s + p.yieldEarned, 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">My Positions</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Active signals and accumulated yield
        </p>
      </div>

      {!publicKey ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center mb-4">
            <Wallet className="h-5 w-5 text-brand-500" />
          </div>
          <p className="text-sm text-muted-foreground">Connect wallet to access your dashboard</p>
        </div>
      ) : loading ? (
        <PortfolioSkeleton />
      ) : (
        <div className="space-y-5">
          {/* Primary stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <DashStat icon={Briefcase} label="Active Positions" value={String(positions.length)} delay={0} />
            <DashStat icon={Coins} label="Total Staked" value={`${lamportsToSol(totalStaked)} LST`} accent="brand" delay={60} />
            <DashStat icon={Sprout} label="Yield Earned" value={`${lamportsToSol(totalYield)} LST`} accent="emerald" delay={120} />
          </div>

          {/* Extended stats */}
          {stats && (
            <div className="grid gap-4 md:grid-cols-3">
              <DashStat
                icon={Percent}
                label="Win Rate"
                value={`${stats.totalBets > 0 ? Math.round((stats.wins / stats.totalBets) * 100) : 0}%`}
                accent="violet"
                delay={180}
              />
              <DashStat icon={TrendingUp} label="Total Signals" value={String(stats.totalBets)} delay={240} />
              <DashStat icon={Coins} label="Lifetime Volume" value={`${lamportsToSol(stats.volume)} LST`} delay={300} />
            </div>
          )}

          {/* Position cards */}
          {positions.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center">
              <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">Your portfolio is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Open your first position from{' '}
                <Link href="/" className="text-brand-600 hover:underline">
                  the live signals board
                </Link>{' '}
                — your collateral keeps earning staking yield from the moment you deposit.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {positions.map((p, posIdx) => {
                const mi = p.marketInfo
                const isResolved = mi?.status === 'Resolved'
                const userWon = isResolved && mi?.result !== null && p.prediction === mi.result
                const userLost = isResolved && mi?.result !== null && p.prediction !== mi.result
                const isCancelled = mi?.status === 'Cancelled'
                const isActive = mi?.status === 'Open'
                const isClaiming = claiming === p.pubkey
                const result = claimResult?.key === p.pubkey ? claimResult : null

                // Estimate payout for winners
                let estimatedPayout = ''
                if (userWon && mi) {
                  const winPool = p.prediction ? mi.yesPool : mi.noPool
                  const losePool = p.prediction ? mi.noPool : mi.yesPool
                  if (winPool > 0) {
                    const share = (p.amount / winPool) * losePool * 0.98 // ~2% fee
                    const total = p.amount + share
                    estimatedPayout = lamportsToSol(total)
                  }
                }

                return (
                  <div
                    key={p.pubkey}
                    className="glass-card rounded-xl p-5 space-y-3 card-hover-lift animate-fade-up"
                    style={{ animationDelay: `${posIdx * 60}ms` }}
                  >
                    {/* Header: market title + status */}
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/market/${p.market}`} className="hover:text-brand-600 transition-colors flex-1 min-w-0">
                        <span className="font-semibold text-sm leading-snug line-clamp-2">
                          {mi?.title || `${p.market.slice(0, 8)}...${p.market.slice(-6)}`}
                        </span>
                      </Link>
                      {isActive && (
                        <span className="signal-badge bg-brand-500/10 text-brand-700 shrink-0">Active</span>
                      )}
                      {userWon && (
                        <span className="signal-badge bg-emerald-500/10 text-emerald-700 shrink-0">
                          <CheckCircle className="h-3 w-3" /> Won
                        </span>
                      )}
                      {userLost && (
                        <span className="signal-badge bg-red-500/10 text-red-600 shrink-0">
                          <XCircle className="h-3 w-3" /> Lost
                        </span>
                      )}
                      {isCancelled && (
                        <span className="signal-badge bg-muted text-muted-foreground shrink-0">Cancelled</span>
                      )}
                    </div>

                    {/* Side + amounts */}
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`signal-badge text-[10px] py-0.5 ${
                            p.prediction
                              ? 'bg-emerald-500/10 text-emerald-700'
                              : 'bg-violet-500/10 text-violet-700'
                          }`}>
                            {p.prediction ? 'YES' : 'NO'}
                          </span>
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Staked</div>
                        <div className="text-lg font-bold">{lamportsToSol(p.amount)} <span className="text-xs font-medium text-muted-foreground">LST</span></div>
                      </div>
                      <div className="text-right">
                        {userWon && estimatedPayout ? (
                          <>
                            <div className="text-[10px] uppercase tracking-wide text-emerald-600 font-medium">Payout</div>
                            <div className="text-lg font-bold text-emerald-600">~{estimatedPayout} <span className="text-xs">LST</span></div>
                          </>
                        ) : (
                          <>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Yield</div>
                            <div className="text-lg font-bold text-emerald-600">+{lamportsToSol(p.yieldEarned)}</div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Claim button for winners */}
                    {userWon && !p.claimed && (
                      <button
                        onClick={() => handleClaim(p)}
                        disabled={isClaiming}
                        className="w-full py-2.5 rounded-xl text-sm font-bold transition-all text-white gradient-yes hover:shadow-glow-yes disabled:opacity-50"
                      >
                        {isClaiming ? 'Claiming...' : 'Claim Winnings'}
                      </button>
                    )}

                    {/* Refund button for cancelled markets */}
                    {isCancelled && !p.claimed && (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-muted text-muted-foreground cursor-not-allowed"
                      >
                        Refund (coming soon)
                      </button>
                    )}

                    {/* Lost state */}
                    {userLost && (
                      <div className="rounded-lg bg-red-500/5 border border-red-200/30 p-2.5 text-center">
                        <p className="text-xs text-red-600 font-medium">
                          Market resolved {mi?.result ? 'YES' : 'NO'} — your stake goes to the winning pool
                        </p>
                      </div>
                    )}

                    {/* Claim result feedback */}
                    {result && (
                      <p className={`text-xs font-medium ${result.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
                        {result.msg}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DashStat({ icon: Icon, label, value, accent, delay = 0 }: { icon: any; label: string; value: string; accent?: string; delay?: number }) {
  const accentColor = accent === 'emerald' ? 'text-emerald-600' : accent === 'violet' ? 'text-violet-600' : accent === 'brand' ? 'text-brand-600' : 'text-foreground'
  const iconColor = accent === 'emerald' ? 'text-emerald-500' : accent === 'violet' ? 'text-violet-500' : accent === 'brand' ? 'text-brand-500' : 'text-muted-foreground'

  return (
    <div
      className="glass-card rounded-xl p-5 animate-scale-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
      </div>
      <div className={`text-xl font-bold ${accentColor}`}>{value}</div>
    </div>
  )
}
