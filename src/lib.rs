use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use solana_program::program::invoke;

declare_id!("GmMTWPSwxFaM2Vsjpti6yCdx5akC2KCsiJ9jdEyAejLJ");

const TAX_PERCENT: u64 = 5; // 5% tax on launch funds
const MIN_STAKE: u64 = 1;   // Minimum stake amount
const REWARD_INTERVAL: i64 = 86_400; // 1 day in seconds

#[program]
pub mod utility_staking {
    use super::*;

    pub fn create_utility_token(
        ctx: Context<CreateUtilityToken>,
        symbol: String,
        launch_threshold: u64,
    ) -> Result<()> {
        let utility_token = &mut ctx.accounts.utility_token;
        utility_token.symbol = symbol;
        utility_token.real_token_mint = ctx.accounts.real_token_mint.key();
        utility_token.launch_threshold = launch_threshold;
        utility_token.funds_collected = 0;
        utility_token.launched = false;
        utility_token.last_reward_time = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn buy_token(ctx: Context<BuyToken>, amount: u64) -> Result<()> {
        let utility_token = &mut ctx.accounts.utility_token;
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_token_account.to_account_info(),
                    to: ctx.accounts.launch_vault.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            amount,
        )?;
        utility_token.funds_collected = utility_token.funds_collected
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
        Ok(())
    }

