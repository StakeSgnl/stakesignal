use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::SignalError;
use crate::constants::*;

#[derive(Accounts)]
pub struct PlacePosition<'info> {
    #[account(
        mut,
        seeds = [MARKET_SEED, &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Open @ SignalError::MarketNotOpen,
    )]
    pub market: Account<'info, PredictionMarket>,

    #[account(
        init,
        payer = user,
        space = 8 + UserPosition::INIT_SPACE,
        seeds = [POSITION_SEED, market.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub position: Account<'info, UserPosition>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ SignalError::Unauthorized,
        constraint = user_token_account.mint == market.lst_mint @ SignalError::UnsupportedLst,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<PlacePosition>,
    side: Side,
    lst_amount: u64,
) -> Result<()> {
    require!(lst_amount > 0, SignalError::InsufficientAmount);

    let clock = Clock::get()?;
    require!(clock.unix_timestamp < ctx.accounts.market.resolve_at, SignalError::TooLate);

    // NOTE: yield_at_entry would be fetched from LST exchange rate oracle in production
    let yield_at_entry: u64 = 0;

    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, lst_amount)?;

    let market = &mut ctx.accounts.market;
    match side {
        Side::Yes => {
            market.yes_pool = market.yes_pool
                .checked_add(lst_amount)
                .ok_or(SignalError::MathOverflow)?;
        }
        Side::No => {
            market.no_pool = market.no_pool
                .checked_add(lst_amount)
                .ok_or(SignalError::MathOverflow)?;
        }
    }
    market.total_bettors = market.total_bettors
        .checked_add(1)
        .ok_or(SignalError::MathOverflow)?;

    let position = &mut ctx.accounts.position;
    position.user = ctx.accounts.user.key();
    position.market = ctx.accounts.market.key();
    position.side = side;
    position.lst_amount = lst_amount;
    position.yield_at_entry = yield_at_entry;
    position.placed_at = clock.unix_timestamp;
    position.claimed = false;
    position.bump = ctx.bumps.position;

    Ok(())
}
