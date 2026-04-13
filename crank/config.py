"""Configuration for StakeSignal crank services."""
import os
import json
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv optional in production


@dataclass(frozen=True)
class _Cfg:
    rpc_url: str = os.getenv('ANCHOR_PROVIDER_URL', 'https://api.devnet.solana.com')
    program_id: str = os.getenv('PROGRAM_ID', '2WNxCQG7khECic8tNgWwPgEtEkVKrXhn9b5pSdKfR35b')
    keypair_path: str = os.getenv('CRANK_KEYPAIR_PATH', './crank-keypair.json')
    resolve_interval: int = int(os.getenv('RESOLVE_CHECK_INTERVAL_MINUTES', '10'))
    pyth_hermes_url: str = os.getenv('PYTH_HERMES_URL', 'https://hermes.pyth.network')
    helius_api_key: str = os.getenv('HELIUS_API_KEY', '')
    msol_mint: str = os.getenv('MSOL_MINT', 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So')
    jitosol_mint: str = os.getenv('JITOSOL_MINT', 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn')


_c = _Cfg()

# Public API — same names used by crank modules
RPC_URL = _c.rpc_url
PROGRAM_ID = _c.program_id
KEYPAIR_PATH = _c.keypair_path
RESOLVE_INTERVAL_MINUTES = _c.resolve_interval
PYTH_HERMES_URL = _c.pyth_hermes_url
HELIUS_API_KEY = _c.helius_api_key
MSOL_MINT = _c.msol_mint
JITOSOL_MINT = _c.jitosol_mint

# Pyth price feed IDs
SOL_USD_FEED_ID = '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'
ETH_USD_FEED_ID = '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'
BTC_USD_FEED_ID = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'

# PDA seeds
FACTORY_SEED = b'signal_factory'
MARKET_SEED = b'signal_market'
POSITION_SEED = b'position'
STATS_SEED = b'signal_stats'

# Staleness / limits
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
