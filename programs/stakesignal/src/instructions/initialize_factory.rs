use anchor_lang::prelude::*;
use crate::state::MarketFactory;
use crate::constants::FACTORY_SEED;

#[derive(Accounts)]
pub struct InitializeFactory<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + MarketFactory::INIT_SPACE,
        seeds = [FACTORY_SEED],
        bump,
    )]
    pub factory: Account<'info, MarketFactory>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeFactory>,
    resolution_fee_bps: u16,
    early_exit_fee_bps: u16,
) -> Result<()> {
    let factory = &mut ctx.accounts.factory;
    factory.authority = ctx.accounts.authority.key();
    factory.treasury = ctx.accounts.authority.key();
    factory.total_markets = 0;
    factory.resolution_fee_bps = resolution_fee_bps;
    factory.early_exit_fee_bps = early_exit_fee_bps;
    factory.accepted_lst_mints = vec![];
    factory.bump = ctx.bumps.factory;
    Ok(())
}
