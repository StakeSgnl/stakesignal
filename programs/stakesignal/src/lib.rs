use anchor_lang::prelude::*;

mod constants;
mod errors;
mod instructions;
mod state;

use instructions::*;

declare_id!("2WNxCQG7khECic8tNgWwPgEtEkVKrXhn9b5pSdKfR35b");

#[program]
pub mod stakesignal {
    use super::*;

    // ── Factory ──

    pub fn initialize_factory(
        ctx: Context<InitializeFactory>,
        resolution_fee_bps: u16,
        early_exit_fee_bps: u16,
    ) -> Result<()> {
        instructions::initialize_factory::handler(ctx, resolution_fee_bps, early_exit_fee_bps)
    }

    // ── Markets ──

    pub fn create_market(
        ctx: Context<CreateMarket>,
        title: String,
        description: String,
        resolve_at: i64,
        resolution_source: state::ResolutionSource,
        pyth_feed_id: Option<[u8; 32]>,
        target_price: Option<u64>,
        target_condition: Option<state::TargetCondition>,
    ) -> Result<()> {
        instructions::create_market::handler(
            ctx,
            title,
            description,
            resolve_at,
            resolution_source,
            pyth_feed_id,
            target_price,
            target_condition,
        )
    }

    pub fn resolve_market_pyth(ctx: Context<ResolveMarketPyth>) -> Result<()> {
        instructions::resolve_market::pyth_handler(ctx)
    }

    pub fn resolve_market_manual(
        ctx: Context<ResolveMarketManual>,
        result: bool,
    ) -> Result<()> {
        instructions::resolve_market::manual_handler(ctx, result)
    }

    pub fn cancel_market(ctx: Context<CancelMarket>) -> Result<()> {
        instructions::cancel_market::handler(ctx)
    }

    // ── Positions ──

    pub fn place_position(
        ctx: Context<PlacePosition>,
        side: state::Side,
        lst_amount: u64,
    ) -> Result<()> {
        instructions::place_position::handler(ctx, side, lst_amount)
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        instructions::claim_winnings::handler(ctx)
    }

    pub fn early_exit(ctx: Context<EarlyExit>) -> Result<()> {
        instructions::early_exit::handler(ctx)
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        instructions::claim_refund::handler(ctx)
    }

    // ── Admin ──

    pub fn add_lst_mint(ctx: Context<AddLstMint>, mint: Pubkey) -> Result<()> {
        instructions::add_lst_mint::handler(ctx, mint)
    }
}
