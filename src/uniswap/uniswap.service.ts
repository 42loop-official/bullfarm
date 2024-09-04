import { Injectable, BadRequestException } from '@nestjs/common';
import { JsonRpcProvider, Wallet, parseEther, Contract, parseUnits, ethers } from 'ethers';
import { decrypt } from '../utils/cryptoUtils';
import { IUniswapResult } from '../interfaces/swap/IUniswapResult';
import { ISwapService } from '../interfaces/swap/ISwapService';
import { getProvider, getRouterAddress, getWETHAddress, getUniswapFactoryAddress } from '../utils/evmUtils';

@Injectable()
export class UniswapService implements ISwapService {
    constructor() { }
    /**
     * Lấy thông tin của token
     * @param tokenAddress 
     * @param chain 
     * @returns 
     */
    async getTokenData(tokenAddress: string, chain: string): Promise<any> {
        const provider = getProvider(chain);
        const tokenContract = new Contract(tokenAddress, [
            'function decimals() view returns (uint8)',
            'function symbol() view returns (string)',
            'function name() view returns (string)',
        ], provider);

        const [decimals, symbol, name] = await Promise.all([
            tokenContract.decimals(),
            tokenContract.symbol(),
            tokenContract.name()
        ]);

        return { tokenAddress, decimals, symbol, name };
    }

    /**
     * Lấy giá của token
     * @param tokenAddress 
     * @param chain 
     * @returns 
     */
    async getPrice(tokenAddress: string, chain: string): Promise<string> {
        const provider = getProvider(chain);
        const wethAddress = getWETHAddress(chain);
        const uniswapFactoryAddress = getUniswapFactoryAddress(chain);

        const uniswapFactory = new Contract(uniswapFactoryAddress, [
            'function getPair(address tokenA, address tokenB) external view returns (address pair)'
        ], provider);

        const pairAddress = await uniswapFactory.getPair(tokenAddress, wethAddress);
        if (!pairAddress) throw new Error('Pair not found');

        const pairContract = new Contract(pairAddress, [
            'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
            'function token0() view returns (address)'
        ], provider);

        const [reserve0, reserve1] = await pairContract.getReserves();
        const token0Address = await pairContract.token0();

        const wethReserve = token0Address === wethAddress ? reserve0 : reserve1;
        const tokenReserve = token0Address === wethAddress ? reserve1 : reserve0;

        const price = wethReserve / tokenReserve;
        return price.toString();
    }

    /**
     * Mua token
     * @param privateKey 
     * @param tokenAddress 
     * @param ethAmount 
     * @param chain 
     * @param slippage 
     * @returns 
     */
    async buyToken(privateKey: string, tokenAddress: string, ethAmount: string, chain: string, slippage: number): Promise<IUniswapResult> {
        tokenAddress = ethers.getAddress(tokenAddress);
        const wallet = new Wallet(privateKey);
        const provider = getProvider(chain);
        const signer = wallet.connect(provider);
        const uniswapRouterAddress = getRouterAddress(chain);
        const tokenData = await this.getTokenData(tokenAddress, chain);
        const wethAddress = getWETHAddress(chain);
        const uniswapRouter = new Contract(uniswapRouterAddress, [
            'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)'
        ], signer);

        const expectedAmountOut = await this.getReservesAndCalculateAmountOut(provider, tokenAddress, wethAddress, chain, ethAmount);
        const amountOutMin = expectedAmountOut * BigInt(100 - slippage) / BigInt(100);

        const path = [wethAddress, tokenAddress];
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 phút từ thời điểm hiện tại

        const gasPrice = await provider.getFeeData(); // Lấy thông tin về phí gas

        const tx = await uniswapRouter.swapExactETHForTokens(
            amountOutMin,
            path,
            wallet.address,
            deadline,
            {
                value: parseEther(ethAmount),
                gasLimit: 300000, // Tăng gas limit cho an toàn
                gasPrice: gasPrice.gasPrice, // Sử dụng gasPrice từ getFeeData
            },
        );
        await tx.wait();
        return { hash: tx.hash, address: tokenAddress, symbol: tokenData.symbol, decimals: tokenData.decimals, name: tokenData.name, chain: chain, amountOut: expectedAmountOut };
    }

