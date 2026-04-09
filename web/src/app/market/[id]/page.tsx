export default function MarketDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Market #{params.id}</p>
        <h2 className="text-2xl font-semibold tracking-tight mt-1">
          Market detail view
        </h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border bg-card p-6">
          <p className="text-muted-foreground">Price chart + pool distribution</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground">Position panel</p>
        </div>
      </div>
    </div>
  )
}
