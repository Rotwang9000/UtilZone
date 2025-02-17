# Utility Staking on Solana

A decentralised platform inspired by pump.fun, where users can create a single utility token for any real-world token (e.g. ETH.util for ETH) and then stake on utility-specific keywords under that token. The system uses game mechanics to reward stakers, penalise false keywords via DAO-style governance, and allow token owners to lock in verified keywords to secure stakers’ funds.

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

This project is a Solana-based decentralised application (dApp) that bridges the gap between meme coins and utility tokens. Users can create a single utility token tied to any "real" token (for instance, ETH.util based on ETH) — ensuring one utility token per real token. Under each created utility token, users can propose and stake on various utility-related keywords (e.g. "Level 1", "EVM", "Gas Token"). The staking game is designed with DAO-style mechanisms that allow the community or admin to validate or eliminate keywords, rewarding stakers for choosing niche yet accurate descriptors while penalising overhyped or false claims.

## Features

- **Utility Token Creation:**  
  Create one utility token for any real token (e.g. ETH.util for ETH), with token metadata pulled from CoinGecko or a similar source.

- **Keyword-Specific Staking:**  
  Each utility token can have its own set of keywords. Users stake on these keywords to reflect the token’s perceived utility (e.g. "Level 1", "EVM", "Gas Token").

- **DAO-Style Governance:**  
  Community or admin voting mechanisms to eliminate or validate (lock-in) keywords, ensuring a playful yet robust ecosystem.

- **Reward Mechanism:**  
  Rewards are distributed evenly among stakers for a given keyword, meaning that keywords with fewer stakers yield higher per-staker rewards.

- **Penalty & Burn:**  
  Keywords that are eliminated trigger the burning or redistribution of staked tokens, maintaining game integrity.

- **Admin/DAO Keyword Lock:**  
  Prevent whales from manipulating outcomes by locking in verified keywords, thereby securing staker rewards.

## Tech Stack

- **Solana:**  
  High throughput, low fees blockchain network.

- **Rust & Anchor:**  
  For writing and deploying Solana programs (smart contracts).

- **TypeScript/JavaScript:**  
  For front-end development (React, Next.js or similar).

- **CoinGecko API:**  
  For pulling coin metadata and utility data.

- **Additional Libraries:**  
  - Chart.js / D3.js for data visualisation.
  - Solana Web3.js for interacting with the blockchain.

## Architecture

The dApp is composed of three primary layers:

1. **Frontend UI:**  
   Provides the user interface for creating utility tokens, staking on keywords, viewing charts, and interacting with the DAO.

2. **Backend API (Optional):**  
   Handles off-chain logic, data aggregation from CoinGecko, and serves data to the frontend.

3. **Solana Program (On-Chain):**  
   Implements utility token creation, staking, reward distribution, DAO governance, and keyword management.

### High-Level Architecture Diagram

```
              +------------------------------+
              |         Frontend UI          |
              | (React/Next.js + Charts)     |
              +-------------+----------------+
                            |
                            v
              +------------------------------+
              |     Backend API Server       |  <-- Optional: for data aggregation & analytics
              +-------------+----------------+
                            |
                            v
              +------------------------------+
              |   Solana Program (Rust)      |
              |    [Anchor Framework]        |
              +------------------------------+
```

## Project Structure

A suggested project structure:

```
utility-staking-solana/
├── programs/                 # Solana program (Rust/Anchor)
│   ├── Cargo.toml
│   ├── Anchor.toml
│   └── src/
│       ├── lib.rs            # Main program logic (utility token creation, staking, DAO functions, etc.)
│       └── instructions/     # Modules for stake, unstake, reward, lock_keyword, eliminate_keyword, etc.
├── app/                      # Frontend dApp (React/Next.js)
│   ├── package.json
│   ├── src/
│   │   ├── components/       # UI components (creation forms, staking panels, charts, etc.)
│   │   ├── pages/            # Application pages
│   │   └── utils/            # Solana/web3 and API utilities
├── backend/                  # Optional API server for CoinGecko data, analytics, etc.
│   ├── package.json
│   └── src/
│       └── index.ts
└── README.md                 # This file
```

## Plan of Action

1. **Requirements & Specification:**  
   - Define the rules for utility token creation (one per real token) and keyword staking.
   - Document business rules for utility keywords, penalties, rewards, and DAO governance.
   - Decide on off-chain vs. on-chain responsibilities.

2. **Development Environment Setup:**  
   - Install Rust, Anchor, and Solana CLI.
   - Initialise the Anchor project in the `programs/` directory.
   - Set up the frontend framework (e.g. Next.js) in the `app/` directory.
   - Configure the optional backend API server if needed.

3. **Smart Contract Development:**  
   - Develop utility token creation logic tied to real tokens (with CoinGecko integration for metadata).
   - Build the basic staking mechanism for keywords (stake/unstake functions).
   - Implement DAO-style governance functions (lock_keyword, eliminate_keyword).
   - Develop reward distribution logic to split rewards evenly across keyword stakers.

4. **Frontend Development:**  
   - Build UI for creating utility tokens and displaying token information.
   - Develop interfaces for staking on keywords and visualising utility metrics (charts).
   - Integrate Solana Web3.js for interaction with on-chain programs.

5. **Testing & Deployment:**  
   - Write tests for smart contract functions using Anchor's testing framework.
   - Test the frontend with a local Solana cluster (e.g. Devnet).
   - Prepare for mainnet deployment and security audits once core features are stable.

6. **Documentation & Community:**  
   - Document the process for utility token creation, staking, and DAO governance.
   - Create user guides and developer docs.
   - Engage early adopters to gather feedback and refine the game mechanics.

## Development Roadmap

- **Phase 1:**  
  - Set up the development environment.
  - Build a minimal viable product (MVP) with core utility token creation and staking functionality.

- **Phase 2:**  
  - Implement DAO-style keyword governance.
  - Integrate off-chain data (CoinGecko API) and data visualisation components.

- **Phase 3:**  
  - Conduct user testing, community engagement, and refine game mechanics.
  - Prepare for mainnet deployment and perform security audits.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request. Ensure your code adheres to our style guidelines and includes tests where applicable.

## License

This project is licensed under the MIT License.
