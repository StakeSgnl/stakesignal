export default function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Active Markets</h2>
        <p className="text-muted-foreground mt-1">
          Earn staking yield while you predict
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MarketCardPlaceholder />
        <MarketCardPlaceholder />
        <MarketCardPlaceholder />
      </div>
    </div>
  )
}

function MarketCardPlaceholder() {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
      <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
      <div className="flex justify-between">
        <div className="h-8 w-20 rounded bg-muted animate-pulse" />
        <div className="h-8 w-20 rounded bg-muted animate-pulse" />
      </div>
    </div>
  )
}
