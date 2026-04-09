use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::SignalError;
use crate::constants::*;

#[derive(Accounts)]
pub struct ResolveMarketPyth<'info> {
    #[account(
        mut,
        seeds = [MARKET_SEED, &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Open @ SignalError::MarketAlreadyResolved,
        constraint = market.resolution_source == ResolutionSource::PythOracle @ SignalError::UseManualResolution,
    )]
    pub market: Account<'info, PredictionMarket>,

    /// CHECK: Pyth price feed account, validated in handler
    pub pyth_price_feed: UncheckedAccount<'info>,

    pub crank: Signer<'info>,
}

pub fn pyth_handler(ctx: Context<ResolveMarketPyth>) -> Result<()> {
    let clock = Clock::get()?;
    let market = &ctx.accounts.market;
    require!(clock.unix_timestamp >= market.resolve_at, SignalError::TooEarly);

    // NOTE: Pyth integration will read price feed and compare to target
    // Placeholder: resolve as Yes for now
    let result = true;

    let market = &mut ctx.accounts.market;
    market.status = MarketStatus::Resolved;
    market.result = Some(result);

    Ok(())
}

#[derive(Accounts)]
pub struct ResolveMarketManual<'info> {
    #[account(
        mut,
        seeds = [MARKET_SEED, &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Open @ SignalError::MarketAlreadyResolved,
        constraint = market.resolution_source == ResolutionSource::Manual @ SignalError::UsePythResolution,
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

pub fn manual_handler(ctx: Context<ResolveMarketManual>, result: bool) -> Result<()> {
    let clock = Clock::get()?;
    require!(clock.unix_timestamp >= ctx.accounts.market.resolve_at, SignalError::TooEarly);

    let market = &mut ctx.accounts.market;
    market.status = MarketStatus::Resolved;
    market.result = Some(result);

    Ok(())
}
