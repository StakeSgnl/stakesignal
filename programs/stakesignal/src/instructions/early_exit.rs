use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::SignalError;
use crate::constants::*;

#[derive(Accounts)]
pub struct EarlyExit<'info> {
    #[account(
        mut,
        seeds = [MARKET_SEED, &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Open @ SignalError::MarketNotOpen,
    )]
    pub market: Account<'info, PredictionMarket>,

    #[account(
        seeds = [FACTORY_SEED],
        bump = factory.bump,
    )]
    pub factory: Account<'info, MarketFactory>,

    #[account(
        mut,
        close = user,
        seeds = [POSITION_SEED, market.key().as_ref(), user.key().as_ref()],
        bump = position.bump,
        constraint = position.user == user.key() @ SignalError::Unauthorized,
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
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<EarlyExit>) -> Result<()> {
    let position = &ctx.accounts.position;
    let factory = &ctx.accounts.factory;

    let fee_amount = position.lst_amount
        .checked_mul(factory.early_exit_fee_bps as u64)
        .and_then(|v| v.checked_div(BPS_DENOMINATOR))
        .ok_or(SignalError::MathOverflow)?;

    let refund = position.lst_amount
        .checked_sub(fee_amount)
        .ok_or(SignalError::MathOverflow)?;

    let market = &mut ctx.accounts.market;
    match position.side {
        Side::Yes => {
            market.yes_pool = market.yes_pool
                .checked_sub(position.lst_amount)
                .ok_or(SignalError::MathOverflow)?;
        }
        Side::No => {
            market.no_pool = market.no_pool
                .checked_sub(position.lst_amount)
                .ok_or(SignalError::MathOverflow)?;
        }
    }

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
    token::transfer(transfer_ctx, refund)?;

    Ok(())
}
