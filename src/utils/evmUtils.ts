
import { BadRequestException } from '@nestjs/common';
import { ethers, JsonRpcProvider } from 'ethers';

export function getExplorerUrl(chain: string, hash: string): string {
    switch (chain.toLowerCase()) {
        case 'ethereum':
        case 'ether':
            return `https://etherscan.io/tx/${hash}`;
        case 'base':
            return `https://basescan.org/tx/${hash}`;
        case 'optimism':
            return `https://optimistic.etherscan.io/tx/${hash}`;
        case 'arbitrum':
            return `https://arbiscan.io/tx/${hash}`;
        default:
            throw new BadRequestException(`Unsupported chain: ${chain}`);
    }
}

export function getBlockExplorerUrl(chain: string, blockName: number | string): string {
    switch (chain.toLowerCase()) {
        case 'ethereum':
        case 'ether':
            return `https://etherscan.io/block/${blockName}`;
        case 'base':
            return `https://basescan.org/block/${blockName}`;
        case 'optimism':
            return `https://optimistic.etherscan.io/block/${blockName}`;
        case 'arbitrum':
            return `https://arbiscan.io/block/${blockName}`;
        case 'solana':
            return `https://explorer.solana.com/block/${blockName}`;
        case 'tron':
            return `https://tronscan.org/#/block/${blockName}`;
        default:
            throw new BadRequestException(`Unsupported chain: ${blockName}`);
    }
}

export function getTokenExplorerUrl(chain: string, tokenAddress: string): string {
    switch (chain.toLowerCase()) {
        case 'ethereum':
        case 'ether':
            return `https://etherscan.io/token/${tokenAddress}`;
        case 'base':
            return `https://basescan.org/token/${tokenAddress}`;
        case 'optimism':
            return `https://optimistic.etherscan.io/token/${tokenAddress}`;
        case 'arbitrum':
            return `https://arbiscan.io/token/${tokenAddress}`;
        case 'solana':
            return `https://explorer.solana.com/token/${tokenAddress}`;
        case 'tron':
            return `https://tronscan.org/#/token20/${tokenAddress}`;
        default:
            throw new BadRequestException(`Unsupported chain: ${chain}`);
    }
}

export function getAddressExplorerUrl(chain: string, address: string): string {
    switch (chain.toLowerCase()) {
        case 'ethereum':
        case 'ether':
            return `https://etherscan.io/address/${address}`;
        case 'base':
            return `https://basescan.org/address/${address}`;
        case 'optimism':
            return `https://optimistic.etherscan.io/address/${address}`;
        case 'arbitrum':
            return `https://arbiscan.io/address/${address}`;
        case 'solana':
            return `https://explorer.solana.com/address/${address}`;
        case 'tron':
            return `https://tronscan.org/#/address/${address}`;
        default:
            throw new BadRequestException(`Unsupported chain: ${chain}`);
    }
}

export function getLockAddress(chain: string): string {
    switch (chain.toLowerCase()) {
        case 'ethereum':
        case 'ether':
            return ethers.getAddress(process.env.ETHEREUM_LOCK_ADDRESS);
        case 'base':
            return ethers.getAddress(process.env.BASE_LOCK_ADDRESS);
        case 'optimism':
            return ethers.getAddress(process.env.OPTIMISM_LOCK_ADDRESS);
        case 'arbitrum':
            return ethers.getAddress(process.env.ARBITRUM_LOCK_ADDRESS);
        default:
            throw new BadRequestException(`Unsupported chain: ${chain}`);
    }
}

export function getLockAbiInfo(chain: string): { event: string, decode: string[], amountIndex: number, unlockDateIndex: number } {
    switch (chain.toLowerCase()) {
        case 'ethereum':
        case 'ether':
            return {
                event: "onDeposit(address,address,uint256,uint256,uint256)",
                decode: ["address", "address", "uint256", "uint256", "uint256"],
                amountIndex: 2,
                unlockDateIndex: 4
            };
        case 'base':
            return {
                event: "onNewLock(uint256,address,address,uint256,uint256,uint256,uint16)",
                decode: ["uint256", "address", "address", "uint256", "uint256", "uint256", "uint16"],
                amountIndex: 3,
                unlockDateIndex: 5
            };
        default:
            throw new BadRequestException(`Unsupported chain: ${chain}`);
    }
}

export function getProvider(chain: string): JsonRpcProvider {
    let rpcUrl: string;

    switch (chain.toLowerCase()) {
        case 'ethereum':
        case 'ether':
            rpcUrl = process.env.ETHEREUM_RPC_URL;
            break;
        case 'base':
            rpcUrl = process.env.BASE_RPC_URL;
            break;
        case 'optimism':
            rpcUrl = process.env.OPTIMISM_RPC_URL;
            break;
        case 'arbitrum':
            rpcUrl = process.env.ARBITRUM_RPC_URL;
            break;
        case 'solana':
            rpcUrl = process.env.SOLANA_RPC_URL;
        case 'tron':
            rpcUrl = process.env.TRON_RPC_URL;
            break;
        default:
            throw new BadRequestException(`Unsupported chain: ${chain}`);
    }

    return new JsonRpcProvider(rpcUrl);
}

export function getRouterAddress(chain: string): string {
    switch (chain.toLowerCase()) {
        case 'ethereum':
        case 'ether':
            return ethers.getAddress(process.env.ETHEREUM_ROUTER_ADDRESS);
        case 'base':
            return ethers.getAddress(process.env.BASE_ROUTER_ADDRESS);
        case 'optimism':
            return ethers.getAddress(process.env.OPTIMISM_ROUTER_ADDRESS);
        case 'arbitrum':
            return ethers.getAddress(process.env.ARBITRUM_ROUTER_ADDRESS);
        default:
            throw new BadRequestException(`Unsupported chain: ${chain}`);
    }
}

export function getWETHAddress(chain: string): string {
    switch (chain.toLowerCase()) {
        case 'ethereum':
        case 'ether':
            return process.env.ETHEREUM_WETH_ADDRESS; // WETH address on Ethereum
        case 'base':
            return ethers.getAddress(process.env.BASE_WETH_ADDRESS); // WETH address on Base network
        case 'optimism':
            return ethers.getAddress(process.env.OPTIMISM_WETH_ADDRESS); // WETH address on Optimism
        case 'arbitrum':
            return ethers.getAddress(process.env.ARBITRUM_WETH_ADDRESS); // WETH address on Arbitrum
        default:
            throw new BadRequestException(`Unsupported chain: ${chain}`);
    }
}

export function getUniswapFactoryAddress(chain: string): string {
    switch (chain.toLowerCase()) {
        case 'ethereum':
        case 'ether':
            return ethers.getAddress(process.env.ETHEREUM_UNISWAP_FACTORY_ADDRESS); // Uniswap Factory address on Ethereum
        case 'base':
            return ethers.getAddress(process.env.BASE_UNISWAP_FACTORY_ADDRESS); // Uniswap Factory address on Base network
        case 'optimism':
            return ethers.getAddress(process.env.OPTIMISM_UNISWAP_FACTORY_ADDRESS); // Uniswap Factory address on Optimism
        case 'arbitrum':
            return ethers.getAddress(process.env.ARBITRUM_UNISWAP_FACTORY_ADDRESS); // Uniswap Factory address on Arbitrum
        default:
            throw new BadRequestException(`Unsupported chain: ${chain}`);
    }
}