/**
 * Seed Solana ecosystem prediction markets on devnet.
 *
 * Usage:  node scripts/seed-markets.mjs
 * Requires: deploy-keypair.json (factory authority)
 */

import { readFileSync } from 'fs'
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { AnchorProvider, Program, BN, Wallet } from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

const RPC = 'https://api.devnet.solana.com'
const PROGRAM_ID = new PublicKey('2WNxCQG7khECic8tNgWwPgEtEkVKrXhn9b5pSdKfR35b')

// Load IDL
const idl = JSON.parse(readFileSync(new URL('./src/lib/idl.json', import.meta.url), 'utf8'))

// Load deploy keypair (factory authority)
const secretKey = Uint8Array.from(JSON.parse(readFileSync(new URL('../deploy-keypair.json', import.meta.url), 'utf8')))
const authority = Keypair.fromSecretKey(secretKey)
console.log('authority:', authority.publicKey.toBase58())

// Setup
const connection = new Connection(RPC, 'confirmed')
const wallet = new Wallet(authority)
const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
const program = new Program(idl, provider)

// Read factory to get LST mint and current market count
const enc = new TextEncoder()
const [factoryPda] = PublicKey.findProgramAddressSync([enc.encode('signal_factory')], PROGRAM_ID)

const factoryInfo = await connection.getAccountInfo(factoryPda)
if (!factoryInfo) {
  console.error('Factory not found — initialize first')
  process.exit(1)
}

// Parse factory: discriminator(8) + authority(32) + total_markets(u64=8) + bump(1) + ...
const fd = factoryInfo.data
let foff = 8 + 32
const totalMarkets = Number(fd.readBigUInt64LE(foff))
console.log('current totalMarkets:', totalMarkets)

// Find the LST mint from existing markets
const accounts = await connection.getProgramAccounts(PROGRAM_ID)
let lstMint = null
for (const { account } of accounts) {
  const d = account.data
  if (d.length < 100) continue
  try {
    let off = 8 // discriminator
    off += 8 // market_id
    const titleLen = d.readUInt32LE(off); off += 4
    if (titleLen > 128 || titleLen === 0) continue
    off += titleLen
    const descLen = d.readUInt32LE(off); off += 4
    if (descLen > 256) continue
    off += descLen
    off += 32 // creator
    lstMint = new PublicKey(d.subarray(off, off + 32))
    console.log('found LST mint:', lstMint.toBase58())
    break
  } catch { continue }
}

if (!lstMint) {
  console.error('Could not find LST mint from existing markets')
  process.exit(1)
}

// ── UTC-aligned resolve times ───────────────────────────────────────
function nextMidnightUTC() {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) / 1000
}

function nextSundayMidnightUTC() {
  const now = new Date()
  const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilSunday) / 1000
}

function endOfMonthMidnightUTC() {
  const now = new Date()
  // Day 0 of next month = last day of current month, midnight
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1000
}

const resolveDaily = nextMidnightUTC()
const resolveWeekly = nextSundayMidnightUTC()
const resolveMonthly = endOfMonthMidnightUTC()

console.log('resolve times (UTC):')
console.log('  daily  →', new Date(resolveDaily * 1000).toISOString())
console.log('  weekly →', new Date(resolveWeekly * 1000).toISOString())
console.log('  monthly→', new Date(resolveMonthly * 1000).toISOString())

