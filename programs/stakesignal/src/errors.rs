use anchor_lang::prelude::*;

#[error_code]
pub enum SignalError {
    #[msg("Unauthorized: signer is not the factory authority")]
    Unauthorized,

    #[msg("Unsupported LST mint")]
    UnsupportedLst,

    #[msg("Market is not open")]
    MarketNotOpen,

    #[msg("Signal market has already been resolved")]
    MarketAlreadyResolved,

    #[msg("Resolution time has not been reached")]
    TooEarly,

    #[msg("Resolution time has passed, market should be resolved")]
    TooLate,

    #[msg("Pyth oracle price is stale")]
    OracleStale,

    #[msg("Pyth feed ID mismatch")]
    OracleFeedMismatch,

    #[msg("Market requires Pyth resolution")]
    UsePythResolution,

    #[msg("Market requires manual resolution")]
    UseManualResolution,

    #[msg("Position is on the losing side")]
    YouLost,

    #[msg("Payout already collected for this position")]
    AlreadyClaimed,

    #[msg("Insufficient LST amount")]
    InsufficientAmount,

    #[msg("Arithmetic overflow in position calculation")]
    MathOverflow,

    #[msg("Title exceeds maximum length")]
    TitleTooLong,

    #[msg("Description exceeds maximum length")]
    DescriptionTooLong,

    #[msg("Invalid resolution source configuration")]
    InvalidResolutionConfig,
}
