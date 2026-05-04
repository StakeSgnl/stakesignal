use anchor_lang::prelude::*;
use crate::constants::{MAX_TITLE_LEN, MAX_DESCRIPTION_LEN};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum MarketStatus {
    Open,
    Resolved,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ResolutionSource {
    PythOracle,
    Manual,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum TargetCondition {
    Above,
    Below,
}

#[account]
#[derive(InitSpace)]
pub struct PredictionMarket {
    pub market_id: u64,
    #[max_len(MAX_TITLE_LEN)]
    pub title: String,
    #[max_len(MAX_DESCRIPTION_LEN)]
    pub description: String,
    pub creator: Pubkey,
    pub lst_mint: Pubkey,
    pub yes_pool: u64,
    pub no_pool: u64,
    pub total_bettors: u32,
    pub created_at: i64,
    pub resolve_at: i64,
    pub status: MarketStatus,
    pub result: Option<bool>,
    pub resolution_source: ResolutionSource,
    pub pyth_feed_id: Option<[u8; 32]>,
    pub target_price: Option<u64>,
    pub target_condition: Option<TargetCondition>,
    pub bump: u8,
}
