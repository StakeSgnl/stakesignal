# Local setup

A walk-through for running stakesignal end-to-end on your laptop — contract,
crank, and frontend.

## Prerequisites

- Node 20 LTS, Rust 1.75+, Anchor 0.30
- Solana CLI configured for devnet: `solana config set --url devnet`
- A funded devnet wallet at `~/.config/solana/id.json`
- Helius RPC key (free tier is fine)

## 1. Contract

```bash
cd programs/stakesignal
anchor build
anchor deploy --provider.cluster devnet
```

The deploy emits the program id — copy it into `web/.env.local` as
`NEXT_PUBLIC_PROGRAM_ID` and into `crank/config.toml` as `program_id`.

## 2. Crank

The crank monitors Pyth Hermes feeds and resolves markets that have hit
their resolution time.

```bash
cd crank
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in PROGRAM_ID, PYTH_HERMES_URL, RPC_URL, KEYPAIR
python pyth_resolver.py --once   # smoke-test
python pyth_resolver.py          # production loop
```

## 3. Frontend

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 — Phantom should auto-connect on devnet.

## Seeding markets

```bash
cd crank
python create_markets.py --markets sol_tps,jito_tips,marinade_tvl
```

Each market gets seeded with default LST mints (mSOL/jitoSOL) and a 7-day
resolution window.

## Common issues

- **"program not deployed"** — make sure `solana config get` shows devnet,
  re-run `anchor deploy`
- **Phantom shows wrong network** — toggle Phantom → Settings → Developer
  Settings → Show Test Networks → Devnet
- **Pyth feed missing** — check `PYTH_HERMES_URL` resolves; some markets use
  beta Hermes (`hermes-beta.pyth.network`)
