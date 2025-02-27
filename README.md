# Utility Staking on Solana

A decentralized platform inspired by pump.fun, where users can create a single utility token for any real-world token (e.g., `ETH.util` for ETH) and stake on utility-specific keywords under that token. The system uses game theory mechanics to reward stakers for niche, accurate keywords, penalize false claims via DAO-style governance, and provide a continuous dopamine hit through periodic rewards and interactive boosting.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Plan of Action](#plan-of-action)
- [Development Roadmap](#development-roadmap)
- [Contributing](#contributing)
- [License](#license)

## Overview

This project is a Solana-based decentralized application (dApp) that blends meme coin dynamics with utility token functionality. Users create one utility token per real token (e.g., `ETH.util` for ETH), ensuring uniqueness, and then stake on keywords that describe the token’s utility (e.g., "EVM", "Gas Token", "Layer 1"). A game-theoretic staking system rewards users for choosing rare yet accurate keywords, while DAO-style governance validates or eliminates keywords. Periodic reward drips and a comment boost decay mechanic keep users engaged, delivering a continuous dopamine hit.

## Features

- **Utility Token Creation:**  
  Create one utility token per real token, with metadata sourced from CoinGecko or similar APIs.

- **Keyword-Specific Staking:**  
  Users propose and stake on keywords under each utility token. Rarer keywords (fewer stakers) yield higher per-staker rewards, incentivizing strategic niche picks.

- **DAO-Style Governance:**  
  Community or admin can lock verified keywords or eliminate false ones, with eliminated stakes burned to deter overhype.

- **Reward Mechanism:**  
  - **Periodic Drips:** Rewards are distributed daily to stakers based on a quadratic formula favoring niche keywords, keeping users hooked.  
  - **Rarity Bonus:** Fewer stakers on a keyword amplify rewards, encouraging early adoption and accuracy.

- **Penalty & Burn:**  
  Eliminated keywords trigger a burn of staked tokens, maintaining ecosystem integrity and punishing speculative overhype.

- **Commenting & Boosting:**  
  - Token holders post comments with an initial boost (cost in tokens).  
  - Boosts decay over time (e.g., halve every 7 days), encouraging continuous engagement to maintain relevance.  
  - Boost costs are distributed to associated keyword vaults.

- **Admin/DAO Keyword Lock:**  
  Verified keywords can be locked to secure staker rewards and prevent manipulation by whales.

## Tech Stack

- **Solana:**  
  High-throughput, low-fee blockchain network.

- **Rust & Anchor:**  
  For writing and deploying Solana programs (smart contracts).

- **TypeScript/JavaScript:**  
  Frontend development with React or Next.js.

- **CoinGecko API:**  
  For pulling real token metadata.

- **Additional Libraries:**  
  - Chart.js / D3.js for staking and reward visualizations.  
  - Solana Web3.js for blockchain interactions.

## Architecture

The dApp consists of three layers:

1. **Frontend UI:**  
   Interfaces for token creation, keyword staking, comment boosting, and reward tracking, with visualizations for stakes and reward countdowns.

2. **Backend API (Optional):**  
   Aggregates off-chain data (e.g., CoinGecko metadata) and serves analytics to the frontend.

3. **Solana Program (On-Chain):**  
   Handles token creation, staking, reward distribution, governance, and comment mechanics.

### High-Level Architecture Diagram
```
          +----------------------------------+
          |         Frontend UI            |
          | (React/Next.js + Charts)       |
          +---------------+------------------+
                          |
                          v
          +----------------------------------+
          |     Backend API Server          |  <-- Optional: for data aggregation & analytics
          +---------------+------------------+
                          |
                          v
          +----------------------------------+
          |   Solana Program (Rust)         |
          |    [Anchor Framework]           |
          +----------------------------------+
```

## Project Structure

Suggested structure:
```
utility-staking-solana/
├── programs/                 # Solana program (Rust/Anchor)
│   ├── Cargo.toml
│   ├── Anchor.toml
│   └── src/
│       ├── lib.rs            # Core logic (token creation, staking, rewards, governance)
│       └── instructions/     # Instruction modules (stake, boost, lock, eliminate, etc.)
├── app/                      # Frontend dApp (React/Next.js)
│   ├── package.json
│   ├── src/
│   │   ├── components/       # UI components (token forms, staking panels, charts)
│   │   ├── pages/            # Application pages
│   │   └── utils/            # Solana/Web3.js and API utilities
├── backend/                  # Optional API server
│   ├── package.json
│   └── src/
│       └── index.ts
└── README.md                 # This file
```

## Plan of Action

1. **Requirements & Specification:**  
   - Define rules for token creation, keyword staking, and reward distribution.  
   - Specify governance mechanics (locking, elimination) and boost decay parameters.  
   - Clarify on-chain vs. off-chain responsibilities.

2. **Development Environment Setup:**  
   - Install Rust, Anchor, and Solana CLI.  
   - Initialize Anchor project in `programs/`.  
   - Set up frontend (e.g., Next.js) in `app/`.  
   - Configure optional backend API if needed.

3. **Smart Contract Development:**  
   - Implement utility token creation with CoinGecko metadata integration.  
   - Build keyword staking and reward distribution (quadratic rarity bonus, daily drips).  
   - Add governance functions (`lock_keyword`, `eliminate_keyword`) and boost decay logic.  

4. **Frontend Development:**  
   - Create UI for token creation, keyword staking, and comment boosting.  
   - Add visualizations for stakes, reward countdowns, and boost decay.  
   - Integrate Solana Web3.js for on-chain interactions.

5. **Testing & Deployment:**  
   - Write Anchor tests for staking, rewards, and governance.  
   - Test on Devnet with simulated staking wars and reward drips.  
   - Prepare for mainnet deployment with security audits.

6. **Documentation & Community:**  
   - Document token creation, staking, boosting, and governance processes.  
   - Provide user guides and developer docs.  
   - Engage early adopters to refine mechanics.

## Development Roadmap

- **Phase 1:**  
  - Set up environment and build MVP with token creation and basic staking.  
  - Implement comment posting and boosting with decay.

- **Phase 2:**  
  - Add keyword vaults, quadratic rewards, and daily reward drips.  
  - Integrate DAO-style governance and CoinGecko data.

- **Phase 3:**  
  - Conduct user testing and community feedback sessions.  
  - Optimize game mechanics (e.g., reward intervals, decay rates).  
  - Deploy to mainnet after audits.

## Contributing

Contributions are welcome! Fork the repo and submit pull requests. Ensure code follows style guidelines and includes tests.

## License

This project is licensed under the MIT License.
