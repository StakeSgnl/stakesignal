# StakeSignal

**Prediction markets backed by liquid staking tokens.**

> live demo · devnet → [stakesignal.vercel.app](https://stakesignal.vercel.app)

## Problem

Prediction markets lock your capital — while you wait for resolution, your SOL earns nothing. That's an unacceptable opportunity cost in DeFi.

## Solution

StakeSignal accepts mSOL, jitoSOL, and other LSTs as collateral for YES/NO positions. Your collateral continues earning staking yield (~7% APY) while you wait for market resolution.

## How It Works

1. Browse open prediction markets
2. Deposit LST collateral to take a YES or NO position
3. Earn staking yield while your position is active
4. Collect winnings (collateral + yield + opponent's stake) on resolution

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Anchor (Rust) |
| Frontend | Next.js + shadcn/ui |
| Oracle | Pyth Network |
| Crank | Python resolver service |
| Fonts | Plus Jakarta Sans |

## Development

```bash
# Contracts
anchor build && anchor test

# Frontend
cd web && npm install && npm run dev

# Crank
cd crank && pip install -r requirements.txt && python resolver.py
```

## Architecture

The system consists of three main components:

- **On-chain program**: Handles market creation, position management, LST deposits, and payout distribution
- **Next.js frontend**: Dashboard for browsing markets, managing positions, and viewing yield
- **Python crank**: Monitors Pyth oracle feeds and resolves expired markets

## Screens

| | |
|---|---|
| ![dashboard](docs/screenshots/dashboard.png) | ![market detail](docs/screenshots/market-detail.png) |
| **dashboard** — markets, your positions, yield curve | **market detail** — pool sides, oracle feed, position panel |

> placeholders — drop fresh PNGs into `docs/screenshots/` once captured from the live build.

## License

MIT