    pub fn launch_token(ctx: Context<LaunchToken>) -> Result<()> {
        let utility_token = &mut ctx.accounts.utility_token;
        require!(!utility_token.launched, ErrorCode::AlreadyLaunched);
        require!(
            utility_token.funds_collected >= utility_token.launch_threshold,
            ErrorCode::ThresholdNotMet
        );

        let total = utility_token.funds_collected;
        let tax = total.checked_mul(TAX_PERCENT).and_then(|x| x.checked_div(100)).ok_or(ErrorCode::MathOverflow)?;
        let liquidity_funds = total.checked_sub(tax).ok_or(ErrorCode::MathOverflow)?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.launch_vault.to_account_info(),
                    to: ctx.accounts.admin_tax_account.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            tax,
        )?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.launch_vault.to_account_info(),
                    to: ctx.accounts.liquidity_pool.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            liquidity_funds,
        )?;

        utility_token.launched = true;
        Ok(())
    }

    pub fn create_keyword_vault(
        ctx: Context<CreateKeywordVault>,
        keyword: String,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.keyword_vault;
        vault.utility_token = ctx.accounts.utility_token.key();
        vault.keyword = keyword;
        vault.total_staked = 0;
        vault.staker_count = 0;
        vault.locked = false;
        vault.eliminated = false;
        Ok(())
    }

    pub fn stake_on_keyword(
        ctx: Context<StakeOnKeyword>,
        amount: u64,
    ) -> Result<()> {
        require!(amount >= MIN_STAKE, ErrorCode::InsufficientStake);
        let keyword_vault = &mut ctx.accounts.keyword_vault;
        require!(!keyword_vault.locked && !keyword_vault.eliminated, ErrorCode::KeywordLockedOrEliminated);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.staker_token_account.to_account_info(),
                    to: ctx.accounts.vault_account.to_account_info(),
                    authority: ctx.accounts.staker.to_account_info(),
                },
            ),
            amount,
        )?;

        keyword_vault.total_staked = keyword_vault.total_staked
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
        keyword_vault.staker_count = keyword_vault.staker_count
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;

        let stake_record = &mut ctx.accounts.stake_record;
        stake_record.staker = ctx.accounts.staker.key();
        stake_record.amount = amount;
        stake_record.timestamp = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn distribute_rewards(ctx: Context<DistributeRewards>) -> Result<()> {
        let utility_token = &mut ctx.accounts.utility_token;
        let keyword_vault = &mut ctx.accounts.keyword_vault;
        let now = Clock::get()?.unix_timestamp;

        require!(
            now >= utility_token.last_reward_time + REWARD_INTERVAL,
            ErrorCode::RewardNotReady
        );
        require!(keyword_vault.total_staked > 0, ErrorCode::NoStakes);

        let reward_pool = utility_token.funds_collected / 10;
        let rarity_bonus = 1_000_000 / keyword_vault.staker_count.max(1);
        let base_reward = reward_pool
            .checked_mul(rarity_bonus)
            .and_then(|x| x.checked_div(1_000_000))
            .ok_or(ErrorCode::MathOverflow)?;
        let reward_per_staker = base_reward
            .checked_div(keyword_vault.staker_count.max(1))
            .ok_or(ErrorCode::MathOverflow)?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.reward_vault.to_account_info(),
                    to: ctx.accounts.staker_token_account.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            reward_per_staker,
        )?;

        utility_token.last_reward_time = now;
        Ok(())
    }

    pub fn lock_keyword(ctx: Context<LockKeyword>) -> Result<()> {
        let keyword_vault = &mut ctx.accounts.keyword_vault;
        require!(!keyword_vault.eliminated, ErrorCode::KeywordEliminated);
        keyword_vault.locked = true;
        Ok(())
    }

    pub fn eliminate_keyword(ctx: Context<EliminateKeyword>) -> Result<()> {
        let keyword_vault = &mut ctx.accounts.keyword_vault;
        require!(!keyword_vault.locked, ErrorCode::KeywordLocked);
        keyword_vault.eliminated = true;

        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Burn {
                    from: ctx.accounts.vault_account.to_account_info(),
                    mint: ctx.accounts.utility_token_mint.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            keyword_vault.total_staked,
        )?;

        keyword_vault.total_staked = 0;
        Ok(())
    }

    pub fn post_comment(
        ctx: Context<PostComment>,
        text: String,
        cost: u64,
    ) -> Result<()> {
        require!(cost >= MIN_STAKE, ErrorCode::InsufficientCost);
        
        // Initialize comment
        let comment = &mut ctx.accounts.comment;
        comment.author = ctx.accounts.buyer.key();
        comment.text = text;
        comment.boost = cost;
        comment.timestamp = Clock::get()?.unix_timestamp;
        
        Ok(())
    }

    pub fn transfer_to_vault_for_comment(
        ctx: Context<TransferToVaultForComment>,
        amount: u64,
    ) -> Result<()> {
        require!(amount >= MIN_STAKE, ErrorCode::InsufficientCost);
        
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.source_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            amount,
        )
    }

    pub fn boost_comment(
        ctx: Context<BoostComment>,
        boost_amount: u64,
    ) -> Result<()> {
        require!(boost_amount >= MIN_STAKE, ErrorCode::InsufficientCost);
        
        // Update comment with boost
        let comment = &mut ctx.accounts.comment;
        let now = Clock::get()?.unix_timestamp;
        let time_elapsed = now - comment.timestamp;
        let decay_factor = time_elapsed / (7 * 86_400);
        comment.boost = comment.boost >> decay_factor;
        comment.boost = comment.boost.checked_add(boost_amount).ok_or(ErrorCode::MathOverflow)?;
        
        Ok(())
    }
}

