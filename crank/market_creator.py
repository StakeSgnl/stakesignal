"""
Market Creator — StakeSignal

Generates Solana-ecosystem prediction markets and creates them on-chain.
Supports scheduled rotation: daily, weekly, monthly.

Usage:
  python market_creator.py                     # show all templates
  python market_creator.py --create            # create all on-chain
  python market_creator.py --create --tier daily   # only daily
  python market_creator.py --schedule          # auto-detect what to create today
"""

import argparse
import calendar
import struct
import time
import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
from solders.pubkey import Pubkey
from solders.keypair import Keypair
from solders.system_program import ID as SYSTEM_PROGRAM_ID
from solana.rpc.api import Client
from solana.rpc.commitment import Confirmed
from solana.transaction import Transaction
from solders.instruction import Instruction, AccountMeta

from config import (
    RPC_URL,
    KEYPAIR_PATH,
    PYTH_HERMES_URL,
    FEED_REGISTRY,
    MSOL_MINT,
    read_crank_keypair,
)
from pda import PROGRAM_PUBKEY, derive_factory_pda, derive_market_pda

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s ▸ %(levelname)-5s ▸ %(name)s ▸ %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger('market_creator')

rpcClient = Client(RPC_URL)


@dataclass
class MarketSuggestion:
    title: str
    description: str
    category: str  # 'network' | 'mev' | 'defi' | 'validators'
    durationDays: int
    resolutionManual: bool  # True = manual resolve, False = oracle


# ═══════════════════════════════════════════════════════════════════════
# DAILY signals — refreshed every day at 00:00 UTC
# ═══════════════════════════════════════════════════════════════════════
DAILY_TEMPLATES = [
    MarketSuggestion(
        title='Solana processes 50M+ transactions today',
        description='Will the Solana network exceed 50 million total transactions in the next 24 hours? Resolved via Solana Explorer data.',
        category='network',
        durationDays=1,
        resolutionManual=True,
    ),
    MarketSuggestion(
        title='Jito tips exceed 500 SOL in the next 24h',
        description='Will total Jito MEV tips surpass 500 SOL across all bundles within the next day? Source: jito.wtf dashboard.',
        category='mev',
        durationDays=1,
        resolutionManual=True,
    ),
    MarketSuggestion(
        title='Average Solana block time stays under 450ms today',
        description='Will the average block time remain below 450ms for the entire day? Congestion spikes push it higher. Resolved via Solana Explorer.',
        category='network',
        durationDays=1,
        resolutionManual=True,
    ),
    MarketSuggestion(
        title='More than 200 new SPL tokens minted today',
        description='Will more than 200 new SPL token mints be created on Solana today? Pump.fun alone can drive hundreds. Source: Solscan token tracker.',
        category='defi',
        durationDays=1,
        resolutionManual=True,
    ),
]

# ═══════════════════════════════════════════════════════════════════════
# WEEKLY signals — refreshed on Monday and Sunday
# ═══════════════════════════════════════════════════════════════════════
WEEKLY_TEMPLATES = [
    MarketSuggestion(
        title='A single Jito bundle tip exceeds 100 SOL this week',
        description='Will any single Jito bundle include a tip of 100+ SOL this week? Whales competing for priority. Resolved via Jito block explorer.',
        category='mev',
        durationDays=7,
        resolutionManual=True,
    ),
    MarketSuggestion(
        title='Solana TPS peaks above 5,000 this week',
        description='Will Solana real (non-vote) TPS hit 5,000+ at any point this week? Resolved via Solana Explorer or Triton dashboard.',
        category='network',
        durationDays=7,
        resolutionManual=True,
    ),
    MarketSuggestion(
        title='New Solana token reaches $50M market cap this week',
        description='Will any newly launched Solana token hit $50M+ market cap within 7 days of its creation? Tracked via Birdeye/DexScreener.',
        category='defi',
        durationDays=7,
        resolutionManual=True,
    ),
]

