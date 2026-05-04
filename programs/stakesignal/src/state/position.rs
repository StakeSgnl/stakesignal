use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Side {
    Yes,
    No,
}

#[account]
#[derive(InitSpace)]
pub struct UserPosition {
    pub user: Pubkey,
    pub market: Pubkey,
    pub side: Side,
    pub lst_amount: u64,
    pub yield_at_entry: u64,
    pub placed_at: i64,
    pub claimed: bool,
    pub bump: u8,
}
