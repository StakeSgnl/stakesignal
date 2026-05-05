'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useWallet } from '@solana/wallet-adapter-react'
import { Droplets, ExternalLink, Loader2, X, CheckCircle2, XCircle } from 'lucide-react'

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; signature: string }
  | { kind: 'err'; message: string }

export function FaucetDialog() {
  const { publicKey } = useWallet()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function requestLst() {
    if (!publicKey) {
      setStatus({ kind: 'err', message: 'connect wallet first' })
      return
    }
    setStatus({ kind: 'loading' })
    try {
      const resp = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      })
      const json = await resp.json()
      if (!resp.ok) {
        setStatus({ kind: 'err', message: json.error ?? 'request failed' })
        return
      }
      setStatus({ kind: 'ok', signature: json.signature })
    } catch (err) {
      setStatus({
        kind: 'err',
        message: err instanceof Error ? err.message : 'network error',
      })
    }
  }

  function reset() {
    setStatus({ kind: 'idle' })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <Dialog.Trigger asChild>
        <button className="signal-badge bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 transition-colors cursor-pointer">
          <Droplets className="h-3.5 w-3.5" />
          Need devnet tokens?
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl border border-brand-100 animate-scale-in">
          <div className="flex items-start justify-between mb-4">
            <div>
              <Dialog.Title className="text-lg font-bold text-foreground">
                Devnet faucets
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground mt-0.5">
                You need devnet SOL for transaction fees, and test LST tokens to stake.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/40">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-3">
            {/* SOL faucet */}
            <div className="rounded-xl border border-emerald-200/50 bg-emerald-50/40 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-emerald-900">1 · Devnet SOL (for fees)</h3>
                <span className="text-[10px] font-mono text-emerald-700/70">~1 SOL/day</span>
              </div>
              <p className="text-xs text-emerald-800/70 mb-3">
                Solana Foundation public faucet. Paste your wallet address there.
              </p>
              <a
                href="https://faucet.solana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
              >
                Open faucet.solana.com
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* LST faucet */}
            <div className="rounded-xl border border-violet-200/50 bg-violet-50/40 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-violet-900">2 · Test LST (to stake)</h3>
                <span className="text-[10px] font-mono text-violet-700/70">100 LST · 1×/day</span>
              </div>
              <p className="text-xs text-violet-800/70 mb-3">
                Mock liquid-staking token minted by our authority. Use it to back YES/NO positions.
              </p>

              {status.kind === 'idle' && (
                <button
                  onClick={requestLst}
                  disabled={!publicKey}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Droplets className="h-3.5 w-3.5" />
                  {publicKey ? 'Mint 100 LST to my wallet' : 'Connect wallet first'}
                </button>
              )}

              {status.kind === 'loading' && (
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-violet-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Minting…
                </div>
              )}

              {status.kind === 'ok' && (
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    100 LST sent to your wallet
                  </div>
                  <a
                    href={`https://explorer.solana.com/tx/${status.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-violet-600 hover:text-violet-800 break-all"
                  >
                    {status.signature.slice(0, 12)}…{status.signature.slice(-8)}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              )}

              {status.kind === 'err' && (
                <div className="space-y-2">
                  <div className="inline-flex items-start gap-1.5 text-xs font-semibold text-red-700">
                    <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{status.message}</span>
                  </div>
                  <button
                    onClick={reset}
                    className="text-[11px] font-semibold text-violet-600 hover:text-violet-800"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground mt-4 leading-relaxed">
            Devnet only. Tokens have no real value. The LST mint is{' '}
            <span className="font-mono">FdGY…wXXb</span>.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
