# Seeded markets

The 13 markets currently on devnet. Each has a Pyth-resolved end condition
and is funded with mSOL/jitoSOL collateral.

| id            | question                                               | resolves at        |
|---------------|--------------------------------------------------------|--------------------|
| sol_tps       | Will SOL TPS exceed 5,000 sustained for 24h?           | 2026-05-15 00:00 Z |
| jito_tips_h   | Will Jito tips exceed 0.05 SOL/block (rolling 7d)?     | 2026-05-12 00:00 Z |
| network_outage| Will Solana have a network outage > 30 min in May?     | 2026-05-31 00:00 Z |
| stake_tvl     | Will total LST TVL surpass 25M SOL?                    | 2026-05-20 00:00 Z |
| marinade_apy  | Will Marinade base APY drop below 6.5%?                | 2026-05-13 00:00 Z |
| jup_volume    | Will Jupiter daily volume exceed $4B?                  | 2026-05-09 00:00 Z |
| token2022_use | Will Token-2022 adoption pass 5% of new mints?         | 2026-05-25 00:00 Z |
| firedancer    | Will Firedancer hit mainnet by end of May?             | 2026-05-31 00:00 Z |
| sol_price     | Will SOL/USD close above $200 on May 11?               | 2026-05-11 00:00 Z |
| sol_low       | Will SOL/USD print below $130 in next 14 days?         | 2026-05-15 00:00 Z |
| spl_growth    | Will SPL token count grow by ≥ 5k in May?              | 2026-05-31 00:00 Z |
| validator_inc | Will validator count surpass 1,500?                    | 2026-05-25 00:00 Z |
| vrf_outage    | Will Switchboard or VRF have a >2h outage in May?      | 2026-05-31 00:00 Z |

## How resolution works

For each market the resolver crank polls Pyth Hermes (or for non-Pyth
metrics, the relevant network indexer) at the `resolves_at` UTC instant.
The on-chain `resolve(side)` instruction is then submitted with the side
that matches truth.

If the underlying data source is missing/stale at the resolution moment,
resolution is **deferred 24h** and the market enters a `pending` state.

## Adding a new market

1. Append a row to `crank/markets.toml`
2. Run `python crank/seed_market.py --id <id>` — creates the on-chain PDA
3. Add a row above to keep this doc in sync
4. Bump `web/src/lib/constants.ts` MARKETS list
