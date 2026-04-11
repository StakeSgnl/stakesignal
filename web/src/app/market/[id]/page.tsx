'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'
import { PROGRAM_ID } from '@/lib/constants'
import idl from '@/lib/idl.json'
import Link from 'next/link'

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

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function timeLeft(ts: number) {
  const diff = ts - Date.now() / 1000
  if (diff <= 0) return 'Ended'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  return `${h}h ${m}m`
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

  const program = useMemo(() => {
    if (!anchorWallet) return null
    const provider = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
    return new Program(idl as any, provider)
  }, [connection, anchorWallet])

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function loadMarket() {
      try {
        const pubkey = new PublicKey(id)
        const info = await connection.getAccountInfo(pubkey)
        if (cancelled || !info) { setLoading(false); return }

        const d = info.data
        let off = 8
        const marketId = Number(d.readBigUInt64LE(off)); off += 8
        const titleLen = d.readUInt32LE(off); off += 4
        const title = d.subarray(off, off + titleLen).toString('utf8'); off += titleLen
        const descLen = d.readUInt32LE(off); off += 4
        const description = d.subarray(off, off + descLen).toString('utf8'); off += descLen
        off += 32 // creator
        const lstMint = new PublicKey(d.subarray(off, off + 32)).toBase58(); off += 32
        const yesPool = Number(d.readBigUInt64LE(off)); off += 8
        const noPool = Number(d.readBigUInt64LE(off)); off += 8
        const totalBettors = d.readUInt32LE(off); off += 4
        const createdAt = Number(d.readBigInt64LE(off)); off += 8
        const resolveAt = Number(d.readBigInt64LE(off)); off += 8
        const statusByte = d[off]; off += 1
        const status = statusByte === 0 ? 'Open' : statusByte === 1 ? 'Resolved' : 'Cancelled'
        const resultTag = d[off]; off += 1
        const result = resultTag === 1 ? d[off] === 1 : null

        setMarket({
          pubkey: id, marketId, title, description, lstMint,
          yesPool, noPool, totalBettors, createdAt, resolveAt,
          status: status as MarketData['status'], result,
        })
      } catch (err) {
        console.error('[market detail]', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadMarket()
    return () => { cancelled = true }
  }, [id, connection])

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-6 w-1/3 rounded bg-muted animate-pulse" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border bg-card p-6 space-y-4">
            <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-40 rounded bg-muted animate-pulse" />
          </div>
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
            <div className="h-10 rounded bg-muted animate-pulse" />
            <div className="h-10 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!market) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">Market not found</p>
        <Link href="/" className="text-sm text-brand-600 hover:underline mt-2 inline-block">
          Back to markets
        </Link>
      </div>
    )
  }

  const total = market.yesPool + market.noPool
  const yesPct = total > 0 ? Math.round((market.yesPool / total) * 100) : 50

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/" className="text-muted-foreground text-sm hover:text-foreground">
          &larr; Markets
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{market.title}</span>
      </div>

      {market.status === 'Resolved' && (
        <div className={`rounded-lg p-3 text-sm font-semibold ${
          market.result ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          Resolved: {market.result ? 'YES' : 'NO'}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Market info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-xl font-semibold">{market.title}</h2>
            {market.description && (
              <p className="text-sm text-muted-foreground">{market.description}</p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Total LST</div>
                <div className="font-semibold">{lamportsToSol(total)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Positions</div>
                <div className="font-semibold">{market.totalBettors}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Time Left</div>
                <div className="font-semibold">
                  {market.status === 'Open' ? timeLeft(market.resolveAt) : market.status}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Resolves</div>
                <div className="font-semibold text-xs">{formatDate(market.resolveAt)}</div>
              </div>
            </div>
          </div>

          {/* Pool distribution */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-sm">Pool Distribution</h3>
            <div className="flex gap-3">
              <div className="flex-1 text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="text-2xl font-bold text-blue-400">{yesPct}%</div>
                <div className="text-xs text-muted-foreground mt-1">YES Pool</div>
                <div className="text-sm font-medium mt-1">{lamportsToSol(market.yesPool)} LST</div>
              </div>
              <div className="flex-1 text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-2xl font-bold text-red-400">{100 - yesPct}%</div>
                <div className="text-xs text-muted-foreground mt-1">NO Pool</div>
                <div className="text-sm font-medium mt-1">{lamportsToSol(market.noPool)} LST</div>
              </div>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden bg-muted flex">
              <div className="bg-blue-500 h-full transition-all" style={{ width: `${yesPct}%` }} />
              <div className="bg-red-500 h-full flex-1" />
            </div>
          </div>

          {/* Market details */}
          <div className="rounded-lg border bg-card p-6 space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>LST Mint</span>
              <code className="font-mono">{market.lstMint.slice(0, 12)}...{market.lstMint.slice(-8)}</code>
            </div>
            <div className="flex justify-between">
              <span>Created</span>
              <span>{formatDate(market.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Market ID</span>
              <span>#{market.marketId}</span>
            </div>
          </div>
        </div>

        {/* Right: Position panel */}
        <div className="space-y-4">
          {market.status === 'Open' ? (
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <h3 className="font-semibold text-sm">Place Position</h3>

              {!publicKey ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Connect wallet to place a position
                </p>
              ) : (
                <>
                  <div className="flex gap-2">
                    <button
                      className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                        side === 'yes'
                          ? 'bg-blue-500 text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                      onClick={() => setSide('yes')}
                    >
                      YES
                    </button>
                    <button
                      className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                        side === 'no'
                          ? 'bg-red-500 text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                      onClick={() => setSide('no')}
                    >
                      NO
                    </button>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Amount (SOL)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-md border bg-background text-sm"
                    />
                    <div className="flex gap-1 mt-1">
                      {['0.05', '0.1', '0.5', '1'].map((v) => (
                        <button
                          key={v}
                          className="text-[10px] px-2 py-0.5 rounded border text-muted-foreground hover:text-foreground"
                          onClick={() => setAmount(v)}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {total > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Implied odds: {side === 'yes' ? yesPct : 100 - yesPct}% |{' '}
                      Potential payout: {((parseFloat(amount) || 0) * (total / (side === 'yes' ? market.yesPool || 1 : market.noPool || 1))).toFixed(4)} SOL
                    </div>
                  )}

                  <button
                    className={`w-full py-2 rounded-md text-sm font-semibold transition-all ${
                      side === 'yes' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'
                    } text-white disabled:opacity-50`}
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
                        const marketKey = new PublicKey(market.pubkey)
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
                      } catch (err: any) {
                        const msg = err.message || String(err)
                        if (msg.includes('User rejected')) {
                          setTxStatus({ type: 'error', msg: 'Transaction rejected' })
                        } else if (msg.includes('0x0') || msg.includes('already in use')) {
                          setTxStatus({ type: 'error', msg: 'You already have a position on this market' })
                        } else if (msg.includes('insufficient')) {
                          setTxStatus({ type: 'error', msg: 'Insufficient LST token balance' })
                        } else {
                          setTxStatus({ type: 'error', msg: msg.slice(0, 100) })
                        }
                      } finally {
                        setPlacing(false)
                      }
                    }}
                    disabled={placing || !amount || parseFloat(amount.replace(',', '.')) <= 0}
                  >
                    {placing ? 'Placing...' : `Place ${amount} SOL on ${side.toUpperCase()}`}
                  </button>

                  {txStatus && (
                    <p className={`text-xs ${txStatus.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                      {txStatus.msg}
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
              <p className="text-sm">Market is {market.status.toLowerCase()}</p>
            </div>
          )}

          {/* Yield info card */}
          <div className="rounded-lg border bg-card p-6 space-y-2">
            <h3 className="font-semibold text-sm">Yield While You Wait</h3>
            <p className="text-xs text-muted-foreground">
              Your deposited LST continues earning staking yield while locked in the market.
              Current estimates:
            </p>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">mSOL APY</span>
              <span className="text-green-400 font-semibold">~7.2%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">jitoSOL APY</span>
              <span className="text-green-400 font-semibold">~7.8%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
