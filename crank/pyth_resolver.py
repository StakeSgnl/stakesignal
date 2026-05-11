"""
Pyth Resolution Crank — StakeSignal

Monitors open prediction markets with PythOracle resolution source.
When resolve_at timestamp passes, reads Pyth Hermes price feed
and calls resolve_market_pyth on-chain.

Run: python pyth_resolver.py
"""

import struct
import time
import hashlib
import logging
from datetime import datetime

import httpx
from solders.pubkey import Pubkey
from solders.keypair import Keypair
from solders.system_program import ID as SYSTEM_PROGRAM_ID
from solana.rpc.api import Client
from solana.rpc.commitment import Confirmed
from solana.transaction import Transaction
from solders.instruction import Instruction, AccountMeta
from apscheduler.schedulers.blocking import BlockingScheduler

from config import (
    RPC_URL,
    PROGRAM_ID,
    KEYPAIR_PATH,
    RESOLVE_INTERVAL_MINUTES,
    PYTH_HERMES_URL,
    MARKET_SEED,
    PYTH_PRICE_STALENESS_SECONDS,
    MAX_TITLE_LEN,
    MAX_DESCRIPTION_LEN,
    read_crank_keypair,
)
from pda import PROGRAM_PUBKEY, derive_market_pda

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s ▸ %(levelname)-5s ▸ %(name)s ▸ %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger('pyth_resolver')

rpcClient = Client(RPC_URL)


def get_crank_keypair() -> Keypair:
    return read_crank_keypair(KEYPAIR_PATH)


def fetch_all_open_markets() -> list[dict]:
    """Fetch all PredictionMarket accounts from the program."""
    try:
        response = rpcClient.get_program_accounts(
            PROGRAM_PUBKEY,
            commitment=Confirmed,
            encoding='base64',
        )
        if response.value is None:
            return []

        markets = []
        for accountInfo in response.value:
            data = bytes(accountInfo.account.data)
            parsed = parse_market_account(data)
            if parsed is not None:
                parsed['pubkey'] = accountInfo.pubkey
                markets.append(parsed)
        return markets

    except Exception as exc:
        log.error(f'failed to fetch program accounts: {exc}')
        return []


def parse_market_account(data: bytes) -> dict | None:
    """Parse raw PredictionMarket account data.

    Layout (after 8-byte discriminator):
      market_id: u64 (8)
      title: String (4 + len)
      description: String (4 + len)
      creator: Pubkey (32)
      lst_mint: Pubkey (32)
      yes_pool: u64 (8)
      no_pool: u64 (8)
      total_bettors: u32 (4)
      created_at: i64 (8)
      resolve_at: i64 (8)
      status: enum u8 (1) — 0=Open, 1=Resolved, 2=Cancelled
      result: Option<bool> (1 tag + 1 value)
      resolution_source: enum u8 (1) — 0=PythOracle, 1=Manual
      pyth_feed_id: Option<[u8;32]> (1 tag + 32)
      target_price: Option<u64> (1 tag + 8)
      target_condition: Option<enum u8> (1 tag + 1)
      bump: u8 (1)
    """
    # Min size: 8 (disc) + 8 + 4 + 0 + 4 + 0 + 32 + 32 + 8 + 8 + 4 + 8 + 8 + 1 + 2 + 1 + 33 + 9 + 2 + 1 = ~165
    if len(data) < 100:
        return None

    # Verify discriminator — PredictionMarket
    expectedDisc = hashlib.sha256(b'account:PredictionMarket').digest()[:8]
    if data[:8] != expectedDisc:
        return None

    try:
        offset = 8
        marketId = struct.unpack_from('<Q', data, offset)[0]
        offset += 8

        titleLen = struct.unpack_from('<I', data, offset)[0]
        offset += 4
        if titleLen > MAX_TITLE_LEN:
            return None
        title = data[offset:offset + titleLen].decode('utf-8', errors='replace')
        offset += titleLen

        descLen = struct.unpack_from('<I', data, offset)[0]
        offset += 4
        if descLen > MAX_DESCRIPTION_LEN:
            return None
        description = data[offset:offset + descLen].decode('utf-8', errors='replace')
        offset += descLen

        creator = Pubkey.from_bytes(data[offset:offset + 32])
        offset += 32

        lstMint = Pubkey.from_bytes(data[offset:offset + 32])
        offset += 32

        yesPool = struct.unpack_from('<Q', data, offset)[0]
        offset += 8
        noPool = struct.unpack_from('<Q', data, offset)[0]
        offset += 8

        totalBettors = struct.unpack_from('<I', data, offset)[0]
        offset += 4

        createdAt = struct.unpack_from('<q', data, offset)[0]
        offset += 8
        resolveAt = struct.unpack_from('<q', data, offset)[0]
        offset += 8

        status = data[offset]
        offset += 1

        resultTag = data[offset]
        offset += 1
        resultVal = None
        if resultTag == 1:
            resultVal = bool(data[offset])
        offset += 1

        resolutionSource = data[offset]
        offset += 1

        pythFeedTag = data[offset]
        offset += 1
        pythFeedId = None
        if pythFeedTag == 1:
            pythFeedId = data[offset:offset + 32]
        offset += 32

        targetPriceTag = data[offset]
        offset += 1
        targetPrice = None
        if targetPriceTag == 1:
            targetPrice = struct.unpack_from('<Q', data, offset)[0]
        offset += 8

        targetCondTag = data[offset]
        offset += 1
        targetCondition = None
        if targetCondTag == 1:
            targetCondition = data[offset]
        offset += 1

        bump = data[offset]

        return {
            'marketId': marketId,
            'title': title,
            'description': description,
            'creator': creator,
            'lstMint': lstMint,
            'yesPool': yesPool,
            'noPool': noPool,
            'totalBettors': totalBettors,
            'createdAt': createdAt,
            'resolveAt': resolveAt,
            'status': status,
            'result': resultVal,
            'resolutionSource': resolutionSource,
            'pythFeedId': pythFeedId,
            'targetPrice': targetPrice,
            'targetCondition': targetCondition,
            'bump': bump,
        }

    except (struct.error, IndexError):
        return None


