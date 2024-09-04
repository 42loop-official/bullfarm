
# BullFarmSwap Smart Contract

## Overview

The `BullFarmSwap` smart contract allows users to swap tokens via the Uniswap decentralized exchange with additional features such as tax handling, adjustable slippage, and pausing for emergency situations. The contract supports ETH-to-token, token-to-ETH, and token-to-token swaps while applying a configurable tax percentage. Tax is collected in ETH and sent to the contract owner.

## Features

- **Token Swapping**:
  - Swap ETH for tokens, tokens for ETH, or tokens for tokens via the Uniswap router.
  - Adjustable slippage tolerance for swaps.
- **Tax Handling**:
  - A configurable percentage of each swap is collected as a tax and converted to ETH.
  - The collected tax is transferred to the contract owner.
- **Pausing**:
  - The contract owner can pause all swap operations in case of an emergency.
- **Token Information**:
  - Provides metadata (name, symbol, owner) and liquidity information for any token paired with ETH on Uniswap.
- **Emergency Withdraw**:
  - The contract owner can withdraw any tokens held by the contract in case of an emergency.

## Contract Components

### Variables

- `uniswapRouter`: Address of the Uniswap V2 router.
- `uniswapFactory`: Address of the Uniswap V2 factory.
- `taxPercentage`: Percentage of the swap amount that will be collected as tax (in basis points).
- `defaultSlippagePercentage`: Default slippage percentage applied to all swaps if not provided by the user.
- `paused`: Boolean indicating whether the contract is paused.

### Events

- `TaxPercentageUpdated`: Emitted when the tax percentage is updated.
- `DefaultSlippagePercentageUpdated`: Emitted when the slippage percentage is updated.
- `TokensSwapped`: Emitted after a successful token swap.
- `TaxHandled`: Emitted when tax is collected and converted to ETH.
- `EthReceived`: Emitted when ETH is received by the contract.
- `Paused`: Emitted when the contract is paused or unpaused.
- `EmergencyWithdraw`: Emitted when the contract owner withdraws tokens in case of an emergency.

### Functions

#### Swap Functions

- `swapExactETHForTokens`: Swaps ETH for a specified token.
- `swapPercentageOfTokensForETH`: Swaps a percentage of the user's tokens for ETH.
- `swapExactTokensForETH`: Swaps an exact amount of tokens for ETH.
- `swapExactTokensForTokens`: Swaps an exact amount of one token for another.

#### Helper Functions

- `calculateAmountOutMin`: Calculates the minimum output amount considering slippage tolerance.
- `handleTax`: Handles tax collection and converts the tax amount to ETH.
- `getTokenInfo`: Returns metadata (name, symbol, owner) and liquidity information for a token.

#### Admin Functions

- `setTaxPercentage`: Allows the contract owner to set the tax percentage.
- `setDefaultSlippagePercentage`: Allows the contract owner to set the default slippage percentage.
- `setPaused`: Allows the contract owner to pause/unpause the contract.
- `emergencyWithdraw`: Allows the contract owner to withdraw tokens in case of an emergency.

#### Fallback Function

- `receive`: Fallback function to receive ETH when swapping tokens for ETH.

## Deployment

### Constructor

The constructor accepts the following parameters:

1. `_uniswapRouter`: Address of the Uniswap V2 Router contract.
2. `_taxPercentage`: Initial tax percentage to apply to swaps (e.g., `5` for 5%).
3. `_defaultSlippagePercentage`: Initial default slippage percentage (e.g., `5` for 5%).

```solidity
constructor(
    address _uniswapRouter,
    uint256 _taxPercentage,
    uint256 _defaultSlippagePercentage
) Ownable(msg.sender)
```

## Example Use Cases

1. **Swapping ETH for Tokens**:
   - A user can send ETH to the contract and receive tokens after slippage and tax are applied.
   - Tax is deducted and converted to ETH, which is sent to the owner.

2. **Swapping Tokens for ETH**:
   - A user can send tokens and receive ETH while a portion of the tokens is collected as tax.

3. **Handling Tax**:
   - Each swap includes a tax percentage, which is converted to ETH and transferred to the owner.

## Testing & Security

- **Reentrancy Guard**: The contract uses the `ReentrancyGuard` modifier to prevent reentrancy attacks.
- **Ownership**: The `Ownable` pattern is used to restrict administrative functions (tax, slippage, pausing, etc.) to the contract owner.
- **Pausing**: The contract owner can pause the contract in case of emergency situations.

## License

This contract is licensed under the MIT License.
