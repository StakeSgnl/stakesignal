'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface in dev console; production logging is handled upstream.
    console.error('[StakeSignal] route error:', error)
  }, [error])

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

        <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-violet-100">
          <AlertTriangle className="h-7 w-7 text-violet-600" />
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-foreground mb-2">
          Signal lost
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Something interrupted this view. The position is safe on-chain &mdash;
          retry the request or head back to the dashboard.
        </p>

        {error?.digest && (
          <p className="font-mono text-[11px] tracking-wider text-gray-400 mb-6">
            ref&nbsp;{error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-brand-600 text-white text-sm font-semibold shadow-sm hover:bg-brand-700 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/signals"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border border-brand-200 text-brand-700 text-sm font-semibold bg-white/60 hover:bg-white transition-colors"
          >
            <Home className="h-4 w-4" />
            Back to signals
          </Link>
        </div>
      </div>
    </div>
  )
}