    /**
     * Bán token
     * @param privateKey 
     * @param tokenAddress 
     * @param tokenAmount 
     * @param chain 
     * @param slippage 
     * @returns 
     */
    async sellToken(privateKey: string, tokenAddress: string, tokenAmount: string, chain: string, slippage: number): Promise<IUniswapResult> {
        tokenAddress = ethers.getAddress(tokenAddress);
        const provider = getProvider(chain);
        const wallet = new Wallet(privateKey);
        const signer = wallet.connect(provider);
        const uniswapRouterAddress = getRouterAddress(chain);
        const tokenData = await this.getTokenData(tokenAddress, chain);
        const wethAddress = getWETHAddress(chain);
        const expectedAmountOut = await this.getReservesAndCalculateAmountIn(provider, tokenAddress, wethAddress, chain, tokenAmount, tokenData.decimals);
        const amountOutMin = expectedAmountOut * BigInt(100 - slippage) / BigInt(100);

        const uniswapRouter = new Contract(uniswapRouterAddress, [
            'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)'
        ], signer);

        const tokenContract = new Contract(tokenAddress, [
            'function approve(address spender, uint amount) public returns (bool)',
            "function allowance(address owner, address spender) public view returns (uint256)"
        ], signer);

        await tokenContract.approve(uniswapRouterAddress, parseUnits(tokenAmount, tokenData.decimals));

        const path = [tokenAddress, wethAddress];
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 phút từ thời điểm hiện tại

        const gasPrice = await provider.getFeeData(); // Lấy thông tin về phí gas

        const tx = await uniswapRouter.swapExactTokensForETH(
            parseUnits(tokenAmount, tokenData.decimals),
            amountOutMin,
            path,
            wallet.address,
            deadline,
            {
                gasLimit: 300000, // Tăng gas limit cho an toàn
                gasPrice: gasPrice.gasPrice, // Sử dụng gasPrice từ getFeeData
            },
        );
        await tx.wait();

        if (tx.status === 0) throw new Error('Transaction failed');
        return { hash: tx.hash, address: tokenAddress, symbol: tokenData.symbol, decimals: tokenData.decimals, name: tokenData.name, chain: chain, amountOut: expectedAmountOut };
    }

    /**
     * Lấy thông tin về Reserves và tính toán expectedAmountOut
     * @param provider 
     * @param tokenAddress 
     * @param wethAddress 
     * @param chain 
     * @param ethAmount 
     * @returns 
     */
    private async getReservesAndCalculateAmountOut(
        provider: JsonRpcProvider,
        tokenAddress: string,
        wethAddress: string,
        chain: string,
        ethAmount: string
    ): Promise<bigint> {
        const uniswapFactoryAddress = getUniswapFactoryAddress(chain);
        const uniswapFactory = new Contract(uniswapFactoryAddress, [
            'function getPair(address tokenA, address tokenB) external view returns (address pair)'
        ], provider);

        const pairAddress = await uniswapFactory.getPair(tokenAddress, wethAddress);
        if (!pairAddress) throw new Error('Pair not found');

        const pairContract = new Contract(pairAddress, [
            'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
            'function token0() view returns (address)'
        ], provider);

        const [reserve0, reserve1] = await pairContract.getReserves();
        const token0Address = await pairContract.token0();

        const wethReserve = token0Address === wethAddress ? BigInt(reserve0) : BigInt(reserve1);
        const tokenReserve = token0Address === wethAddress ? BigInt(reserve1) : BigInt(reserve0);

        const ethAmountBigInt = parseEther(ethAmount); // Convert ethAmount to BigInt
        const expectedAmountOut = ethAmountBigInt * tokenReserve / wethReserve; // Calculate expectedAmountOut as BigInt

        return expectedAmountOut;
    }

    private async getReservesAndCalculateAmountIn(
        provider: JsonRpcProvider,
        tokenAddress: string,
        wethAddress: string,
        chain: string,
        tokenAmount: string,
        tokenDecimals: number
    ): Promise<bigint> {
        const uniswapFactoryAddress = getUniswapFactoryAddress(chain);
        const uniswapFactory = new Contract(uniswapFactoryAddress, [
            'function getPair(address tokenA, address tokenB) external view returns (address pair)'
        ], provider);

        const pairAddress = await uniswapFactory.getPair(tokenAddress, wethAddress);
        if (!pairAddress) throw new Error('Pair not found');

        const pairContract = new Contract(pairAddress, [
            'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
            'function token0() view returns (address)'
        ], provider);

        const [reserve0, reserve1] = await pairContract.getReserves();
        const token0Address = await pairContract.token0();

        // Xác định tokenReserve và wethReserve dựa trên tokenAddress
        const tokenReserve = token0Address === tokenAddress ? BigInt(reserve0) : BigInt(reserve1);
        const wethReserve = token0Address === tokenAddress ? BigInt(reserve1) : BigInt(reserve0);

        // Chuyển đổi tokenAmount sang BigInt dựa trên số thập phân của token
        const tokenAmountBigInt = ethers.parseUnits(tokenAmount, tokenDecimals); // tokenData.decimals là số thập phân của token

        // Tính toán lượng WETH (ETH) dự kiến nhận được
        const expectedAmountOut = (tokenAmountBigInt * wethReserve) / (tokenReserve + tokenAmountBigInt);

        return expectedAmountOut;
    }
}
