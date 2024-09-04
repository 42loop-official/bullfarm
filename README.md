
# Trading System with NestJS and BullFarmSwap

## Overview

This project combines a trading system API built with **NestJS** and the **BullFarmSwap** smart contract for token swapping functionality. The **BullFarmSwap** contract enables token swapping on Uniswap with additional features like tax handling and adjustable slippage, while the **NestJS** API provides the backend for interacting with the contract and other trading functionalities.

## Features

### BullFarmSwap Smart Contract

- **Token Swapping**: Supports ETH-to-token, token-to-ETH, and token-to-token swaps via Uniswap.
- **Tax Handling**: A configurable tax percentage is deducted from each swap and sent to the contract owner in ETH.
- **Slippage Control**: Allows slippage percentage to be specified or uses a default value.
- **Emergency Pause**: The contract owner can pause the contract to stop all swapping activities.

### NestJS API

- **Wallet Integration**: Users can connect and manage their wallets.
- **Trading Interface**: Provides APIs to interact with the **BullFarmSwap** contract and initiate swaps.
- **Slippage & Tax Settings**: Set slippage and tax rates via the API.
- **Transaction Monitoring**: APIs to track and monitor swap transactions.
- **Security**: The NestJS API ensures security by incorporating role-based access control for administrative functions like tax rate modification.

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- npm or yarn
- Docker (optional for containerized deployment)
- A Uniswap-compatible wallet

### Smart Contract Deployment

1. Install dependencies:

   ```bash
   npm install
   ```

2. Compile and deploy the **BullFarmSwap** smart contract on the Optimism network:

   ```bash
   truffle compile
   truffle migrate --network optimism
   ```

3. Verify the contract on Etherscan:

   ```bash
   truffle run verify BullFarmSwap --network optimism
   ```

### NestJS API Setup

1. Clone the repository and navigate to the project directory:

   ```bash
   git clone https://github.com/42loop-official/bullfarm
   cd bullfarm
   ```

2. Install the necessary dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add the following environment variables:

   ```bash
   # .env
   PRIVATE_KEY=your_private_key
   INFURA_PROJECT_ID=your_infura_project_id
   ETHERSCAN_API_KEY=your_etherscan_api_key
   ```

4. Start the API server:

   ```bash
   npm run start:dev
   ```

   The API will be available at `http://localhost:3000`.

### API Endpoints

| Method | Endpoint                    | Description                               |
|--------|------------------------------|-------------------------------------------|
| POST   | `/api/trade/:id/:chain`       | Initiates a token swap using BullFarmSwap |
| GET    | `/api/wallet/exits/:id`       | Checks if a user has a wallet             |
| GET    | `/api/wallet/:type/:id`       | Retrieves the wallet address              |
| GET    | `/api/wallet/create/:id`      | Creates a new wallet                      |
| GET    | `/api/wallet/balances/:chain/:address` | Checks token balances              |
| GET    | `/api/token/:address`         | Retrieves token details                   |

## Example API Request

To initiate a trade:

```bash
curl -X POST http://localhost:3000/api/trade/123/evm -H 'Content-Type: application/json' -H 'x-otp: your-otp-code' -d '{
  "address": "0xTokenAddress",
  "amount": 1000000000000000000, // 1 token in wei
  "type": "buy"
}'
```

## License

This project is licensed under the MIT License.
