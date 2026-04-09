export default function PortfolioPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Portfolio</h2>
        <p className="text-muted-foreground mt-1">
          Your active positions and accumulated yield
        </p>
      </div>

      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        Connect wallet to view positions
      </div>
    </div>
  )
}