def fetch_pyth_price(feedId: bytes) -> dict | None:
    """Fetch latest price from Pyth Hermes REST API."""
    hexId = '0x' + feedId.hex()
    url = f'{PYTH_HERMES_URL}/v2/updates/price/latest'
    try:
        resp = httpx.get(url, params={'ids[]': hexId}, timeout=15)
        resp.raise_for_status()
        payload = resp.json()

        parsedPrices = payload.get('parsed', [])
        if not parsedPrices:
            log.warning(f'no price data for feed {hexId}')
            return None

        priceData = parsedPrices[0].get('price') or {}

        # Hermes V2 shape: parsed[0].price = { price, conf, expo, publish_time }
        # publish_time may also live under metadata for older payloads — fall back.
        rawPublishTime = priceData.get('publish_time')
        if rawPublishTime is None:
            metadata = parsedPrices[0].get('metadata') or {}
            rawPublishTime = metadata.get('publish_time') or 0
        try:
            publishTime = int(rawPublishTime)
        except (TypeError, ValueError):
            publishTime = 0

        if publishTime <= 0:
            log.warning(
                f'missing/invalid publish_time for feed {hexId}; '
                f'refusing to use price for resolution'
            )
            return None

        price = int(priceData['price'])
        expo = int(priceData['expo'])
        confidence = int(priceData['conf'])

        # Sanity: expo should be negative (typically -8), price positive
        if expo > 0 or expo < -18:
            log.warning(f'suspicious expo={expo} for feed {hexId}')
            return None
        if price <= 0:
            log.warning(f'non-positive price={price} for feed {hexId}')
            return None

        normalizedPrice = price * (10 ** expo)

        return {
            'price': price,
            'expo': expo,
            'confidence': confidence,
            'normalizedPrice': normalizedPrice,
            'publishTime': publishTime,
        }

    except Exception as exc:
        log.error(f'failed to fetch pyth price for {hexId}: {exc}')
        return None


def is_price_fresh(publishTime: int) -> bool:
    """Check if a Pyth price is fresh enough to use for resolution."""
    if publishTime <= 0:
        return False
    now = int(time.time())
    age = now - publishTime
    return age <= PYTH_PRICE_STALENESS_SECONDS


def build_resolve_market_pyth_ix(
    marketPda: Pubkey,
    pythPriceFeed: Pubkey,
    crankPubkey: Pubkey,
) -> Instruction:
    """Build the resolve_market_pyth instruction.

    Anchor discriminator = sha256("global:resolve_market_pyth")[:8]
    """
    discriminator = hashlib.sha256(b'global:resolve_market_pyth').digest()[:8]

    accounts = [
        AccountMeta(pubkey=marketPda, is_signer=False, is_writable=True),
        AccountMeta(pubkey=pythPriceFeed, is_signer=False, is_writable=False),
        AccountMeta(pubkey=crankPubkey, is_signer=True, is_writable=False),
    ]

    return Instruction(
        program_id=PROGRAM_PUBKEY,
        accounts=accounts,
        data=discriminator,
    )


