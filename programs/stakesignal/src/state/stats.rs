use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserStats {
    pub user: Pubkey,
    pub total_bets: u64,
    pub wins: u64,
    pub total_yield_earned: u64,
    pub volume: u64,
    pub bump: u8,
}
