"""
Pyth Resolution Crank

Monitors open markets with PythOracle resolution source.
When resolve_at timestamp passes, reads Pyth price feed
and calls resolve_market_pyth on-chain.

Run: python pyth_resolver.py
"""

from config import RPC_URL, RESOLVE_INTERVAL_MINUTES


def check_and_resolve():
    """Check for markets ready to resolve, call resolve_market_pyth."""
    # TODO: fetch open markets, check resolve_at, read pyth, send tx
    print(f'[resolver] checking markets on {RPC_URL}')


if __name__ == '__main__':
    print(f'[resolver] starting with {RESOLVE_INTERVAL_MINUTES}min interval')
    check_and_resolve()
