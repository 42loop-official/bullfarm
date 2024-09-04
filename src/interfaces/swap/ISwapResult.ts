export interface ISwapResult {
    hash: string;
    address: string;
    symbol: string;
    decimals: number;
    name: string;
    chain: string;
    amountOut: bigint;
}