use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::SignalError;
use crate::constants::*;

#[derive(Accounts)]
pub struct CancelMarket<'info> {
    #[account(
        mut,
        seeds = [MARKET_SEED, &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Open @ SignalError::MarketAlreadyResolved,
    )]
    pub market: Account<'info, PredictionMarket>,

    #[account(
        seeds = [FACTORY_SEED],
        bump = factory.bump,
        constraint = factory.authority == authority.key() @ SignalError::Unauthorized,
    )]
    pub factory: Account<'info, MarketFactory>,

    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<CancelMarket>) -> Result<()> {
    // NOTE: individual position refunds happen via separate claim instruction
    // when status is Cancelled
    ctx.accounts.market.status = MarketStatus::Cancelled;
    Ok(())
}