// ── Market definitions ──────────────────────────────────────────────
const MARKETS = [
  // Daily — resolves at next midnight UTC
  {
    title: 'Solana processes 50M+ transactions today',
    description: 'Will the Solana network exceed 50 million total transactions before midnight UTC? Resolved via Solana Explorer data.',
    resolveAt: resolveDaily,
  },
  {
    title: 'Jito tips exceed 500 SOL by end of day',
    description: 'Will total Jito MEV tips surpass 500 SOL across all bundles before midnight UTC? Source: jito.wtf dashboard.',
    resolveAt: resolveDaily,
  },
  {
    title: 'Average Solana block time stays under 450ms today',
    description: 'Will the average block time remain below 450ms until midnight UTC? Congestion spikes push it higher. Resolved via Solana Explorer.',
    resolveAt: resolveDaily,
  },
  {
    title: 'More than 200 new SPL tokens minted today',
    description: 'Will more than 200 new SPL token mints be created on Solana before midnight UTC? Pump.fun alone can drive hundreds. Source: Solscan.',
    resolveAt: resolveDaily,
  },
  // Weekly — resolves Sunday midnight UTC
  {
    title: 'A single Jito bundle tip exceeds 100 SOL this week',
    description: 'Will any single Jito bundle include a tip of 100+ SOL before Sunday midnight UTC? Whales competing for priority. Resolved via Jito explorer.',
    resolveAt: resolveWeekly,
  },
  {
    title: 'Solana TPS peaks above 5,000 this week',
    description: 'Will Solana real (non-vote) TPS hit 5,000+ at any point before Sunday midnight UTC? Resolved via Solana Explorer.',
    resolveAt: resolveWeekly,
  },
  {
    title: 'New Solana token reaches $50M market cap this week',
    description: 'Will any newly launched Solana token hit $50M+ market cap before Sunday midnight UTC? Tracked via Birdeye/DexScreener.',
    resolveAt: resolveWeekly,
  },
  // Monthly — resolves at end of month midnight UTC
  {
    title: 'Solana experiences a network outage this month',
    description: 'Will Solana mainnet-beta suffer a full or partial outage (block production halt > 30 min) before month end UTC? Resolved via Solana Status page.',
    resolveAt: resolveMonthly,
  },
  {
    title: 'Total SOL staked exceeds 400M this month',
    description: 'Will the total staked SOL cross the 400M mark before month end UTC? Currently hovering near 380M. Source: Solana Beach validators page.',
    resolveAt: resolveMonthly,
  },
  {
    title: 'A single priority fee exceeds 1,000 SOL this month',
    description: 'Will anyone pay a priority fee above 1,000 SOL for a single transaction before month end UTC? Extreme MEV events happen during hot mints.',
    resolveAt: resolveMonthly,
  },
  {
    title: 'Solana DeFi TVL crosses $8B this month',
    description: 'Will total value locked across Solana DeFi protocols exceed $8 billion before month end UTC? Tracked via DefiLlama. Currently ~$7.2B.',
    resolveAt: resolveMonthly,
  },
  {
    title: 'A new validator enters the top 20 by stake',
    description: 'Will a validator not currently in the top 20 break into it before month end UTC? Delegation shifts shake the ranking. Source: Solana Beach.',
    resolveAt: resolveMonthly,
  },
  {
    title: 'Solana processes 1.5B total transactions this month',
    description: 'Will the Solana network hit 1.5B transactions within the calendar month (UTC)? Daily averages need to stay above 50M. Source: Solana Explorer.',
    resolveAt: resolveMonthly,
  },
]

// ── Create markets ──────────────────────────────────────────────────
console.log(`\nCreating ${MARKETS.length} markets...\n`)

let created = 0
for (const m of MARKETS) {
  const resolveAt = new BN(m.resolveAt)

  try {
    const tx = await program.methods
      .createMarket(
        m.title,
        m.description,
        resolveAt,
        { manual: {} },      // ResolutionSource::Manual
        null,                 // pyth_feed_id
        null,                 // target_price
        null,                 // target_condition
      )
      .accountsPartial({
        lstMint: lstMint,
        creator: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    created++
    console.log(`  ✓ [${created}/${MARKETS.length}] ${m.title}`)
    console.log(`    tx: ${tx.slice(0, 24)}...`)
  } catch (err) {
    console.error(`  ✗ ${m.title}`)
    console.error(`    ${err.message?.slice(0, 120)}`)
  }

  // Small delay to avoid rate limits
  await new Promise(r => setTimeout(r, 1500))
}

console.log(`\nDone — ${created}/${MARKETS.length} markets created`)
