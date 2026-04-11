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

    /// CHECK: Pyth price feed account — validated against market.pyth_feed_id
    #[account(
        constraint = market.pyth_feed_id == Some(pyth_price_feed.key().to_bytes()) @ SignalError::OracleFeedMismatch,
    )]
    pub pyth_price_feed: UncheckedAccount<'info>,

    #[account(
        seeds = [FACTORY_SEED],
        bump = factory.bump,
        constraint = factory.authority == crank.key() @ SignalError::Unauthorized,
    )]
    pub factory: Account<'info, MarketFactory>,

    pub crank: Signer<'info>,
}

pub fn pyth_handler(ctx: Context<ResolveMarketPyth>) -> Result<()> {
    let clock = Clock::get()?;
    let market = &ctx.accounts.market;
    require!(clock.unix_timestamp >= market.resolve_at, SignalError::TooEarly);

    let target_price = market.target_price.ok_or(SignalError::InvalidResolutionConfig)?;
    let target_condition = market.target_condition.ok_or(SignalError::InvalidResolutionConfig)?;

    // Parse Pyth V2 price account data in a scope to release borrow before mut
    let (oracle_price_6dec, result) = {
        let feed_data = ctx.accounts.pyth_price_feed.try_borrow_data()
            .map_err(|_| SignalError::OracleStale)?;

        // Pyth V2 price account: minimum size to read through agg.status (offset 228)
        require!(feed_data.len() >= 232, SignalError::OracleFeedMismatch);

        // Validate Pyth magic number (0xa1b2c3d4)
        let magic = u32::from_le_bytes(
            feed_data[0..4].try_into().map_err(|_| SignalError::OracleFeedMismatch)?
        );
        require!(magic == 0xa1b2c3d4, SignalError::OracleFeedMismatch);

        // Exponent (i32 at offset 20) — typically -8 for USD pairs
        let expo = i32::from_le_bytes(
            feed_data[20..24].try_into().map_err(|_| SignalError::OracleFeedMismatch)?
        );

        // Aggregate price (i64 at offset 208)
        let agg_price = i64::from_le_bytes(
            feed_data[208..216].try_into().map_err(|_| SignalError::OracleFeedMismatch)?
        );

        // Aggregate status (u32 at offset 224) — 1 = Trading
        let agg_status = u32::from_le_bytes(
            feed_data[224..228].try_into().map_err(|_| SignalError::OracleFeedMismatch)?
        );
        require!(agg_status == 1, SignalError::OracleStale);

        // Timestamp (i64 at offset 96) — staleness check (5 min)
        let price_ts = i64::from_le_bytes(
            feed_data[96..104].try_into().map_err(|_| SignalError::OracleFeedMismatch)?
        );
        require!(
            clock.unix_timestamp.checked_sub(price_ts)
                .map_or(false, |age| age < 300),
            SignalError::OracleStale
        );

        require!(agg_price > 0, SignalError::OracleStale);

        // Normalize Pyth price to 6 decimal places (same scale as target_price)
        // target_price stored with 6 decimals: 150_000_000 = $150.00
        // Pyth price with expo: agg_price * 10^expo = real price
        // To get 6-dec: agg_price * 10^(expo + 6)
        let adjustment = expo.checked_add(6).ok_or(SignalError::MathOverflow)?;
        let scaled: i64 = if adjustment >= 0 {
            let factor = 10i64.checked_pow(adjustment as u32)
                .ok_or(SignalError::MathOverflow)?;
            agg_price.checked_mul(factor).ok_or(SignalError::MathOverflow)?
        } else {
            let factor = 10i64.checked_pow((-adjustment) as u32)
                .ok_or(SignalError::MathOverflow)?;
            agg_price.checked_div(factor).ok_or(SignalError::MathOverflow)?
        };

        let res = match target_condition {
            TargetCondition::Above => scaled > target_price as i64,
            TargetCondition::Below => scaled < target_price as i64,
        };

        (scaled, res)
    };

    let market = &mut ctx.accounts.market;
    market.status = MarketStatus::Resolved;
    market.result = Some(result);

    msg!("resolved: oracle_6dec={}, target={}, result={}", oracle_price_6dec, target_price, result);

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
