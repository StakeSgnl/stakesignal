/**
 * Number-formatting helpers used across signals/portfolio/leaderboard.
 *
 * All exports prefer locale-stable output (en-US, no thousands grouping by
 * default) so server-rendered values match client-rendered values.
 */

export function formatPercent(n: number, decimals: number = 1): string {
  if (!Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(decimals)}%`
}

export function formatBps(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return `${Math.round(n * 10000)} bps`
}

export function formatTokenAmount(amount: bigint | number, decimals: number = 9): string {
  const v = typeof amount === 'bigint' ? Number(amount) / 10 ** decimals : amount
  if (v === 0) return '0'
  if (Math.abs(v) < 0.01) return v.toExponential(2)
  if (Math.abs(v) < 1000) return v.toFixed(2)
  if (Math.abs(v) < 1_000_000) return `${(v / 1000).toFixed(1)}K`
  return `${(v / 1_000_000).toFixed(1)}M`
}

export function formatPubkey(pubkey: string, head: number = 4, tail: number = 4): string {
  if (!pubkey) return ''
  if (pubkey.length <= head + tail + 1) return pubkey
  return `${pubkey.slice(0, head)}…${pubkey.slice(-tail)}`
}

export function formatRelativeTime(unixSec: number, now: number = Date.now() / 1000): string {
  const delta = now - unixSec
  if (delta < 60) return 'just now'
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`
  return `${Math.floor(delta / 86400)}d ago`
}
