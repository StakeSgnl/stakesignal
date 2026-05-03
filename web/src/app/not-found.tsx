import Link from 'next/link'
import Image from 'next/image'
import { Compass, ArrowRight } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh bg-dot-pattern px-6 py-16">
      <div className="glass-card-elevated w-full max-w-md rounded-2xl p-8 text-center animate-fade-up">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <Image
            src="/logo.png"
            alt="StakeSignal"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="text-lg font-bold tracking-tight text-brand-800">
            StakeSignal
          </span>
        </div>

        <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <Compass className="h-7 w-7 text-emerald-600" />
        </div>

        <p className="font-mono text-xs tracking-widest text-gray-400 uppercase mb-2">
          404 &middot; Off the chart
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground mb-2">
          No signal here
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          The page you&rsquo;re looking for has been resolved, retired, or never
          existed. Pick a live market from the dashboard.
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <Link
            href="/signals"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-brand-600 text-white text-sm font-semibold shadow-sm hover:bg-brand-700 transition-colors"
          >
            Browse signals
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border border-brand-200 text-brand-700 text-sm font-semibold bg-white/60 hover:bg-white transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
