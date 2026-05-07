// Static showcase data for marketing landing only.
// These are illustrative samples — they do not reflect on-chain state.
// The live `/signals` route hydrates real markets from the deployed program.

export interface DemoMarketShowcase {
  title: string
  horizon: 'Daily' | 'Weekly' | 'Monthly'
  category: 'Network' | 'MEV' | 'DeFi' | 'Validators'
  yesPct: number
  pool: string
  bettors: number
  timeLeft: string
}

export const demoMarketShowcase: DemoMarketShowcase[] = [
  {
    title: 'Solana processes 50M+ transactions today',
    horizon: 'Daily',
    category: 'Network',
    yesPct: 72,
    pool: '4,280',
    bettors: 38,
    timeLeft: '6h 14m',
  },
  {
    title: 'A single Jito bundle tip exceeds 100 SOL this week',
    horizon: 'Weekly',
    category: 'MEV',
    yesPct: 41,
    pool: '12,650',
    bettors: 94,
    timeLeft: '3d 8h',
  },
  {
    title: 'Solana DeFi TVL crosses $8B this month',
    horizon: 'Monthly',
    category: 'DeFi',
    yesPct: 63,
    pool: '31,200',
    bettors: 212,
    timeLeft: '18d 4h',
  },
  {
    title: 'Top validator drops below 3% total stake by Friday',
    horizon: 'Weekly',
    category: 'Validators',
    yesPct: 29,
    pool: '8,100',
    bettors: 56,
    timeLeft: '4d 19h',
  },
  {
    title: 'Pyth oracle feed count surpasses 400 this month',
    horizon: 'Monthly',
    category: 'DeFi',
    yesPct: 55,
    pool: '6,730',
    bettors: 71,
    timeLeft: '12d 2h',
  },
]
