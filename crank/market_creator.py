"""
Market Suggestions Generator — StakeSignal

Generates prediction market ideas based on current crypto prices
and ecosystem data. Authority can create markets via CLI.

Run: python market_creator.py [--create]
"""

import argparse
import struct
import time
import hashlib
import logging
from dataclasses import dataclass

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
    load_keypair_bytes,
)
from pda import PROGRAM_PUBKEY, derive_factory_pda, derive_market_pda

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger('market_creator')

rpcClient = Client(RPC_URL)


@dataclass
class MarketSuggestion:
    title: str
    description: str
    feedPair: str
    targetMultiplier: float
    condition: str  # 'above' or 'below'
    durationDays: int


MARKET_TEMPLATES = [
    MarketSuggestion(
        title='SOL above ${target} in 7 days',
        description='Will SOL/USD price be above ${target} when this market resolves? Backed by Pyth oracle data.',
        feedPair='SOL/USD',
        targetMultiplier=1.10,
        condition='above',
        durationDays=7,
    ),
    MarketSuggestion(
        title='SOL below ${target} in 3 days',
        description='Short-term bearish signal: will SOL drop below ${target} within 3 days?',
        feedPair='SOL/USD',
        targetMultiplier=0.95,
        condition='below',
        durationDays=3,
    ),
    MarketSuggestion(
        title='ETH above ${target} in 7 days',
        description='Ethereum price prediction: will ETH/USD be above ${target} when resolved?',
        feedPair='ETH/USD',
        targetMultiplier=1.08,
        condition='above',
        durationDays=7,
    ),
    MarketSuggestion(
        title='BTC above ${target} in 14 days',
        description='Two-week BTC prediction: price above ${target} at resolution time.',
        feedPair='BTC/USD',
        targetMultiplier=1.05,
        condition='above',
        durationDays=14,
    ),
    MarketSuggestion(
        title='SOL above ${target} in 30 days',
        description='Monthly outlook: will SOL reach ${target} within a month? Stake your LST on it.',
        feedPair='SOL/USD',
        targetMultiplier=1.25,
        condition='above',
        durationDays=30,
    ),
    MarketSuggestion(
        title='ETH below ${target} in 7 days',
        description='Bearish ETH signal: expecting a drop below ${target} this week?',
        feedPair='ETH/USD',
        targetMultiplier=0.92,
        condition='below',
        durationDays=7,
    ),
]


def fetch_current_price(feedPair: str) -> float | None:
    """Fetch current price from Pyth Hermes."""
    feedIdHex = FEED_REGISTRY.get(feedPair)
    if feedIdHex is None:
        log.warning(f'no feed ID for {feedPair}')
        return None

    url = f'{PYTH_HERMES_URL}/v2/updates/price/latest'
    try:
        resp = httpx.get(url, params={'ids[]': feedIdHex}, timeout=15)
        resp.raise_for_status()
        payload = resp.json()

        parsedPrices = payload.get('parsed', [])
        if not parsedPrices:
            return None

        priceData = parsedPrices[0]['price']
        price = int(priceData['price'])
        expo = int(priceData['expo'])
        return price * (10 ** expo)

    except Exception as exc:
        log.error(f'failed to fetch {feedPair} price: {exc}')
        return None


def generate_suggestions() -> list[dict]:
    """Generate market suggestions based on current prices."""
    priceCache = {}
    suggestions = []

    for template in MARKET_TEMPLATES:
        if template.feedPair not in priceCache:
            priceCache[template.feedPair] = fetch_current_price(template.feedPair)

        currentPrice = priceCache[template.feedPair]
        if currentPrice is None:
            continue

        targetPrice = round(currentPrice * template.targetMultiplier, 2)
        resolveAt = int(time.time()) + (template.durationDays * 86400)

        title = template.title.replace('${target}', f'{targetPrice:,.0f}')
        description = template.description.replace('${target}', f'{targetPrice:,.0f}')

        # target_price on-chain stored as u64 with 6 decimal precision
        targetPriceOnChain = int(targetPrice * 1_000_000)

        feedIdHex = FEED_REGISTRY[template.feedPair]
        feedIdBytes = bytes.fromhex(feedIdHex.replace('0x', ''))

        conditionValue = 0 if template.condition == 'above' else 1

        suggestions.append({
            'title': title,
            'description': description,
            'resolveAt': resolveAt,
            'targetPrice': targetPriceOnChain,
            'targetCondition': conditionValue,
            'pythFeedId': feedIdBytes,
            'currentPrice': currentPrice,
            'durationDays': template.durationDays,
            'feedPair': template.feedPair,
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
    crankKeypair = Keypair.from_bytes(load_keypair_bytes(KEYPAIR_PATH))
    factoryPda = derive_factory_pda()
    nextMarketId = fetch_factory_total_markets()
    marketPda = derive_market_pda(nextMarketId)
    lstMint = Pubkey.from_string(MSOL_MINT)

    ix = build_create_market_ix(
        factoryPda=factoryPda,
        marketPda=marketPda,
        lstMint=lstMint,
        creatorPubkey=crankKeypair.pubkey(),
        title=suggestion['title'],
        description=suggestion['description'],
        resolveAt=suggestion['resolveAt'],
        resolutionSource=0,  # PythOracle
        pythFeedId=suggestion['pythFeedId'],
        targetPrice=suggestion['targetPrice'],
        targetCondition=suggestion['targetCondition'],
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
    print('  STAKESIGNAL — Market Suggestions')
    print('=' * 72)

    for idx, sg in enumerate(suggestions, 1):
        condStr = 'ABOVE' if sg['targetCondition'] == 0 else 'BELOW'
        print(f'\n  [{idx}] {sg["title"]}')
        print(f'      Feed: {sg["feedPair"]}  |  Current: ${sg["currentPrice"]:,.2f}')
        print(f'      Target: ${sg["targetPrice"] / 1_000_000:,.2f} ({condStr})')
        print(f'      Duration: {sg["durationDays"]} days')
        print(f'      {sg["description"]}')

    print('\n' + '=' * 72)
    print(f'  {len(suggestions)} suggestion(s) generated')
    print('=' * 72 + '\n')


def main():
    parser = argparse.ArgumentParser(description='StakeSignal Market Suggestions')
    parser.add_argument(
        '--create', action='store_true',
        help='Create all suggested markets on-chain',
    )
    parser.add_argument(
        '--pick', type=int, default=None,
        help='Create only suggestion N (1-indexed)',
    )
    args = parser.parse_args()

    suggestions = generate_suggestions()
    if not suggestions:
        log.warning('no suggestions generated — check Pyth connectivity')
        return

    print_suggestions(suggestions)

    if args.create:
        targets = suggestions
        if args.pick is not None:
            if 1 <= args.pick <= len(suggestions):
                targets = [suggestions[args.pick - 1]]
            else:
                log.error(f'--pick must be between 1 and {len(suggestions)}')
                return

        for sg in targets:
            log.info(f'creating market: {sg["title"]}')
            txSig = create_market_on_chain(sg)
            if txSig:
                log.info(f'created! tx={txSig}')
            else:
                log.error(f'failed to create market: {sg["title"]}')


if __name__ == '__main__':
    main()
