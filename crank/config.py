import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

RPC_URL = os.getenv('ANCHOR_PROVIDER_URL', 'https://api.devnet.solana.com')
PROGRAM_ID = os.getenv('PROGRAM_ID', '2WNxCQG7khECic8tNgWwPgEtEkVKrXhn9b5pSdKfR35b')
KEYPAIR_PATH = os.getenv('CRANK_KEYPAIR_PATH', './crank-keypair.json')
RESOLVE_INTERVAL_MINUTES = int(os.getenv('RESOLVE_CHECK_INTERVAL_MINUTES', '10'))

PYTH_HERMES_URL = os.getenv('PYTH_HERMES_URL', 'https://hermes.pyth.network')
HELIUS_API_KEY = os.getenv('HELIUS_API_KEY', '')

SOL_USD_FEED_ID = '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'
ETH_USD_FEED_ID = '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'
BTC_USD_FEED_ID = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'

MSOL_MINT = os.getenv('MSOL_MINT', 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So')
JITOSOL_MINT = os.getenv('JITOSOL_MINT', 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn')

FACTORY_SEED = b'signal_factory'
MARKET_SEED = b'signal_market'
POSITION_SEED = b'position'
STATS_SEED = b'signal_stats'

PYTH_PRICE_STALENESS_SECONDS = 120

MAX_TITLE_LEN = 128
MAX_DESCRIPTION_LEN = 256

FEED_REGISTRY = {
    'SOL/USD': SOL_USD_FEED_ID,
    'ETH/USD': ETH_USD_FEED_ID,
    'BTC/USD': BTC_USD_FEED_ID,
}


def load_keypair_bytes(path: str) -> bytes:
    resolved = Path(path).expanduser()
    with open(resolved, 'r') as fh:
        data = json.load(fh)
    return bytes(data[:64])