// Account Contexts
#[derive(Accounts)]
pub struct CreateUtilityToken<'info> {
    #[account(
        init,
        payer = user,
        space = UtilityToken::LEN,
        seeds = [b"utility", real_token_mint.key().as_ref()],
        bump,
    )]
    pub utility_token: Account<'info, UtilityToken>,
    /// CHECK: Real token mint
    pub real_token_mint: AccountInfo<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyToken<'info> {
    #[account(mut)]
    pub utility_token: Account<'info, UtilityToken>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub buyer_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub launch_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct LaunchToken<'info> {
    #[account(mut)]
    pub utility_token: Account<'info, UtilityToken>,
    #[account(mut)]
    pub launch_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub liquidity_pool: Account<'info, TokenAccount>,
    #[account(mut)]
    pub admin_tax_account: Account<'info, TokenAccount>,
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(keyword: String)]
pub struct CreateKeywordVault<'info> {
    #[account(
        init,
        payer = user,
        space = KeywordVault::LEN,
        seeds = [b"keyword", utility_token.key().as_ref(), keyword.as_bytes()],
        bump,
    )]
    pub keyword_vault: Account<'info, KeywordVault>,
    pub utility_token: Account<'info, UtilityToken>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StakeOnKeyword<'info> {
    #[account(mut)]
    pub keyword_vault: Account<'info, KeywordVault>,
    #[account(mut)]
    pub vault_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub staker: Signer<'info>,
    #[account(mut)]
    pub staker_token_account: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = staker,
        space = StakeRecord::LEN,
        seeds = [b"stake", keyword_vault.key().as_ref(), staker.key().as_ref()],
        bump,
    )]
    pub stake_record: Account<'info, StakeRecord>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DistributeRewards<'info> {
    #[account(mut)]
    pub utility_token: Account<'info, UtilityToken>,
    #[account(mut)]
    pub keyword_vault: Account<'info, KeywordVault>,
    #[account(mut)]
    pub reward_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub staker_token_account: Account<'info, TokenAccount>,
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct LockKeyword<'info> {
    #[account(mut)]
    pub keyword_vault: Account<'info, KeywordVault>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct EliminateKeyword<'info> {
    #[account(mut)]
    pub keyword_vault: Account<'info, KeywordVault>,
    #[account(mut)]
    pub vault_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub utility_token_mint: Account<'info, token::Mint>,
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct PostComment<'info> {
    #[account(
        init,
        payer = buyer,
        space = Comment::LEN,
    )]
    pub comment: Account<'info, Comment>,
    #[account(mut)]
    pub utility_token: Account<'info, UtilityToken>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferToVaultForComment<'info> {
    #[account(mut)]
    pub source_token_account: Account<'info, TokenAccount>,
    /// CHECK: This can be any token account that should receive the transfer
    #[account(mut)]
    pub vault_token_account: AccountInfo<'info>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BoostComment<'info> {
    #[account(mut)]
    pub comment: Account<'info, Comment>,
    #[account(mut)]
    pub booster: Signer<'info>,
}

// Data Structures
#[account]
pub struct UtilityToken {
    pub symbol: String,
    pub real_token_mint: Pubkey,
    pub launch_threshold: u64,
    pub funds_collected: u64,
    pub launched: bool,
    pub last_reward_time: i64,
}

impl UtilityToken {
    const LEN: usize = 8 + 4 + 10 + 32 + 8 + 8 + 1 + 8; // Discriminator + symbol (max 10) + mint + threshold + funds + launched + reward_time
}

#[account]
pub struct KeywordVault {
    pub utility_token: Pubkey,
    pub keyword: String,
    pub total_staked: u64,
    pub staker_count: u64,
    pub locked: bool,
    pub eliminated: bool,
}

impl KeywordVault {
    const LEN: usize = 8 + 32 + 4 + 50 + 8 + 8 + 1 + 1; // Discriminator + token + keyword (max 50) + staked + count + locked + eliminated
}

#[account]
pub struct StakeRecord {
    pub staker: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

impl StakeRecord {
    const LEN: usize = 8 + 32 + 8 + 8; // Discriminator + staker + amount + timestamp
}

#[account]
pub struct Comment {
    pub author: Pubkey,
    pub text: String,
    pub boost: u64,
    pub timestamp: i64,
}

impl Comment {
    const LEN: usize = 8 + 32 + 4 + 200 + 8 + 8; // Discriminator + author + text (max 200) + boost + timestamp
}

// Error Codes
#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow occurred.")]
    MathOverflow,
    #[msg("Token already launched.")]
    AlreadyLaunched,
    #[msg("Launch threshold not met.")]
    ThresholdNotMet,
    #[msg("Insufficient cost provided.")]
    InsufficientCost,
    #[msg("Insufficient stake amount.")]
    InsufficientStake,
    #[msg("Keyword is locked or eliminated.")]
    KeywordLockedOrEliminated,
    #[msg("Keyword already locked.")]
    KeywordLocked,
    #[msg("Keyword already eliminated.")]
    KeywordEliminated,
    #[msg("Rewards not ready yet.")]
    RewardNotReady,
    #[msg("No stakes to distribute rewards.")]
    NoStakes,
    #[msg("No keyword vaults provided.")]
    NoKeywordVaultsProvided,
    #[msg("Invalid vault index.")]
    InvalidVaultIndex,
}