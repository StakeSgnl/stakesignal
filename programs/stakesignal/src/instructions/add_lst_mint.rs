use anchor_lang::prelude::*;
use crate::state::MarketFactory;
use crate::errors::SignalError;
use crate::constants::*;

#[derive(Accounts)]
pub struct AddLstMint<'info> {
    #[account(
        mut,
        seeds = [FACTORY_SEED],
        bump = factory.bump,
        constraint = factory.authority == authority.key() @ SignalError::Unauthorized,
    )]
    pub factory: Account<'info, MarketFactory>,

    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<AddLstMint>, mint: Pubkey) -> Result<()> {
    let factory = &mut ctx.accounts.factory;
    require!(
        factory.accepted_lst_mints.len() < MAX_LST_MINTS,
        SignalError::UnsupportedLst
    );
    require!(
        !factory.accepted_lst_mints.contains(&mint),
        SignalError::UnsupportedLst
    );
    factory.accepted_lst_mints.push(mint);
    Ok(())
}
