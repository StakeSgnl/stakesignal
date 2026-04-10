"""Shared PDA derivation utilities for StakeSignal crank."""

import struct
from solders.pubkey import Pubkey
from config import PROGRAM_ID, FACTORY_SEED, MARKET_SEED

PROGRAM_PUBKEY = Pubkey.from_string(PROGRAM_ID)


def derive_factory_pda() -> Pubkey:
    pda, _bump = Pubkey.find_program_address([FACTORY_SEED], PROGRAM_PUBKEY)
    return pda


def derive_market_pda(marketId: int) -> Pubkey:
    pda, _bump = Pubkey.find_program_address(
        [MARKET_SEED, struct.pack('<Q', marketId)],
        PROGRAM_PUBKEY,
    )
    return pda
