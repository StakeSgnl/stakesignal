import os
from dotenv import load_dotenv

load_dotenv()

RPC_URL = os.getenv('ANCHOR_PROVIDER_URL', 'https://api.devnet.solana.com')
PROGRAM_ID = os.getenv('PROGRAM_ID', '')
KEYPAIR_PATH = os.getenv('CRANK_KEYPAIR_PATH', './crank-keypair.json')
RESOLVE_INTERVAL_MINUTES = int(os.getenv('RESOLVE_CHECK_INTERVAL_MINUTES', '10'))

PYTH_HERMES_URL = os.getenv('PYTH_HERMES_URL', 'https://hermes.pyth.network')

SOL_USD_FEED_ID = '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'
