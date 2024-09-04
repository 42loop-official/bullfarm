import { ISwapResult } from "./ISwapResult";

export interface ISwapService {
    buyToken(privateKey: string, tokenAddress: string, tokenAmount: string, chain: string, slippage: number): Promise<ISwapResult>;
    sellToken(privateKey: string, tokenAddress: string, tokenAmount: string, chain: string, slippage: number): Promise<ISwapResult>;
    getPrice(tokenAddress: string, chain: string): Promise<string>;
}