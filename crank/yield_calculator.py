"""
Yield Calculator — StakeSignal

Fetches LST exchange rates (mSOL, jitoSOL) from on-chain data
and REST APIs. Calculates accumulated yield for positions based
on entry rate vs current rate.

Usage:
  python yield_calculator.py                 # print current rates
  python yield_calculator.py --positions     # show yield for all positions
"""

import argparse
import struct
import hashlib
import logging

import httpx
from solders.pubkey import Pubkey
from solana.rpc.api import Client
from solana.rpc.commitment import Confirmed

from config import (
    RPC_URL,
    PROGRAM_ID,
    MSOL_MINT,
    JITOSOL_MINT,
)
from pda import PROGRAM_PUBKEY

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger('yield_calc')

rpcClient = Client(RPC_URL)

MARINADE_STATE_PUBKEY = Pubkey.from_string('8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC')
MSOL_MINT_PUBKEY = Pubkey.from_string(MSOL_MINT)
JITOSOL_MINT_PUBKEY = Pubkey.from_string(JITOSOL_MINT)

SANCTUM_LST_API = 'https://sanctum-s-api.fly.dev/v1/sol-value/current'
MARINADE_STATS_API = 'https://api.marinade.finance/msol/price_sol'

# Anchor account discriminator for UserPosition
POSITION_DISCRIMINATOR = hashlib.sha256(b'account:UserPosition').digest()[:8]

# Known APY estimates — updated periodically from on-chain data
LST_APY_ESTIMATES = {
    'mSOL': 6.8,
    'jitoSOL': 7.2,
}


