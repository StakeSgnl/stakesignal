use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::SignalError;
use crate::constants::*;

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(
        seeds = [FACTORY_SEED],
        bump = factory.bump,
    )]
    pub factory: Account<'info, MarketFactory>,

    #[account(
        seeds = [MARKET_SEED, &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Resolved @ SignalError::MarketNotOpen,
    )]
    pub market: Account<'info, PredictionMarket>,

    #[account(
        mut,
        seeds = [POSITION_SEED, market.key().as_ref(), user.key().as_ref()],
        bump = position.bump,
        constraint = !position.claimed @ SignalError::AlreadyClaimed,
        constraint = position.user == user.key() @ SignalError::Unauthorized,
        close = user,
    )]
    pub position: Account<'info, UserPosition>,

    #[account(
        mut,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ SignalError::Unauthorized,
        constraint = user_token_account.mint == market.lst_mint @ SignalError::UnsupportedLst,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimWinnings>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &ctx.accounts.position;

    let winning_side = match market.result {
        Some(true) => Side::Yes,
        Some(false) => Side::No,
        None => return err!(SignalError::MarketNotOpen),
    };

    require!(position.side == winning_side, SignalError::YouLost);

    let (winning_pool, losing_pool) = match winning_side {
        Side::Yes => (market.yes_pool, market.no_pool),
        Side::No => (market.no_pool, market.yes_pool),
    };

    let fee = losing_pool
        .checked_mul(ctx.accounts.factory.resolution_fee_bps as u64)
        .ok_or(SignalError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(SignalError::MathOverflow)?;

    let distributable = losing_pool
        .checked_sub(fee)
        .ok_or(SignalError::MathOverflow)?;

    let user_share = position.lst_amount
        .checked_mul(distributable)
        .and_then(|v| v.checked_div(winning_pool))
        .ok_or(SignalError::MathOverflow)?;

    let payout = position.lst_amount
        .checked_add(user_share)
        .ok_or(SignalError::MathOverflow)?;

    // NOTE: vault PDA signer seeds for transfer
    let market_key = market.key();
    let vault_bump = ctx.bumps.vault_token_account;
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_SEED, market_key.as_ref(), &[vault_bump]]];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault_token_account.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_ctx, payout)?;

    ctx.accounts.position.claimed = true;

    Ok(())
}
