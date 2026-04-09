use anchor_lang::prelude::*;
use crate::constants::MAX_LST_MINTS;

#[account]
#[derive(InitSpace)]
pub struct MarketFactory {
    pub authority: Pubkey,
    pub total_markets: u64,
    pub resolution_fee_bps: u16,
    pub early_exit_fee_bps: u16,
    pub treasury: Pubkey,
    #[max_len(MAX_LST_MINTS)]
    pub accepted_lst_mints: Vec<Pubkey>,
    pub bump: u8,
}
