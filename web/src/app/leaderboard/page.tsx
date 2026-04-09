export default function LeaderboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Leaderboard</h2>
        <p className="text-muted-foreground mt-1">
          Top predictors by accuracy and yield earned
        </p>
      </div>

      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        No data yet
      </div>
    </div>
  )
}