def fetch_msol_exchange_rate() -> float | None:
    """Fetch mSOL→SOL exchange rate from Marinade API."""
    try:
        resp = httpx.get(MARINADE_STATS_API, timeout=15)
        resp.raise_for_status()
        rate = float(resp.text)
        return rate
    except Exception as exc:
        log.warning(f'marinade API failed, trying sanctum fallback: {exc}')

    try:
        resp = httpx.get(
            SANCTUM_LST_API,
            params={'lst': MSOL_MINT},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        solValue = int(data.get('solValue', 0))
        if solValue > 0:
            return solValue / 1_000_000_000
    except Exception as exc:
        log.error(f'failed to fetch mSOL rate from both sources: {exc}')

    return None


def fetch_jitosol_exchange_rate() -> float | None:
    """Fetch jitoSOL→SOL exchange rate from Sanctum API."""
    try:
        resp = httpx.get(
            SANCTUM_LST_API,
            params={'lst': JITOSOL_MINT},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        solValue = int(data.get('solValue', 0))
        if solValue > 0:
            return solValue / 1_000_000_000
    except Exception as exc:
        log.error(f'failed to fetch jitoSOL rate: {exc}')

    return None


def get_all_rates() -> dict:
    """Fetch all LST exchange rates. Keyed by mint address string."""
    msolRate = fetch_msol_exchange_rate()
    jitosolRate = fetch_jitosol_exchange_rate()

    rates = {}
    if msolRate is not None:
        rates[MSOL_MINT] = {
            'symbol': 'mSOL',
            'rate': msolRate,
            'estimatedApy': LST_APY_ESTIMATES.get('mSOL', 5.0),
        }
    if jitosolRate is not None:
        rates[JITOSOL_MINT] = {
            'symbol': 'jitoSOL',
            'rate': jitosolRate,
            'estimatedApy': LST_APY_ESTIMATES.get('jitoSOL', 5.0),
        }
    return rates


def calculate_position_yield(
    lstAmount: int,
    yieldAtEntry: int,
    currentRate: float,
    lstDecimals: int = 9,
) -> dict:
    """Calculate accumulated yield for a position.

    yieldAtEntry: LST exchange rate at entry time (stored as u64, 9 decimals)
    currentRate: current LST→SOL rate (float)
    """
    entryRate = yieldAtEntry / (10 ** lstDecimals) if yieldAtEntry > 0 else 1.0
    tokenAmount = lstAmount / (10 ** lstDecimals)

    if entryRate <= 0:
        entryRate = 1.0

    rateGrowth = currentRate / entryRate
    yieldEarned = tokenAmount * (rateGrowth - 1.0)
    yieldPercent = (rateGrowth - 1.0) * 100

    return {
        'tokenAmount': tokenAmount,
        'entryRate': entryRate,
        'currentRate': currentRate,
        'yieldEarned': yieldEarned,
        'yieldPercent': yieldPercent,
        'totalValue': tokenAmount * currentRate,
    }


def fetch_open_positions() -> list[dict]:
    """Fetch all UserPosition accounts from the program."""
    try:
        response = rpcClient.get_program_accounts(PROGRAM_PUBKEY, commitment=Confirmed)
        if response.value is None:
            return []

        positions = []
        for accountInfo in response.value:
            data = bytes(accountInfo.account.data)
            parsed = parse_position_account(data)
            if parsed is not None and not parsed['claimed']:
                parsed['pubkey'] = accountInfo.pubkey
                positions.append(parsed)
        return positions

    except Exception as exc:
        log.error(f'failed to fetch positions: {exc}')
        return []


def parse_position_account(data: bytes) -> dict | None:
    """Parse UserPosition account data.

    Layout after 8-byte discriminator:
      user: Pubkey (32)
      market: Pubkey (32)
      side: enum u8 (1) — 0=Yes, 1=No
      lst_amount: u64 (8)
      yield_at_entry: u64 (8)
      placed_at: i64 (8)
      claimed: bool (1)
      bump: u8 (1)
    Total: 8 + 32 + 32 + 1 + 8 + 8 + 8 + 1 + 1 = 99
    """
    if len(data) < 99:
        return None

    # Verify Anchor discriminator
    if data[:8] != POSITION_DISCRIMINATOR:
        return None

    try:
        offset = 8
        user = Pubkey.from_bytes(data[offset:offset + 32])
        offset += 32

        market = Pubkey.from_bytes(data[offset:offset + 32])
        offset += 32

        side = data[offset]
        offset += 1

        lstAmount = struct.unpack_from('<Q', data, offset)[0]
        offset += 8

        yieldAtEntry = struct.unpack_from('<Q', data, offset)[0]
        offset += 8

        placedAt = struct.unpack_from('<q', data, offset)[0]
        offset += 8

        claimed = bool(data[offset])
        offset += 1

        bump = data[offset]

        return {
            'user': user,
            'market': market,
            'side': 'YES' if side == 0 else 'NO',
            'lstAmount': lstAmount,
            'yieldAtEntry': yieldAtEntry,
            'placedAt': placedAt,
            'claimed': claimed,
            'bump': bump,
        }

    except (struct.error, IndexError):
        return None


def get_market_lst_mint(marketPubkey: Pubkey) -> str | None:
    """Read the lst_mint field from a PredictionMarket account."""
    try:
        resp = rpcClient.get_account_info(marketPubkey, Confirmed)
        if resp.value is None:
            return None
        data = bytes(resp.value.data)
        # Skip discriminator(8) + market_id(8) + title string + desc string
        # to get lst_mint. Parse title/desc lengths first.
        offset = 8 + 8
        titleLen = struct.unpack_from('<I', data, offset)[0]
        offset += 4 + titleLen
        descLen = struct.unpack_from('<I', data, offset)[0]
        offset += 4 + descLen
        # Skip creator (32)
        offset += 32
        # lst_mint (32)
        lstMint = Pubkey.from_bytes(data[offset:offset + 32])
        return str(lstMint)
    except Exception:
        return None


def print_rates():
    """Print current LST exchange rates."""
    rates = get_all_rates()

    print('\n' + '=' * 56)
    print('  STAKESIGNAL — LST Exchange Rates')
    print('=' * 56)

    for mint, info in rates.items():
        print(f'\n  {info["symbol"]}')
        print(f'    Rate:  1 {info["symbol"]} = {info["rate"]:.6f} SOL')
        print(f'    APY:   ~{info["estimatedApy"]:.1f}%')

    if not rates:
        print('\n  Could not fetch rates — check API connectivity')

    print('\n' + '=' * 56 + '\n')
    return rates


def print_position_yields(rates: dict):
    """Print yield calculations for all open positions."""
    positions = fetch_open_positions()

    if not positions:
        print('  No open positions found')
        return

    print('\n' + '-' * 56)
    print('  Open Positions — Yield Summary')
    print('-' * 56)

    for pos in positions:
        # Determine which LST rate to use based on position's market LST mint
        lstMint = get_market_lst_mint(pos['market'])
        currentRate = 1.0
        lstSymbol = 'LST'

        if lstMint and lstMint in rates:
            currentRate = rates[lstMint]['rate']
            lstSymbol = rates[lstMint]['symbol']
        elif rates:
            # Fallback to first available rate
            firstRate = next(iter(rates.values()))
            currentRate = firstRate['rate']
            lstSymbol = firstRate['symbol']

        yieldInfo = calculate_position_yield(
            lstAmount=pos['lstAmount'],
            yieldAtEntry=pos['yieldAtEntry'],
            currentRate=currentRate,
        )

        print(f'\n  User: {str(pos["user"])[:8]}...')
        print(f'  Side: {pos["side"]}  |  Amount: {yieldInfo["tokenAmount"]:.4f} {lstSymbol}')
        print(f'  Entry rate: {yieldInfo["entryRate"]:.6f}  →  Current: {yieldInfo["currentRate"]:.6f}')
        print(f'  Yield earned: {yieldInfo["yieldEarned"]:.6f} SOL ({yieldInfo["yieldPercent"]:.3f}%)')
        print(f'  Total value: {yieldInfo["totalValue"]:.6f} SOL')

    print('\n' + '-' * 56 + '\n')


def main():
    parser = argparse.ArgumentParser(description='StakeSignal Yield Calculator')
    parser.add_argument(
        '--positions', action='store_true',
        help='Show yield for all open positions',
    )
    args = parser.parse_args()

    rates = print_rates()

    if args.positions:
        print_position_yields(rates)


if __name__ == '__main__':
    main()