# ═══════════════════════════════════════════════════════════════════════
# MONTHLY signals — refreshed on 1st and last day of the month
# ═══════════════════════════════════════════════════════════════════════
MONTHLY_TEMPLATES = [
    MarketSuggestion(
        title='Solana experiences a network outage this month',
        description='Will the Solana mainnet-beta suffer a full or partial outage (block production halt > 30 min) this month? Resolved via Solana Status page.',
        category='network',
        durationDays=30,
        resolutionManual=True,
    ),
    MarketSuggestion(
        title='Total SOL staked exceeds 400M this month',
        description='Will the total staked SOL cross the 400 million mark by month end? Currently hovering near 380M. Source: Solana Beach validators page.',
        category='validators',
        durationDays=30,
        resolutionManual=True,
    ),
    MarketSuggestion(
        title='A single priority fee exceeds 1,000 SOL this month',
        description='Will anyone pay a priority fee (bribe) above 1,000 SOL for a single transaction this month? Extreme MEV events happen during hot mints and liquidations.',
        category='mev',
        durationDays=30,
        resolutionManual=True,
    ),
    MarketSuggestion(
        title='Solana DeFi TVL crosses $8B this month',
        description='Will total value locked across Solana DeFi protocols exceed $8 billion this month? Tracked via DefiLlama. Currently around $7.2B.',
        category='defi',
        durationDays=30,
        resolutionManual=True,
    ),
    MarketSuggestion(
        title='A new Solana validator enters the top 20 by stake',
        description='Will a validator not currently in the top 20 break into it by month end? Delegation shifts and new entrants shake the ranking. Source: Solana Beach.',
        category='validators',
        durationDays=30,
        resolutionManual=True,
    ),
    MarketSuggestion(
        title='Solana processes 1.5B total transactions this month',
        description='Will the Solana network hit 1.5 billion transactions within the calendar month? Daily averages need to stay above 50M. Source: Solana Explorer.',
        category='network',
        durationDays=30,
        resolutionManual=True,
    ),
]

MARKET_TEMPLATES = DAILY_TEMPLATES + WEEKLY_TEMPLATES + MONTHLY_TEMPLATES


# ═══════════════════════════════════════════════════════════════════════
# Schedule logic
# ═══════════════════════════════════════════════════════════════════════
def get_scheduled_tiers() -> list[str]:
    """Return which tiers should be created right now based on date.

    Schedule:
      - daily:   every day at 00:00 UTC
      - weekly:  Monday (weekday=0) and Sunday (weekday=6)
      - monthly: 1st day and last day of the month
    """
    now = datetime.now(timezone.utc)
    tiers = ['daily']  # always create daily signals

    weekday = now.weekday()
    if weekday in (0, 6):  # Monday or Sunday
        tiers.append('weekly')

    day = now.day
    lastDay = calendar.monthrange(now.year, now.month)[1]
    if day == 1 or day == lastDay:
        tiers.append('monthly')

    return tiers


def templates_for_tier(tier: str) -> list[MarketSuggestion]:
    if tier == 'daily':
        return DAILY_TEMPLATES
    if tier == 'weekly':
        return WEEKLY_TEMPLATES
    if tier == 'monthly':
        return MONTHLY_TEMPLATES
    return []


def resolve_at_for_tier(tier: str) -> int:
    """Calculate UTC-aligned resolve timestamp for a tier.

    - daily:   next midnight UTC (00:00 tomorrow)
    - weekly:  next Sunday midnight UTC
    - monthly: first day of next month, midnight UTC
    """
    now = datetime.now(timezone.utc)

    if tier == 'daily':
        tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0) + __import__('datetime').timedelta(days=1)
        return int(tomorrow.timestamp())

    if tier == 'weekly':
        daysUntilSunday = (6 - now.weekday()) % 7 or 7
        nextSunday = now.replace(hour=0, minute=0, second=0, microsecond=0) + __import__('datetime').timedelta(days=daysUntilSunday)
        return int(nextSunday.timestamp())

    if tier == 'monthly':
        if now.month == 12:
            firstNextMonth = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            firstNextMonth = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
        return int(firstNextMonth.timestamp())

    return int(time.time()) + 86400


def tier_for_template(template: MarketSuggestion) -> str:
    if template.durationDays <= 2:
        return 'daily'
    if template.durationDays <= 14:
        return 'weekly'
    return 'monthly'


