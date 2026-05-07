# Changelog

All notable changes to StakeSignal — prediction markets with LST collateral.

## [0.6.6] — final-stretch polish

### Added
- Time-left helper extracted to `web/src/lib/timeLeft.ts` with UTC-agnostic formatter and `soon`/`ended` short labels
- Setup walkthrough at `docs/setup.md` covering contract, crank, and frontend end-to-end
- Common-issues troubleshooting section in setup doc

### Changed
- Time-left formatting now used identically across signals page, market detail, and portfolio (no more drift)

## [0.6.5] — phase 6.5 polish

### Added
- Sidebar layout, glassmorphism panel treatment across markets/portfolio
- 13 Solana ecosystem markets seeded on devnet (TPS, Jito tips, outages, TVL, staking)
- UTC-aligned resolution windows so a market resolves at the exact stroke of UTC midnight
- Claim winnings flow surfaced on the position card
- Leaderboard page with seeded demo data
- Editorial landing page with animated gradient backdrop
- Logo + favicon set, social meta tags

### Changed
- Switched RPC default to Helius for stable devnet throughput
- YES/NO accent palette unified on emerald + violet for color-blind contrast

### Fixed
- 3 critical issues from the security audit (oracle account validation, payout rounding, claim-twice guard)

## [0.6.0] — phase 6 foundation

### Added
- Anchor program: factory + market + position state, place/resolve/claim instructions
- Pyth oracle wiring with staleness check and confidence-interval bounds
- Python crank: scheduler, resolver, payout calc, indexer
- Next.js frontend with shadcn/ui primitives, market detail, portfolio view
