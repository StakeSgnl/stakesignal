/**
 * Format remaining time until a Unix timestamp (seconds, UTC) as a short label.
 *
 * Returns one of:
 *   - "12h 34m"   — hours/minutes, when more than an hour out
 *   - "47m"       — minutes only, when under an hour
 *   - "soon"      — under 60 seconds
 *   - "ended"     — past
 *
 * The function is timezone-agnostic. Both `now` and `target` are seconds-since-epoch UTC.
 *
 * @param target - resolution time, seconds since epoch (UTC)
 * @param now    - reference time, defaults to Date.now() / 1000
 */
export function timeLeft(target: number, now: number = Date.now() / 1000): string {
  const delta = Math.floor(target - now)
  if (delta <= 0) return 'ended'
  if (delta < 60) return 'soon'

  const hours = Math.floor(delta / 3600)
  const minutes = Math.floor((delta % 3600) / 60)

  if (hours === 0) return `${minutes}m`
  if (hours < 24) return `${hours}h ${minutes}m`

  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return `${days}d ${remHours}h`
}