def evaluate_market_result(market: dict, priceInfo: dict) -> bool | None:
    """Determine if market resolves as Yes (True) or No (False).

    targetCondition: 0 = Above, 1 = Below
    targetPrice is stored on-chain as u64 with 6 decimal precision.
    """
    targetPrice = market['targetPrice']
    targetCondition = market['targetCondition']

    if targetPrice is None or targetCondition is None:
        log.warning(f'market {market["marketId"]} missing target config')
        return None

    currentPrice = priceInfo['normalizedPrice']
    targetPriceNormalized = targetPrice / 1_000_000

    if targetCondition == 0:  # Above
        return currentPrice > targetPriceNormalized
    else:  # Below
        return currentPrice < targetPriceNormalized


# Known Pyth price account addresses on devnet for common feeds
# In production, derive these from the Pyth program
PYTH_DEVNET_PRICE_ACCOUNTS = {
    'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d':
        'J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix',  # SOL/USD devnet
    'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace':
        'JBu1AL4obBcCMqKBBxhpWCNUt136ijcuMZLFvTP7iWdB',  # ETH/USD devnet
    'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43':
        'GVXRSBjFk6e6J3NbVPXh1QPaHUq4iFCJxEm7ci2Rtrm',   # BTC/USD devnet
}


def resolve_pyth_price_account(feedId: bytes) -> Pubkey | None:
    """Look up the on-chain Pyth price account for a given feed ID."""
    feedHex = feedId.hex()
    accountStr = PYTH_DEVNET_PRICE_ACCOUNTS.get(feedHex)
    if accountStr is not None:
        return Pubkey.from_string(accountStr)
    # Fallback: log warning, cannot resolve
    log.warning(f'no known price account for feed {feedHex}')
    return None


def check_and_resolve():
    """Check for markets ready to resolve, call resolve_market_pyth."""
    log.info('checking for resolvable markets...')

    markets = fetch_all_open_markets()
    now = int(time.time())

    resolvable = [
        m for m in markets
        if m['status'] == 0  # Open
        and m['resolutionSource'] == 0  # PythOracle
        and m['resolveAt'] <= now
        and m['pythFeedId'] is not None
    ]

    if not resolvable:
        log.info('no markets ready for resolution')
        return

    log.info(f'found {len(resolvable)} market(s) to resolve')
    crankKeypair = get_crank_keypair()

    for market in resolvable:
        try:
            priceInfo = fetch_pyth_price(market['pythFeedId'])
            if priceInfo is None:
                log.warning(f'skipping market {market["marketId"]}: no price data')
                continue

            if not is_price_fresh(priceInfo['publishTime']):
                log.warning(
                    f'skipping market {market["marketId"]}: '
                    f'price stale (publish_time={priceInfo["publishTime"]})'
                )
                continue

            result = evaluate_market_result(market, priceInfo)
            if result is None:
                continue

            resultStr = 'YES' if result else 'NO'
            log.info(
                f'resolving market {market["marketId"]} "{market["title"]}" '
                f'→ {resultStr} (price={priceInfo["normalizedPrice"]:.4f})'
            )

            marketPda = derive_market_pda(market['marketId'])

            pythPriceFeedPubkey = resolve_pyth_price_account(market['pythFeedId'])
            if pythPriceFeedPubkey is None:
                log.warning(f'skipping market {market["marketId"]}: unknown pyth price account')
                continue

            ix = build_resolve_market_pyth_ix(
                marketPda=marketPda,
                pythPriceFeed=pythPriceFeedPubkey,
                crankPubkey=crankKeypair.pubkey(),
            )

            recentBlockhash = rpcClient.get_latest_blockhash(Confirmed).value.blockhash
            txn = Transaction.new_signed_with_payer(
                [ix],
                payer=crankKeypair.pubkey(),
                signing_keypairs=[crankKeypair],
                recent_blockhash=recentBlockhash,
            )

            txResult = rpcClient.send_transaction(txn)
            log.info(f'market {market["marketId"]} resolved: tx={txResult.value}')

        except Exception as exc:
            log.error(f'failed to resolve market {market["marketId"]}: {exc}')
            continue


def run_scheduler():
    """Run the resolution crank on a schedule."""
    scheduler = BlockingScheduler()
    scheduler.add_job(
        check_and_resolve,
        'interval',
        minutes=RESOLVE_INTERVAL_MINUTES,
        next_run_time=datetime.now(),
    )
    log.info(f'crank started — checking every {RESOLVE_INTERVAL_MINUTES} min')
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        log.info('crank stopped')


if __name__ == '__main__':
    run_scheduler()
