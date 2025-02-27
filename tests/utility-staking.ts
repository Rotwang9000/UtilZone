// @ts-nocheck

import * as anchor from "@coral-xyz/anchor";
import { Program, web3, BN, Idl, AnchorProvider } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount } from "@solana/spl-token";
import { assert } from "chai";
import { UtilityStaking, IDL } from "../target/types/utility_staking";

describe("utility_staking", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = require("../target/idl/utility_staking.json") as Idl;
  const programId = new web3.PublicKey("GmMTWPSwxFaM2Vsjpti6yCdx5akC2KCsiJ9jdEyAejLJ");
  const program = new Program(idl, programId, provider as AnchorProvider);

  // Add a type assertion to make TypeScript happy
  type ProgramAccountNamespace = {
    utilityToken: { fetch(address: web3.PublicKey): Promise<any> },
    keywordVault: { fetch(address: web3.PublicKey): Promise<any> },
    stakeRecord: { fetch(address: web3.PublicKey): Promise<any> },
    comment: { fetch(address: web3.PublicKey): Promise<any> }
  };
  
  // Use type assertion when accessing program.account
  const programAccounts = program.account as unknown as ProgramAccountNamespace;

  const admin = (provider.wallet as anchor.Wallet).payer;
  const buyer = web3.Keypair.generate();
  const staker = web3.Keypair.generate();

  let mint: web3.PublicKey;
  let utilityTokenPda: web3.PublicKey;
  let launchVault: web3.PublicKey;
  let liquidityPool: web3.PublicKey;
  let adminTaxAccount: web3.PublicKey;
  let rewardVault: web3.PublicKey;
  let keywordVaultPda: web3.PublicKey;
  let vaultAccount: web3.PublicKey;
  let stakeRecordPda: web3.PublicKey;
  let commentPda: web3.PublicKey;

  const symbol = "ETH.util";
  const launchThreshold = new BN(1_100_000);
  const keyword = "EVM";

  async function deriveUtilityTokenPda(realTokenMint: web3.PublicKey): Promise<web3.PublicKey> {
    const [pda] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("utility"), realTokenMint.toBuffer()],
      program.programId
    );
    return pda;
  }

  async function deriveKeywordVaultPda(utilityToken: web3.PublicKey, keyword: string): Promise<web3.PublicKey> {
    const [pda] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("keyword"), utilityToken.toBuffer(), Buffer.from(keyword)],
      program.programId
    );
    return pda;
  }

  async function deriveStakeRecordPda(keywordVault: web3.PublicKey, staker: web3.PublicKey): Promise<web3.PublicKey> {
    const [pda] = await web3.PublicKey.findProgramAddress(
      [Buffer.from("stake"), keywordVault.toBuffer(), staker.toBuffer()],
      program.programId
    );
    return pda;
  }

  before(async () => {
    // Create mint
    mint = await createMint(provider.connection, admin, admin.publicKey, null, 9);
    utilityTokenPda = await deriveUtilityTokenPda(mint);

    // Create token accounts
    launchVault = (await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, admin.publicKey)).address;
    liquidityPool = (await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, admin.publicKey)).address;
    adminTaxAccount = (await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, admin.publicKey)).address;
    rewardVault = (await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, admin.publicKey)).address;
    vaultAccount = (await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, admin.publicKey)).address;

    // Airdrop SOL and fund buyer/staker
    for (const user of [buyer, staker]) {
      const airdropSig = await provider.connection.requestAirdrop(user.publicKey, 2e9);
      await provider.connection.confirmTransaction(airdropSig);

      const tokenAccount = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, user.publicKey);
      await mintTo(provider.connection, admin, mint, tokenAccount.address, admin, 10_000_000);
    }

    // Initialize utility token
    await program.methods
      .createUtilityToken(symbol, launchThreshold)
      .accounts({
        utilityToken: utilityTokenPda,
        realTokenMint: mint,
        user: admin.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    // Fund reward vault
    await mintTo(provider.connection, admin, mint, rewardVault, admin, 1_000_000);
  });

  // Core Token Mechanics
  it("Creates a utility token", async () => {
    const utilityToken = await programAccounts.utilityToken.fetch(utilityTokenPda);
    assert.equal(utilityToken.symbol, symbol);
    assert.ok(utilityToken.launchThreshold.eq(launchThreshold));
    assert.ok(utilityToken.fundsCollected.eq(new BN(0)));
    assert.equal(utilityToken.launched, false);
    assert.ok(utilityToken.lastRewardTime > 0);
  });

  it("Buyer contributes funds pre-launch", async () => {
    const amount = new BN(500_000);
    const buyerTokenAccount = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, buyer.publicKey);

    await program.methods
      .buyToken(amount)
      .accounts({
        utilityToken: utilityTokenPda,
        buyer: buyer.publicKey,
        buyerTokenAccount: buyerTokenAccount.address,
        launchVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([buyer])
      .rpc();

    const utilityToken = await programAccounts.utilityToken.fetch(utilityTokenPda);
    assert.ok(utilityToken.fundsCollected.eq(amount));
  });

  it("Launches token when threshold is met", async () => {
    const additionalAmount = new BN(600_000);
    const buyerTokenAccount = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, buyer.publicKey);

    await program.methods
      .buyToken(additionalAmount)
      .accounts({
        utilityToken: utilityTokenPda,
        buyer: buyer.publicKey,
        buyerTokenAccount: buyerTokenAccount.address,
        launchVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([buyer])
      .rpc();

    await program.methods
      .launchToken()
      .accounts({
        utilityToken: utilityTokenPda,
        launchVault,
        liquidityPool,
        adminTaxAccount,
        admin: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const utilityToken = await programAccounts.utilityToken.fetch(utilityTokenPda);
    assert.equal(utilityToken.launched, true);

    const adminTaxBalance = new BN((await provider.connection.getTokenAccountBalance(adminTaxAccount)).value.amount);
    const liquidityPoolBalance = new BN((await provider.connection.getTokenAccountBalance(liquidityPool)).value.amount);
    assert.ok(adminTaxBalance.eq(new BN(55_000))); // 5% of 1,100,000
    assert.ok(liquidityPoolBalance.eq(new BN(1_045_000)));
  });

  // Keyword Staking Tests
  it("Creates a keyword vault", async () => {
    keywordVaultPda = await deriveKeywordVaultPda(utilityTokenPda, keyword);

    await program.methods
      .createKeywordVault(keyword)
      .accounts({
        keywordVault: keywordVaultPda,
        utilityToken: utilityTokenPda,
        user: admin.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    const keywordVault = await programAccounts.keywordVault.fetch(keywordVaultPda);
    assert.equal(keywordVault.keyword, keyword);
    assert.ok(keywordVault.totalStaked.eq(new BN(0)));
    assert.ok(keywordVault.stakerCount.eq(new BN(0)));
    assert.equal(keywordVault.locked, false);
    assert.equal(keywordVault.eliminated, false);
  });

  it("Stakes on a keyword", async () => {
    const amount = new BN(100_000);
    const stakerTokenAccount = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, staker.publicKey);
    stakeRecordPda = await deriveStakeRecordPda(keywordVaultPda, staker.publicKey);

    await program.methods
      .stakeOnKeyword(amount)
      .accounts({
        keywordVault: keywordVaultPda,
        vaultAccount,
        staker: staker.publicKey,
        stakerTokenAccount: stakerTokenAccount.address,
        stakeRecord: stakeRecordPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([staker])
      .rpc();

    const keywordVault = await programAccounts.keywordVault.fetch(keywordVaultPda);
    assert.ok(keywordVault.totalStaked.eq(amount));
    assert.ok(keywordVault.stakerCount.eq(new BN(1)));

    const stakeRecord = await programAccounts.stakeRecord.fetch(stakeRecordPda);
    assert.ok(stakeRecord.amount.eq(amount));
    assert.equal(stakeRecord.staker.toBase58(), staker.publicKey.toBase58());
  });

  it("Fails to stake on locked keyword", async () => {
    await program.methods
      .lockKeyword()
      .accounts({
        keywordVault: keywordVaultPda,
        admin: admin.publicKey,
      })
      .rpc();

    const amount = new BN(50_000);
    const stakerTokenAccount = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, staker.publicKey);

    try {
      await program.methods
        .stakeOnKeyword(amount)
        .accounts({
          keywordVault: keywordVaultPda,
          vaultAccount,
          staker: staker.publicKey,
          stakerTokenAccount: stakerTokenAccount.address,
          stakeRecord: stakeRecordPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([staker])
        .rpc();
      assert.fail("Should have failed due to locked keyword");
    } catch (err) {
      assert.ok(err.toString().includes("KeywordLockedOrEliminated"));
    }
  });

  // Reward Distribution Tests
  it("Distributes rewards after interval", async () => {
    const stakerTokenAccount = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, staker.publicKey);
    const initialBalance = new BN(((await getAccount(provider.connection, stakerTokenAccount.address)).amount).toString());

    await program.methods
      .distributeRewards()
      .accounts({
        utilityToken: utilityTokenPda,
        keywordVault: keywordVaultPda,
        rewardVault,
        stakerTokenAccount: stakerTokenAccount.address,
        admin: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const newBalance = new BN(((await getAccount(provider.connection, stakerTokenAccount.address)).amount).toString());
    assert.ok(newBalance.gt(initialBalance), "Staker should receive a reward");
  });

  it("Fails to distribute rewards before interval", async () => {
    const stakerTokenAccount = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, staker.publicKey);

    try {
      await program.methods
        .distributeRewards()
        .accounts({
          utilityToken: utilityTokenPda,
          keywordVault: keywordVaultPda,
          rewardVault,
          stakerTokenAccount: stakerTokenAccount.address,
          admin: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      assert.fail("Should have failed due to reward not ready");
    } catch (err) {
      assert.ok(err.toString().includes("RewardNotReady"));
    }
  });

  // Governance Tests
  it("Eliminates a keyword and burns stakes", async () => {
    const newKeyword = "Gas";
    const newKeywordVaultPda = await deriveKeywordVaultPda(utilityTokenPda, newKeyword);
    await program.methods
      .createKeywordVault(newKeyword)
      .accounts({
        keywordVault: newKeywordVaultPda,
        utilityToken: utilityTokenPda,
        user: admin.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    const stakeAmount = new BN(200_000);
    const stakerTokenAccount = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, staker.publicKey);
    const newStakeRecordPda = await deriveStakeRecordPda(newKeywordVaultPda, staker.publicKey);

    await program.methods
      .stakeOnKeyword(stakeAmount)
      .accounts({
        keywordVault: newKeywordVaultPda,
        vaultAccount,
        staker: staker.publicKey,
        stakerTokenAccount: stakerTokenAccount.address,
        stakeRecord: newStakeRecordPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([staker])
      .rpc();

    await program.methods
      .eliminateKeyword()
      .accounts({
        keywordVault: newKeywordVaultPda,
        vaultAccount,
        utilityTokenMint: mint,
        admin: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const keywordVault = await programAccounts.keywordVault.fetch(newKeywordVaultPda);
    assert.equal(keywordVault.eliminated, true);
    assert.equal(keywordVault.totalStaked.toNumber(), 0);

    const vaultBalance = (await getAccount(provider.connection, vaultAccount)).amount;
    assert.equal(Number(vaultBalance), 0, "Staked tokens should be burned");
  });

  // Commenting and Boosting Tests
  it("Posts a comment with boost", async () => {
    const text = "Great utility token!";
    const cost = new BN(10_000);
    const buyerTokenAccount = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, buyer.publicKey);
    commentPda = web3.Keypair.generate().publicKey;

    // First create the comment
    await program.methods
      .postComment(text, cost)
      .accounts({
        comment: commentPda,
        utilityToken: utilityTokenPda,
        buyer: buyer.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    // Then transfer tokens to the vault
    await program.methods
      .transferToVaultForComment(cost)
      .accounts({
        sourceTokenAccount: buyerTokenAccount.address,
        vaultTokenAccount: keywordVaultPda, // Use the keyword vault as the destination
        authority: buyer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([buyer])
      .rpc();

    const comment = await programAccounts.comment.fetch(commentPda);
    assert.equal(comment.text, text);
    assert.ok(comment.boost.eq(cost));
    assert.equal(comment.author.toBase58(), buyer.publicKey.toBase58());
  });

  it("Boosts a comment with decay", async () => {
    const boostAmount = new BN(5_000);
    const stakerTokenAccount = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, staker.publicKey);

    // First boost the comment
    await program.methods
      .boostComment(boostAmount)
      .accounts({
        comment: commentPda,
        booster: staker.publicKey,
      })
      .signers([staker])
      .rpc();

    // Then transfer tokens to the vault
    await program.methods
      .transferToVaultForComment(boostAmount)
      .accounts({
        sourceTokenAccount: stakerTokenAccount.address,
        vaultTokenAccount: keywordVaultPda, // Use the keyword vault as the destination
        authority: staker.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([staker])
      .rpc();

    const comment = await programAccounts.comment.fetch(commentPda);
    assert.ok(comment.boost.eq(new BN(15_000))); // Initial 10,000 + 5,000 (no decay yet due to short test time)
  });

  it("Fails to boost with insufficient amount", async () => {
    const boostAmount = new BN(0);

    try {
      await program.methods
        .boostComment(boostAmount)
        .accounts({
          comment: commentPda,
          booster: staker.publicKey,
        })
        .signers([staker])
        .rpc();
      assert.fail("Should have failed due to insufficient cost");
    } catch (err) {
      assert.ok(err.toString().includes("InsufficientCost"));
    }
  });
});