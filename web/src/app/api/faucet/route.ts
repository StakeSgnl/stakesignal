/**
 * Devnet LST faucet — mints test tokens for the staking demo.
 *
 * POST /api/faucet
 * Body: { wallet: string }
 * Returns: { signature: string, amount: number, ata: string }
 *
 * Rate-limited: 1 mint per wallet per 24h (in-memory; resets on cold start).
 */

import { NextRequest, NextResponse } from 'next/server'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token'

const LST_MINT = new PublicKey('FdGYrB8TuMSTm9CMU6FujhvmQ9NpegXebXdBtbkuwXXb')
const MINT_AMOUNT = 100 * 1e9 // 100 LST × 1e9 (9 decimals)
const COOLDOWN_MS = 24 * 60 * 60 * 1000

const rateLimit = new Map<string, number>()

function loadAuthority(): Keypair {
  const raw = process.env.FAUCET_AUTHORITY_JSON?.trim()
  if (!raw) throw new Error('FAUCET_AUTHORITY_JSON env not set')
  let secret: number[]
  if (raw.startsWith('[')) {
    secret = JSON.parse(raw)
  } else {
    secret = raw
      .replace(/^[\(\[]+/, '')
      .replace(/[\)\]]+$/, '')
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number)
  }
  return Keypair.fromSecretKey(Uint8Array.from(secret.slice(0, 64)))
}

export async function POST(req: NextRequest) {
  let walletStr: string
  try {
    const body = await req.json()
    walletStr = String(body.wallet ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  if (!walletStr) {
    return NextResponse.json({ error: 'wallet pubkey required' }, { status: 400 })
  }

  let recipient: PublicKey
  try {
    recipient = new PublicKey(walletStr)
  } catch {
    return NextResponse.json({ error: 'invalid pubkey' }, { status: 400 })
  }

  const last = rateLimit.get(walletStr)
  if (last && Date.now() - last < COOLDOWN_MS) {
    const hoursLeft = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 3_600_000)
    return NextResponse.json(
      { error: `already minted recently — try again in ${hoursLeft}h` },
      { status: 429 },
    )
  }

  let authority: Keypair
  try {
    authority = loadAuthority()
  } catch (err) {
    console.error('faucet authority load failed:', err)
    return NextResponse.json({ error: 'faucet not configured' }, { status: 500 })
  }

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://api.devnet.solana.com'
  const conn = new Connection(rpcUrl, 'confirmed')

  try {
    const ata = await getOrCreateAssociatedTokenAccount(
      conn,
      authority,
      LST_MINT,
      recipient,
    )

    const sig = await mintTo(
      conn,
      authority,
      LST_MINT,
      ata.address,
      authority,
      MINT_AMOUNT,
    )

    rateLimit.set(walletStr, Date.now())

    return NextResponse.json({
      signature: sig,
      amount: 100,
      ata: ata.address.toBase58(),
    })
  } catch (err) {
    console.error('faucet mint failed:', err)
    const msg = err instanceof Error ? err.message : 'mint failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