def generate_suggestions(tiers: list[str] | None = None) -> list[dict]:
    """Generate market suggestions from Solana ecosystem templates.

    Resolve times are UTC-aligned:
    - daily → next midnight UTC
    - weekly → next Sunday midnight UTC
    - monthly → first of next month midnight UTC

    Args:
        tiers: filter to specific tiers ('daily', 'weekly', 'monthly').
               None = all templates.
    """
    if tiers is None:
        templates = MARKET_TEMPLATES
    else:
        templates = []
        for t in tiers:
            templates.extend(templates_for_tier(t))

    # Pre-compute resolve times for each tier
    resolveCache = {}
    for tier in ('daily', 'weekly', 'monthly'):
        resolveCache[tier] = resolve_at_for_tier(tier)

    suggestions = []
    for template in templates:
        tier = tier_for_template(template)
        resolveAt = resolveCache[tier]

        suggestions.append({
            'title': template.title,
            'description': template.description,
            'resolveAt': resolveAt,
            'category': template.category,
            'durationDays': template.durationDays,
            'resolutionManual': template.resolutionManual,
        })

    return suggestions


def fetch_factory_total_markets() -> int:
    """Read total_markets from the factory account."""
    factoryPda = derive_factory_pda()
    try:
        resp = rpcClient.get_account_info(factoryPda, Confirmed)
        if resp.value is None:
            return 0
        data = bytes(resp.value.data)
        # After discriminator(8): authority(32), total_markets(u64)
        totalMarkets = struct.unpack_from('<Q', data, 8 + 32)[0]
        return totalMarkets
    except Exception as exc:
        log.error(f'failed to read factory: {exc}')
        return 0


