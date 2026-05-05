"""One-shot verification: load keypair, fetch markets, dry-run resolver logic.

Confirms before Railway deploy:
  - Crank wallet loads correctly (env or file)
  - Wallet pubkey matches factory authority on devnet
  - get_program_accounts returns parseable PredictionMarket data
  - Pyth Hermes API reachable

Run: python verify_resolver.py
"""

import json
import logging
import time
import urllib.request

from solders.pubkey import Pubkey

import config
import pyth_resolver as r

logging.basicConfig(level=logging.INFO, format='%(asctime)s ▸ %(levelname)s ▸ %(message)s', datefmt='%H:%M:%S')
log = logging.getLogger('verify')


def main():
    kp = config.read_crank_keypair(config.KEYPAIR_PATH)
    log.info('crank wallet pubkey: %s', kp.pubkey())

    # Sanity: fetch factory authority on-chain, compare
    prog = Pubkey.from_string(config.PROGRAM_ID)
    factory_pda, _ = Pubkey.find_program_address([config.FACTORY_SEED], prog)
    log.info('factory PDA: %s', factory_pda)

    req = urllib.request.Request(
        config.RPC_URL,
        data=json.dumps({
            'jsonrpc': '2.0', 'id': 1, 'method': 'getAccountInfo',
            'params': [str(factory_pda), {'encoding': 'base64'}]
        }).encode(),
        headers={'Content-Type': 'application/json'},
    )
    resp = json.loads(urllib.request.urlopen(req, timeout=10).read())
    val = resp.get('result', {}).get('value')
    if val is None:
        log.error('factory PDA does not exist on devnet — initialize_factory first')
        return

    import base64
    data = base64.b64decode(val['data'][0])
    factory_authority = Pubkey.from_bytes(data[8:40])
    log.info('factory authority on-chain: %s', factory_authority)

    if str(kp.pubkey()) == str(factory_authority):
        log.info('✓ wallet matches factory authority — crank can sign')
    else:
        log.warning('✗ wallet pubkey ≠ factory authority — resolve_market_pyth will reject')

    # Fetch open markets
    log.info('fetching all program accounts...')
    markets = r.fetch_all_open_markets()
    log.info('found %d account(s) parsed as PredictionMarket', len(markets))

    open_markets = [m for m in markets if m['status'] == 0]
    log.info('  %d open', len(open_markets))

    pyth_markets = [m for m in open_markets if m['resolutionSource'] == 0 and m['pythFeedId']]
    log.info('  %d open with Pyth feed', len(pyth_markets))

    now = int(time.time())
    ready = [m for m in pyth_markets if m['resolveAt'] <= now]
    log.info('  %d ready for resolution (resolveAt <= now)', len(ready))

    # Sample Pyth API
    log.info('testing Pyth Hermes API (SOL/USD)...')
    sol_feed = bytes.fromhex(config.SOL_USD_FEED_ID[2:])  # strip 0x
    price_info = r.fetch_pyth_price(sol_feed)
    if price_info:
        log.info('  SOL/USD = $%.4f (publish_time=%d, %ds ago)',
                 price_info['normalizedPrice'], price_info['publishTime'],
                 now - price_info['publishTime'])
    else:
        log.error('  Pyth API call failed')

    log.info('verification complete')


if __name__ == '__main__':
    main()
