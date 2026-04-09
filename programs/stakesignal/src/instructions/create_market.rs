use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::SignalError;
use crate::constants::*;

#[derive(Accounts)]
pub struct CreateMarket<'info> {
    #[account(
        mut,
        seeds = [FACTORY_SEED],
        bump = factory.bump,
    )]
    pub factory: Account<'info, MarketFactory>,

    #[account(
        init,
        payer = creator,
        space = 8 + PredictionMarket::INIT_SPACE,
        seeds = [MARKET_SEED, &factory.total_markets.to_le_bytes()],
        bump,
    )]
    pub market: Account<'info, PredictionMarket>,

    pub lst_mint: Account<'info, anchor_spl::token::Mint>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<CreateMarket>,
    title: String,
    description: String,
    resolve_at: i64,
    resolution_source: ResolutionSource,
    pyth_feed_id: Option<[u8; 32]>,
    target_price: Option<u64>,
    target_condition: Option<TargetCondition>,
) -> Result<()> {
    require!(title.len() <= MAX_TITLE_LEN, SignalError::TitleTooLong);
    require!(description.len() <= MAX_DESCRIPTION_LEN, SignalError::DescriptionTooLong);

    let factory = &ctx.accounts.factory;
    let lst_mint_key = ctx.accounts.lst_mint.key();
    require!(
        factory.accepted_lst_mints.contains(&lst_mint_key),
        SignalError::UnsupportedLst
    );

    if resolution_source == ResolutionSource::PythOracle {
        require!(pyth_feed_id.is_some(), SignalError::InvalidResolutionConfig);
        require!(target_price.is_some(), SignalError::InvalidResolutionConfig);
        require!(target_condition.is_some(), SignalError::InvalidResolutionConfig);
    }

    let clock = Clock::get()?;
    let market = &mut ctx.accounts.market;
    market.market_id = ctx.accounts.factory.total_markets;
    market.title = title;
    market.description = description;
    market.creator = ctx.accounts.creator.key();
    market.lst_mint = lst_mint_key;
    market.yes_pool = 0;
    market.no_pool = 0;
    market.total_bettors = 0;
    market.created_at = clock.unix_timestamp;
    market.resolve_at = resolve_at;
    market.status = MarketStatus::Open;
    market.result = None;
    market.resolution_source = resolution_source;
    market.pyth_feed_id = pyth_feed_id;
    market.target_price = target_price;
    market.target_condition = target_condition;
    market.bump = ctx.bumps.market;

    let factory = &mut ctx.accounts.factory;
    factory.total_markets = factory.total_markets
        .checked_add(1)
        .ok_or(SignalError::MathOverflow)?;

    Ok(())
}