def build_create_market_ix(
    factoryPda: Pubkey,
    marketPda: Pubkey,
    lstMint: Pubkey,
    creatorPubkey: Pubkey,
    title: str,
    description: str,
    resolveAt: int,
    resolutionSource: int,
    pythFeedId: bytes | None,
    targetPrice: int | None,
    targetCondition: int | None,
) -> Instruction:
    """Build the create_market instruction."""
    discriminator = hashlib.sha256(b'global:create_market').digest()[:8]

    # Serialize instruction data
    ixData = bytearray(discriminator)

    # title: String (4-byte len prefix + utf8)
    titleBytes = title.encode('utf-8')
    ixData += struct.pack('<I', len(titleBytes))
    ixData += titleBytes

    # description: String
    descBytes = description.encode('utf-8')
    ixData += struct.pack('<I', len(descBytes))
    ixData += descBytes

    # resolve_at: i64
    ixData += struct.pack('<q', resolveAt)

    # resolution_source: enum (u8)
    ixData += struct.pack('B', resolutionSource)

    # pyth_feed_id: Option<[u8; 32]>
    if pythFeedId is not None:
        ixData += b'\x01'
        ixData += pythFeedId[:32]
    else:
        ixData += b'\x00'

    # target_price: Option<u64>
    if targetPrice is not None:
        ixData += b'\x01'
        ixData += struct.pack('<Q', targetPrice)
    else:
        ixData += b'\x00'

    # target_condition: Option<enum u8>
    if targetCondition is not None:
        ixData += b'\x01'
        ixData += struct.pack('B', targetCondition)
    else:
        ixData += b'\x00'

    accounts = [
        AccountMeta(pubkey=factoryPda, is_signer=False, is_writable=True),
        AccountMeta(pubkey=marketPda, is_signer=False, is_writable=True),
        AccountMeta(pubkey=lstMint, is_signer=False, is_writable=False),
        AccountMeta(pubkey=creatorPubkey, is_signer=True, is_writable=True),
        AccountMeta(pubkey=SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
    ]

    return Instruction(
        program_id=PROGRAM_PUBKEY,
        accounts=accounts,
        data=bytes(ixData),
    )


def create_market_on_chain(suggestion: dict) -> str | None:
    """Create a market on-chain from a suggestion."""
    crankKeypair = read_crank_keypair(KEYPAIR_PATH)
    factoryPda = derive_factory_pda()
    nextMarketId = fetch_factory_total_markets()
    marketPda = derive_market_pda(nextMarketId)
    lstMint = Pubkey.from_string(MSOL_MINT)

    # Manual resolution = 1, PythOracle = 0
    resolutionSource = 1 if suggestion.get('resolutionManual', True) else 0

    ix = build_create_market_ix(
        factoryPda=factoryPda,
        marketPda=marketPda,
        lstMint=lstMint,
        creatorPubkey=crankKeypair.pubkey(),
        title=suggestion['title'],
        description=suggestion['description'],
        resolveAt=suggestion['resolveAt'],
        resolutionSource=resolutionSource,
        pythFeedId=None,
        targetPrice=None,
        targetCondition=None,
    )

    try:
        recentBlockhash = rpcClient.get_latest_blockhash(Confirmed).value.blockhash
        txn = Transaction.new_signed_with_payer(
            [ix],
            payer=crankKeypair.pubkey(),
            signing_keypairs=[crankKeypair],
            recent_blockhash=recentBlockhash,
        )
        txResult = rpcClient.send_transaction(txn)
        return str(txResult.value)
    except Exception as exc:
        log.error(f'failed to create market: {exc}')
        return None


def print_suggestions(suggestions: list[dict]):
    """Print market suggestions in a formatted table."""
    print('\n' + '=' * 72)
    print('  STAKESIGNAL — Solana Ecosystem Signals')
    print('=' * 72)

    for idx, sg in enumerate(suggestions, 1):
        resolve = 'manual' if sg.get('resolutionManual', True) else 'oracle'
        print(f'\n  [{idx}] {sg["title"]}')
        print(f'      Category: {sg["category"]}  |  Duration: {sg["durationDays"]}d  |  Resolution: {resolve}')
        print(f'      {sg["description"]}')

    print('\n' + '=' * 72)
    print(f'  {len(suggestions)} signal(s) generated')
    print('=' * 72 + '\n')


def main():
    parser = argparse.ArgumentParser(
        description='StakeSignal — Solana Ecosystem Market Creator',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python market_creator.py                          # show all templates
  python market_creator.py --create                 # create ALL on-chain
  python market_creator.py --create --tier daily    # only daily signals
  python market_creator.py --create --tier monthly  # only monthly signals
  python market_creator.py --schedule               # auto-detect by date
  python market_creator.py --create --pick 3        # only template #3
        """,
    )
    parser.add_argument(
        '--create', action='store_true',
        help='Create markets on-chain (default: dry-run / preview only)',
    )
    parser.add_argument(
        '--tier', choices=['daily', 'weekly', 'monthly'], default=None,
        help='Filter to a specific tier of signals',
    )
    parser.add_argument(
        '--schedule', action='store_true',
        help='Auto-detect which tiers to create based on today\'s date',
    )
    parser.add_argument(
        '--pick', type=int, default=None,
        help='Create only suggestion N (1-indexed)',
    )
    args = parser.parse_args()

    # Determine which tiers to generate
    if args.schedule:
        tiers = get_scheduled_tiers()
        now = datetime.now(timezone.utc)
        log.info(f'schedule mode — {now.strftime("%A %Y-%m-%d")} — tiers: {", ".join(tiers)}')
    elif args.tier:
        tiers = [args.tier]
    else:
        tiers = None  # all

    suggestions = generate_suggestions(tiers)
    if not suggestions:
        log.warning('no suggestions to create for this schedule')
        return

    print_suggestions(suggestions)

    if args.create or args.schedule:
        targets = suggestions
        if args.pick is not None:
            if 1 <= args.pick <= len(suggestions):
                targets = [suggestions[args.pick - 1]]
            else:
                log.error(f'--pick must be between 1 and {len(suggestions)}')
                return

        log.info(f'creating {len(targets)} market(s) on-chain...')
        created = 0
        for sg in targets:
            log.info(f'  → {sg["title"]}')
            txSig = create_market_on_chain(sg)
            if txSig:
                log.info(f'    ✓ tx={txSig}')
                created += 1
            else:
                log.error(f'    ✗ failed')

        log.info(f'done — {created}/{len(targets)} markets created')


if __name__ == '__main__':
    main()
