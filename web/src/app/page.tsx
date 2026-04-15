'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Globe, Zap, TrendingUp, Server, Clock, Users, Coins } from 'lucide-react'

/* ── Hardcoded market preview data ──────────────────────────────── */

const liveSignals = [
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

const marketCategories = [
  {
    name: 'Network',
    description: 'TPS thresholds, outages, block time records',
    icon: Globe,
    bgColor: 'bg-emerald-50',
    accentBorder: 'border-l-emerald-500',
    iconColor: 'text-emerald-600',
  },
  {
    name: 'MEV',
    description: 'Jito tips, priority fees, bundle bribes',
    icon: Zap,
    bgColor: 'bg-orange-50',
    accentBorder: 'border-l-orange-500',
    iconColor: 'text-orange-600',
  },
  {
    name: 'DeFi',
    description: 'TVL milestones, token launches, market caps',
    icon: TrendingUp,
    bgColor: 'bg-blue-50',
    accentBorder: 'border-l-blue-500',
    iconColor: 'text-blue-600',
  },
  {
    name: 'Validators',
    description: 'Staking thresholds, ranking shifts, epoch events',
    icon: Server,
    bgColor: 'bg-violet-50',
    accentBorder: 'border-l-violet-500',
    iconColor: 'text-violet-600',
  },
]

const steps = [
  { num: '01', title: 'Deposit LST', desc: 'Connect wallet and deposit mSOL or jitoSOL as collateral.' },
  { num: '02', title: 'Pick a Signal', desc: 'Browse live signals and take a YES or NO position.' },
  { num: '03', title: 'Earn Yield', desc: 'Your LST earns staking APY the entire time it is locked.' },
  { num: '04', title: 'Claim Winnings', desc: 'Winners split the losing pool on top of the yield earned.' },
]

/* ── Scoped CSS for editorial effects ───────────────────────────── */

const editorialCSS = `
  /* ── Animated gradient background ─────────────────────────── */
  @keyframes drift-1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    25% { transform: translate(80px, -60px) scale(1.1); }
    50% { transform: translate(-40px, 40px) scale(0.95); }
    75% { transform: translate(60px, 80px) scale(1.05); }
  }
  @keyframes drift-2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    25% { transform: translate(-70px, 50px) scale(1.08); }
    50% { transform: translate(50px, -80px) scale(0.92); }
    75% { transform: translate(-60px, -40px) scale(1.02); }
  }
  @keyframes drift-3 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(90px, 60px) scale(1.12); }
    66% { transform: translate(-50px, -70px) scale(0.9); }
  }

  @keyframes drift-4 {
    0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); }
    25% { transform: translate(-100px, -80px) scale(1.15) rotate(3deg); }
    50% { transform: translate(60px, 100px) scale(0.88) rotate(-2deg); }
    75% { transform: translate(80px, -50px) scale(1.06) rotate(1deg); }
  }

  .animated-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .animated-bg .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(70px);
  }
  .animated-bg .orb-1 {
    width: 700px; height: 700px;
    top: -15%; right: -10%;
    background: radial-gradient(circle, hsl(221 83% 53% / 0.5), hsl(221 83% 53% / 0.1) 50%, transparent 70%);
    animation: drift-1 18s ease-in-out infinite;
  }
  .animated-bg .orb-2 {
    width: 600px; height: 600px;
    top: 30%; left: -12%;
    background: radial-gradient(circle, hsl(258 90% 66% / 0.4), hsl(258 90% 66% / 0.08) 50%, transparent 70%);
    animation: drift-2 22s ease-in-out infinite;
  }
  .animated-bg .orb-3 {
    width: 550px; height: 550px;
    bottom: 5%; right: 15%;
    background: radial-gradient(circle, hsl(160 84% 39% / 0.35), hsl(160 84% 39% / 0.06) 50%, transparent 70%);
    animation: drift-3 20s ease-in-out infinite;
  }
  .animated-bg .orb-4 {
    width: 450px; height: 450px;
    top: 55%; left: 40%;
    background: radial-gradient(circle, hsl(221 83% 60% / 0.3), transparent 60%);
    animation: drift-4 26s ease-in-out infinite;
  }
  .animated-bg .orb-5 {
    width: 350px; height: 350px;
    top: 10%; left: 30%;
    background: radial-gradient(circle, hsl(30 90% 60% / 0.2), transparent 60%);
    animation: drift-1 28s ease-in-out infinite reverse;
  }
  .animated-bg .orb-6 {
    width: 500px; height: 500px;
    bottom: 25%; left: -5%;
    background: radial-gradient(circle, hsl(221 83% 53% / 0.25), transparent 65%);
    animation: drift-3 24s ease-in-out infinite reverse;
  }
  .animated-bg .orb-7 {
    width: 300px; height: 300px;
    top: 70%; right: -3%;
    background: radial-gradient(circle, hsl(258 90% 66% / 0.3), transparent 60%);
    animation: drift-2 19s ease-in-out infinite reverse;
  }

  .editorial-hero-shape {
    position: absolute;
    border: 2px solid hsl(221 83% 53% / 0.15);
    pointer-events: none;
  }
  .editorial-hero-shape.diamond-1 {
    width: 120px; height: 120px;
    top: 12%; right: 8%;
    transform: rotate(45deg);
    border-color: hsl(221 83% 53% / 0.18);
    background: hsl(221 83% 53% / 0.04);
    animation: drift-2 18s ease-in-out infinite;
  }
  .editorial-hero-shape.diamond-2 {
    width: 70px; height: 70px;
    top: 55%; right: 15%;
    transform: rotate(45deg);
    border-color: hsl(258 90% 66% / 0.18);
    background: hsl(258 90% 66% / 0.04);
    animation: drift-1 15s ease-in-out infinite;
  }
  .editorial-hero-shape.diamond-3 {
    width: 160px; height: 160px;
    bottom: 12%; left: 4%;
    transform: rotate(45deg);
    border-color: hsl(160 84% 39% / 0.14);
    background: hsl(160 84% 39% / 0.03);
    animation: drift-3 20s ease-in-out infinite;
  }
  .editorial-hero-shape.circle-1 {
    width: 90px; height: 90px;
    border-radius: 50%;
    top: 20%; left: 55%;
    border-color: hsl(221 83% 53% / 0.15);
    background: hsl(221 83% 53% / 0.03);
    animation: drift-2 16s ease-in-out infinite;
  }
  .editorial-hero-shape.diamond-4 {
    width: 50px; height: 50px;
    top: 35%; left: 10%;
    transform: rotate(45deg);
    border-color: hsl(30 90% 60% / 0.15);
    background: hsl(30 90% 60% / 0.04);
    animation: drift-4 14s ease-in-out infinite;
  }
  .editorial-hero-shape.circle-2 {
    width: 40px; height: 40px;
    border-radius: 50%;
    top: 75%; right: 40%;
    border-color: hsl(258 90% 66% / 0.12);
    background: hsl(258 90% 66% / 0.03);
    animation: drift-1 17s ease-in-out infinite reverse;
  }

  .category-strip {
    transition: padding-top 0.3s ease, padding-bottom 0.3s ease;
  }
  .category-strip:hover {
    padding-top: 2rem;
    padding-bottom: 2rem;
  }

  .signal-card-editorial {
    min-width: 300px;
    scroll-snap-align: start;
    flex-shrink: 0;
  }

  .editorial-underline {
    position: relative;
    display: inline-block;
  }
  .editorial-underline::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -2px;
    width: 0;
    height: 2px;
    background: hsl(221 83% 53%);
    transition: width 0.3s ease;
  }
  .editorial-underline:hover::after {
    width: 100%;
  }

  .split-clip-left {
    clip-path: polygon(0 0, 100% 0, 95% 100%, 0 100%);
  }
  .split-clip-right {
    clip-path: polygon(5% 0, 100% 0, 100% 100%, 0 100%);
  }

  @media (max-width: 768px) {
    .split-clip-left,
    .split-clip-right {
      clip-path: none;
    }
  }

  .horiz-scroll-row {
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }
  .horiz-scroll-row::-webkit-scrollbar {
    height: 4px;
  }
  .horiz-scroll-row::-webkit-scrollbar-thumb {
    background: hsl(221 83% 53% / 0.2);
    border-radius: 999px;
  }

  .step-number {
    font-size: 5rem;
    font-weight: 100;
    line-height: 1;
    color: hsl(221 83% 53% / 0.12);
    letter-spacing: -0.04em;
  }

  .editorial-border-reveal {
    border-left: 3px solid transparent;
    transition: border-color 0.3s ease;
  }
  .editorial-border-reveal:hover {
    border-left-color: hsl(221 83% 53%);
  }
`

/* ── Horizon badge color ────────────────────────────────────────── */

function horizonStyle(h: string) {
  if (h === 'Daily') return 'bg-amber-100 text-amber-800'
  if (h === 'Monthly') return 'bg-violet-100 text-violet-800'
  return 'bg-brand-100 text-brand-800'
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: editorialCSS }} />

      <div className="min-h-screen bg-white relative">
        {/* ── Minimal Nav ─────────────────────────────────────── */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="StakeSignal" width={28} height={28} className="rounded-md" />
              <span className="text-base font-bold tracking-tight text-foreground">
                StakeSignal
              </span>
            </Link>
            <Link
              href="/signals"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              Launch App
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </nav>

        {/* ── Section 1: HERO ─────────────────────────────────── */}
        <section className="relative min-h-screen flex items-center overflow-hidden">
          {/* Animated gradient background — hero only */}
          <div className="animated-bg">
            <div className="orb orb-1" />
            <div className="orb orb-2" />
            <div className="orb orb-3" />
            <div className="orb orb-4" />
            <div className="orb orb-5" />
            <div className="orb orb-6" />
            <div className="orb orb-7" />
          </div>
          {/* Geometric decorations */}
          <div className="editorial-hero-shape diamond-1" />
          <div className="editorial-hero-shape diamond-2" />
          <div className="editorial-hero-shape diamond-3" />
          <div className="editorial-hero-shape diamond-4" />
          <div className="editorial-hero-shape circle-1" />
          <div className="editorial-hero-shape circle-2" />

          <div className="max-w-7xl mx-auto px-6 sm:px-10 pt-24 pb-16">
            <div className="max-w-4xl">
              <p className="font-mono text-xs tracking-widest text-gray-400 uppercase mb-6">
                Prediction markets on Solana ecosystem events
              </p>
              <h1 className="text-5xl sm:text-6xl lg:text-[6.5rem] font-extrabold tracking-tight text-foreground leading-[0.95]">
                Your LST.
                <br />
                Your{' '}
                <span className="text-brand-600">Signal.</span>
              </h1>
              <p className="mt-8 text-lg sm:text-xl text-gray-500 max-w-xl leading-relaxed">
                Stake mSOL or jitoSOL on Solana network events, DeFi milestones,
                and MEV signals. Earn staking yield while your position is open
                &mdash; regardless of outcome.
              </p>
              <div className="mt-10">
                <Link
                  href="/signals"
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-brand-600 text-white text-base font-semibold shadow-lg shadow-brand-600/20 hover:bg-brand-700 hover:shadow-brand-600/30 transition-all"
                >
                  Start Predicting
                  <ArrowRight className="h-4.5 w-4.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 2: WHAT IS STAKESIGNAL — Split screen ──── */}
        <section className="relative bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 min-h-[70vh]">
            {/* Left panel — white */}
            <div className="flex items-center px-6 sm:px-10 lg:px-16 py-16 md:py-0">
              <div className="max-w-md">
                <p className="font-mono text-xs tracking-widest text-gray-400 uppercase mb-4">
                  The concept
                </p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
                  Stake mSOL.
                  <br />
                  Predict events.
                  <br />
                  <span className="text-brand-600">Earn 7.5% APY</span>
                  <br />
                  while you wait.
                </h2>
                <p className="mt-6 text-gray-500 leading-relaxed">
                  Unlike traditional prediction markets, your collateral keeps
                  working. LST tokens generate staking yield the entire time they
                  are locked in a position.
                </p>
              </div>
            </div>

            {/* Right panel — brand-50 with a mockup signal card */}
            <div className="flex items-center justify-center bg-brand-50 px-6 sm:px-10 py-16 md:py-0">
              <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-100 text-brand-700">
                    Weekly
                  </span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                    Network
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground leading-snug mb-5">
                  Solana TPS peaks above 5,000 this week
                </h3>
                <div className="space-y-2 mb-5">
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-emerald-600">YES 63%</span>
                    <span className="text-violet-600">NO 37%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full overflow-hidden bg-violet-100 flex">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '63%' }} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Coins className="h-3 w-3" />
                    9,420 LST
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    147 participants
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 3: HOW IT WORKS — Horizontal numbered steps ─ */}
        <section className="py-20 sm:py-28 border-t border-gray-100 bg-white relative z-10">
          <div className="max-w-7xl mx-auto px-6 sm:px-10">
            <p className="font-mono text-xs tracking-widest text-gray-400 uppercase mb-3">
              How it works
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-16">
              Four steps to your first signal
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
              {steps.map((step, idx) => (
                <div
                  key={step.num}
                  className={`editorial-border-reveal py-8 px-6 ${
                    idx > 0 ? 'lg:border-l lg:border-l-gray-100' : ''
                  }`}
                >
                  <span className="step-number">{step.num}</span>
                  <h3 className="text-lg font-bold text-foreground mt-3 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 4: MARKET CATEGORIES — Full-width strips ──── */}
        <section className="border-t border-gray-100 bg-white relative z-10">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 pt-20 sm:pt-28 pb-4">
            <p className="font-mono text-xs tracking-widest text-gray-400 uppercase mb-3">
              Categories
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-12">
              Predict across four dimensions
            </h2>
          </div>

          {marketCategories.map((cat) => {
            const Icon = cat.icon
            return (
              <div
                key={cat.name}
                className={`category-strip border-t border-gray-100 ${cat.bgColor} px-6 sm:px-10 py-5 cursor-default`}
              >
                <div className="max-w-7xl mx-auto flex items-center gap-6">
                  <Icon className={`h-7 w-7 ${cat.iconColor} shrink-0`} />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6 flex-1 min-w-0">
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight shrink-0">
                      {cat.name}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">{cat.description}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-300 shrink-0 hidden sm:block" />
                </div>
              </div>
            )
          })}
        </section>

        {/* ── Section 5: LIVE PREVIEW — Horizontal scroll ──────── */}
        <section className="py-20 sm:py-28 border-t border-gray-100 bg-white relative z-10">
          <div className="max-w-7xl mx-auto px-6 sm:px-10">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="font-mono text-xs tracking-widest text-gray-400 uppercase mb-3">
                  Preview
                </p>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                  Live Signals
                </h2>
              </div>
              <Link
                href="/signals"
                className="editorial-underline text-sm font-semibold text-brand-600 hidden sm:inline-block"
              >
                View all signals
              </Link>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-6 sm:px-10">
            <div className="horiz-scroll-row flex gap-5 pb-4">
              {liveSignals.map((signal, idx) => (
                <div
                  key={idx}
                  className="signal-card-editorial bg-white border border-gray-200 rounded-xl p-5 space-y-4 hover:border-brand-300 transition-colors"
                >
                  {/* Tags */}
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${horizonStyle(signal.horizon)}`}>
                      {signal.horizon}
                    </span>
                    <span className="text-[11px] font-medium text-gray-400">{signal.category}</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-bold text-foreground leading-snug min-h-[2.5rem]">
                    {signal.title}
                  </h3>

                  {/* YES / NO bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-emerald-600">YES {signal.yesPct}%</span>
                      <span className="text-violet-600">NO {100 - signal.yesPct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden bg-violet-100">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${signal.yesPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-[11px] text-gray-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      {signal.pool} LST
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {signal.bettors}
                    </span>
                    <span className="flex items-center gap-1 ml-auto">
                      <Clock className="h-3 w-3" />
                      {signal.timeLeft}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 6: FINAL — Dark CTA ─────────────────────── */}
        <section className="bg-brand-900 py-20 sm:py-28">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Built for Solana.
              <br />
              Powered by LST.
            </h2>

            <div className="flex flex-wrap items-center justify-center gap-10 sm:gap-16 mt-12">
              <div>
                <p className="text-3xl sm:text-4xl font-extrabold text-white">13</p>
                <p className="text-sm text-brand-300 mt-1">signals</p>
              </div>
              <div className="w-px h-10 bg-brand-700 hidden sm:block" />
              <div>
                <p className="text-3xl sm:text-4xl font-extrabold text-white">3</p>
                <p className="text-sm text-brand-300 mt-1">horizons</p>
              </div>
              <div className="w-px h-10 bg-brand-700 hidden sm:block" />
              <div>
                <p className="text-3xl sm:text-4xl font-extrabold text-white">7.5%</p>
                <p className="text-sm text-brand-300 mt-1">APY while locked</p>
              </div>
            </div>

            <div className="mt-12">
              <Link
                href="/signals"
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full border-2 border-white text-white text-base font-semibold hover:bg-white hover:text-brand-900 transition-all"
              >
                Launch App
                <ArrowRight className="h-4.5 w-4.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className="bg-brand-900 border-t border-brand-800 py-8">
          <div className="max-w-7xl mx-auto px-6 sm:px-10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Image src="/logo.png" alt="StakeSignal" width={22} height={22} className="rounded-md brightness-200" />
                <span className="text-sm font-semibold text-white">StakeSignal</span>
                <span className="text-xs text-brand-400">&copy; 2026</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-brand-400">
                <a
                  href="https://github.com/CPIDEV-v1/cpitracker"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="editorial-underline hover:text-white transition-colors"
                >
                  GitHub
                </a>
                <a
                  href="https://x.com/CPITracker_sol"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="editorial-underline hover:text-white transition-colors"
                >
                  Twitter
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
