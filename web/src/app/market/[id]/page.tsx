'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'
import { PROGRAM_ID } from '@/lib/constants'
import idl from '@/lib/idl.json'
import Link from 'next/link'
import { ArrowLeft, Calendar, CalendarDays, CalendarRange, Clock, Coins, Globe, Hash, Landmark, Server, Timer, TrendingUp, Users, Zap } from 'lucide-react'

const PROGRAM_KEY = new PublicKey(PROGRAM_ID)
const enc = new TextEncoder()
const MARKET_SEED = enc.encode('signal_market')
const POSITION_SEED = enc.encode('position')
const VAULT_SEED = enc.encode('vault')

interface MarketData {
  pubkey: string
  marketId: number
  title: string
  description: string
  lstMint: string
  yesPool: number
  noPool: number
  totalBettors: number
  createdAt: number
  resolveAt: number
  status: 'Open' | 'Resolved' | 'Cancelled'
  result: boolean | null
}

function lamportsToSol(l: number) {
  return (l / 1e9).toFixed(4)
}

function formatDateUTC(ts: number) {
  const d = new Date(ts * 1000)
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = d.getUTCDate()
  const year = d.getUTCFullYear()
  const h = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${month} ${day}, ${year} ${h}:${min} UTC`
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

const horizonMeta = {
  daily:   { label: 'Daily',   icon: Calendar,      color: 'bg-amber-500/10 text-amber-700 border-amber-200/50' },
  weekly:  { label: 'Weekly',  icon: CalendarDays,   color: 'bg-brand-500/10 text-brand-700 border-brand-200/50' },
  monthly: { label: 'Monthly', icon: CalendarRange,  color: 'bg-violet-500/10 text-violet-700 border-violet-200/50' },
} as const

const categoryMeta: Record<string, { label: string; icon: typeof Globe; color: string }> = {
  network:    { label: 'Network',    icon: Globe,       color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200/50' },
  mev:        { label: 'MEV',        icon: Zap,         color: 'bg-orange-500/10 text-orange-700 border-orange-200/50' },
  defi:       { label: 'DeFi',       icon: TrendingUp,  color: 'bg-blue-500/10 text-blue-700 border-blue-200/50' },
  validators: { label: 'Validators', icon: Server,      color: 'bg-violet-500/10 text-violet-700 border-violet-200/50' },
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-48 rounded-md bg-brand-100/40 shimmer" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 glass-card rounded-xl p-6 space-y-4 shimmer">
          <div className="h-5 w-2/3 rounded-md bg-brand-100/50" />
          <div className="h-32 rounded-lg bg-brand-100/30" />
        </div>
        <div className="glass-card rounded-xl p-6 space-y-4 shimmer">
          <div className="h-4 w-1/2 rounded-md bg-brand-100/40" />
          <div className="h-10 rounded-lg bg-brand-100/30" />
          <div className="h-10 rounded-lg bg-brand-100/30" />
        </div>
      </div>
    </div>
  )
}

export default function MarketDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const anchorWallet = useAnchorWallet()
  const [market, setMarket] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [side, setSide] = useState<'yes' | 'no'>('yes')
  const [amount, setAmount] = useState('0.1')
  const [placing, setPlacing] = useState(false)
  const [txStatus, setTxStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null)

  const buildProgram = useCallback(() => {
    if (!anchorWallet) return null
    const prov = new AnchorProvider(connection, anchorWallet, { commitment: 'processed' })
    return new Program(idl as any, prov)
  }, [connection, anchorWallet])
  const program = buildProgram()

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function loadMarket() {
      try {
        const pubkey = new PublicKey(id)
        const info = await connection.getAccountInfo(pubkey)
        if (cancelled || !info) { setLoading(false); return }

        const d = info.data
        if (d.length < 100) { setLoading(false); return }
        let off = 8
        const marketId = Number(d.readBigUInt64LE(off)); off += 8
        const titleLen = d.readUInt32LE(off); off += 4
        if (titleLen > 128 || titleLen === 0 || off + titleLen > d.length) { setLoading(false); return }
        const title = d.subarray(off, off + titleLen).toString('utf8'); off += titleLen
        if (off + 4 > d.length) { setLoading(false); return }
        const descLen = d.readUInt32LE(off); off += 4
        if (descLen > 256 || off + descLen > d.length) { setLoading(false); return }
        const description = d.subarray(off, off + descLen).toString('utf8'); off += descLen
        off += 32 // creator
        if (off + 32 + 8 + 8 + 4 + 8 + 8 + 2 > d.length) { setLoading(false); return }
        const lstMint = new PublicKey(d.subarray(off, off + 32)).toBase58(); off += 32
        const yesPool = Number(d.readBigUInt64LE(off)); off += 8
        const noPool = Number(d.readBigUInt64LE(off)); off += 8
        const totalBettors = d.readUInt32LE(off); off += 4
        const createdAt = Number(d.readBigInt64LE(off)); off += 8
        const resolveAt = Number(d.readBigInt64LE(off)); off += 8
        const statusByte = d[off]; off += 1
        const status = statusByte === 0 ? 'Open' : statusByte === 1 ? 'Resolved' : 'Cancelled'
        const resultTag = d[off]; off += 1
        const result = resultTag === 1 && off < d.length ? d[off] === 1 : null

        setMarket({
          pubkey: id, marketId, title, description, lstMint,
          yesPool, noPool, totalBettors, createdAt, resolveAt,
          status: status as MarketData['status'], result,
        })
      } catch (e: unknown) {
        console.warn('market-detail:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadMarket()
    return () => { cancelled = true }
  }, [id, connection])

  if (loading) return <DetailSkeleton />

  if (!market) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Hash className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-lg font-semibold">Signal not found</p>
        <Link href="/" className="text-sm text-brand-600 hover:underline mt-2 inline-block">
          Back to signals
        </Link>
      </div>
    )
  }

  const total = market.yesPool + market.noPool
  const yesPct = total > 0 ? Math.round((market.yesPool / total) * 100) : 50
  const hz = detectHorizon(market.createdAt, market.resolveAt)
  const hzInfo = horizonMeta[hz]
  const HzIcon = hzInfo.icon
  const cat = detectCategory(market.title, market.description)
  const catInfo = categoryMeta[cat]
  const CatIcon = catInfo.icon

  return (
    <div className="space-y-5">
      {/* Breadcrumb + tags */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Signals</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${hzInfo.color}`}>
            <HzIcon className="h-3 w-3" />
            {hzInfo.label}
          </span>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${catInfo.color}`}>
            <CatIcon className="h-3 w-3" />
            {catInfo.label}
          </span>
        </div>
      </div>

      {market.status === 'Resolved' && (
        <div className={`glass-card rounded-xl p-3.5 text-sm font-semibold flex items-center gap-2 ${
          market.result
            ? 'border-emerald-200 bg-emerald-50/60 text-emerald-700'
            : 'border-violet-200 bg-violet-50/60 text-violet-700'
        }`}>
          <Zap className="h-4 w-4" />
          Resolved: {market.result ? 'YES' : 'NO'}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left column: Market info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Title card */}
          <div className="glass-card-elevated rounded-xl p-6 space-y-4 animate-fade-up">
            <h2 className="text-lg font-bold leading-snug">{market.title}</h2>
            {market.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{market.description}</p>
            )}

            {/* Stats pills */}
            <div className="flex flex-wrap gap-2.5">
              <StatPill icon={Coins} label="Total LST" value={lamportsToSol(total)} />
              <StatPill icon={Users} label="Positions" value={String(market.totalBettors)} />
              <StatPill
                icon={Timer}
                label="Time Left"
                value={market.status === 'Open' ? timeLeft(market.resolveAt) : market.status}
              />
              <StatPill icon={Clock} label="Resolves" value={formatDateUTC(market.resolveAt)} small />
            </div>
          </div>

          {/* Signal Sentiment */}
          <div className="glass-card rounded-xl p-6 space-y-4 animate-fade-up" style={{ animationDelay: '80ms' }}>
            <h3 className="font-semibold text-sm">Signal Sentiment</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-500/8 border border-emerald-200/60 p-4 text-center animate-scale-in" style={{ animationDelay: '150ms' }}>
                <div className="text-2xl font-extrabold text-emerald-600">{yesPct}%</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">Yes Signal</div>
                <div className="text-sm font-semibold mt-1 text-emerald-700">{lamportsToSol(market.yesPool)} LST</div>
              </div>
              <div className="rounded-xl bg-violet-500/8 border border-violet-200/60 p-4 text-center animate-scale-in" style={{ animationDelay: '220ms' }}>
                <div className="text-2xl font-extrabold text-violet-600">{100 - yesPct}%</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">No Signal</div>
                <div className="text-sm font-semibold mt-1 text-violet-700">{lamportsToSol(market.noPool)} LST</div>
              </div>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden bg-violet-500/15 flex sentiment-bar-glow">
              <div
                className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full rounded-full animate-bar-width relative z-10"
                style={{ width: `${yesPct}%`, animationDelay: '200ms' }}
              />
            </div>
          </div>

          {/* Market metadata */}
          <div className="glass-card rounded-xl p-5 space-y-2.5 text-xs text-muted-foreground animate-fade-up" style={{ animationDelay: '160ms' }}>
            <div className="flex justify-between items-center">
              <span className="font-medium">LST Mint</span>
              <code className="font-mono text-foreground/70 bg-muted/50 px-2 py-0.5 rounded">{market.lstMint.slice(0, 12)}...{market.lstMint.slice(-8)}</code>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Created</span>
              <span>{formatDateUTC(market.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Signal ID</span>
              <span>#{market.marketId}</span>
            </div>
          </div>
        </div>

        {/* Right column: Position panel */}
        <div className="space-y-5">
          {market.status === 'Open' ? (
            <div className="glass-card-elevated rounded-xl p-6 space-y-5 animate-fade-up" style={{ animationDelay: '120ms' }}>
              <h3 className="font-bold text-sm">Enter Signal</h3>

              {!publicKey ? (
                <div className="rounded-lg bg-muted/40 p-5 text-center">
                  <p className="text-sm text-muted-foreground">
                    Connect wallet to take a position
                  </p>
                </div>
              ) : (
                <>
                  {/* Side toggle — pill segmented control with sliding background */}
                  <div className="relative flex bg-muted/50 rounded-full p-1">
                    <div
                      className={`seg-slider ${side === 'yes' ? 'gradient-yes shadow-glow-yes' : 'gradient-no shadow-glow-no'}`}
                      data-side={side}
                    />
                    <button
                      className={`flex-1 py-2 rounded-full text-sm font-semibold transition-colors relative z-10 ${
                        side === 'yes'
                          ? 'text-white'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setSide('yes')}
                    >
                      YES
                    </button>
                    <button
                      className={`flex-1 py-2 rounded-full text-sm font-semibold transition-colors relative z-10 ${
                        side === 'no'
                          ? 'text-white'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setSide('no')}
                    >
                      NO
                    </button>
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium">Amount (LST)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border bg-white/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
                    />

                    {/* Range slider */}
                    <input
                      type="range"
                      min="0.01"
                      max="5"
                      step="0.01"
                      value={parseFloat(amount) || 0.01}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-brand-500"
                    />

                    {/* Quick pills */}
                    <div className="flex gap-1.5">
                      {['0.05', '0.1', '0.5', '1', '2'].map((v) => (
                        <button
                          key={v}
                          className={`text-[11px] px-3 py-1 rounded-full font-medium transition-all ${
                            amount === v
                              ? 'bg-brand-500 text-white'
                              : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                          onClick={() => setAmount(v)}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {total > 0 && (
                    <div className="rounded-lg bg-muted/30 p-3 space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Implied odds</span>
                        <span className="font-semibold text-foreground">{side === 'yes' ? yesPct : 100 - yesPct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Potential payout</span>
                        <span className="font-semibold text-foreground">
                          {((parseFloat(amount) || 0) * (total / (side === 'yes' ? market.yesPool || 1 : market.noPool || 1))).toFixed(4)} LST
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all text-white disabled:opacity-40 btn-signal-pulse ${
                      side === 'yes'
                        ? 'gradient-yes hover:shadow-glow-yes'
                        : 'gradient-no hover:shadow-glow-no'
                    }`}
                    onClick={async () => {
                      if (!program || !publicKey || !market) return
                      setPlacing(true)
                      setTxStatus(null)
                      try {
                        const parsed = parseFloat(amount.replace(',', '.'))
                        if (isNaN(parsed) || parsed <= 0) {
                          setTxStatus({ type: 'error', msg: 'Enter a valid amount' })
                          setPlacing(false)
                          return
                        }
                        const lstAmount = new BN(Math.floor(parsed * 1e9))
                        const lstMintKey = new PublicKey(market.lstMint)

                        const idBuf = new Uint8Array(8)
                        new DataView(idBuf.buffer).setBigUint64(0, BigInt(market.marketId), true)
                        const [marketPda] = PublicKey.findProgramAddressSync([MARKET_SEED, idBuf], PROGRAM_KEY)
                        const [positionPda] = PublicKey.findProgramAddressSync([POSITION_SEED, marketPda.toBuffer(), publicKey.toBuffer()], PROGRAM_KEY)
                        const [vaultPda] = PublicKey.findProgramAddressSync([VAULT_SEED, marketPda.toBuffer()], PROGRAM_KEY)
                        const userAta = await getAssociatedTokenAddress(lstMintKey, publicKey)

                        const betSide = side === 'yes' ? { yes: {} } : { no: {} }
                        const sig = await program.methods
                          .placePosition(betSide, lstAmount)
                          .accountsPartial({
                            market: marketPda,
                            position: positionPda,
                            userTokenAccount: userAta,
                            vaultTokenAccount: vaultPda,
                            user: publicKey,
                            tokenProgram: TOKEN_PROGRAM_ID,
                            systemProgram: SystemProgram.programId,
                          })
                          .rpc()
                        setTxStatus({ type: 'success', msg: `Position placed! TX: ${sig.slice(0, 16)}...` })
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : 'Transaction failed'
                        if (msg.includes('User rejected')) {
                          setTxStatus({ type: 'error', msg: 'Transaction rejected' })
                        } else if (msg.includes('0x0') || msg.includes('already in use')) {
                          setTxStatus({ type: 'error', msg: 'You already have a position on this signal' })
                        } else if (msg.includes('insufficient')) {
                          setTxStatus({ type: 'error', msg: 'Insufficient LST token balance' })
                        } else if (msg.includes('AccountNotFound') || msg.includes('could not find account')) {
                          setTxStatus({ type: 'error', msg: 'LST token account not found — you need this token in your wallet' })
                        } else {
                          setTxStatus({ type: 'error', msg: msg.slice(0, 100) })
                        }
                      } finally {
                        setPlacing(false)
                      }
                    }}
                    disabled={placing || !amount || parseFloat(amount.replace(',', '.')) <= 0}
                  >
                    {placing ? 'Placing...' : `Signal ${side.toUpperCase()} with ${amount} LST`}
                  </button>

                  {txStatus && (
                    <p className={`text-xs font-medium ${txStatus.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
                      {txStatus.msg}
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="glass-card rounded-xl p-6 text-center">
              <p className="text-sm text-muted-foreground">Signal is {market.status.toLowerCase()}</p>
            </div>
          )}

          {/* Passive Yield card */}
          <div className="glass-card rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-brand-500" />
              <h3 className="font-semibold text-sm">LST Yield Accrual</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your deposited LST continues earning staking yield while locked in this signal. You earn regardless of outcome.
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">mSOL APY</span>
                <span className="font-semibold text-emerald-600">~7.2%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">jitoSOL APY</span>
                <span className="font-semibold text-emerald-600">~7.8%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatPill({ icon: Icon, label, value, small }: { icon: any; label: string; value: string; small?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 animate-scale-in">
      <Icon className="h-3.5 w-3.5 text-brand-500 shrink-0" />
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</div>
        <div className={`font-semibold ${small ? 'text-[11px]' : 'text-sm'} text-foreground`}>{value}</div>
      </div>
    </div>
  )
}
