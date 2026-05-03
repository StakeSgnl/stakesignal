use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::SignalError;
use crate::constants::*;

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(
        seeds = [MARKET_SEED, &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Cancelled @ SignalError::MarketNotOpen,
    )]
    pub market: Account<'info, PredictionMarket>,

    #[account(
        mut,
        close = user,
        seeds = [POSITION_SEED, market.key().as_ref(), user.key().as_ref()],
        bump = position.bump,
        constraint = position.user == user.key() @ SignalError::Unauthorized,
        constraint = !position.claimed @ SignalError::AlreadyClaimed,
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

    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

/// Refunds full LST amount from a cancelled market. No fee charged.
pub fn handler(ctx: Context<ClaimRefund>) -> Result<()> {
    let refund = ctx.accounts.position.lst_amount;

    let market_key = ctx.accounts.market.key();
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
    token::transfer(transfer_ctx, refund)?;

    msg!("refunded {} LST tokens from cancelled market", refund);
    Ok(())
}
