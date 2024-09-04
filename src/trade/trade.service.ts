import { Injectable } from '@nestjs/common';
import { TokenService } from '../token/token.service';
import { UserService } from '../user/user.service';
import { WalletService } from '../wallet/wallet.service';
import { decrypt } from '../utils/cryptoUtils';
import { verifyOtp } from '../utils/otpUtils';
import { Chains } from '../constants/chainConstants';
import { UniswapService } from '../uniswap/uniswap.service';
import { IUniswapResult } from '../interfaces/swap/IUniswapResult';
import { ISwapService } from '../interfaces/swap/ISwapService';
import { ISwapResult } from '../interfaces/swap/ISwapResult';
import { Token } from '../token/token.schema';
import { AuditingLogService } from '../auditing-log/auditing-log.service';
import { AuditingLog } from '../auditing-log/auditing-log.schema';
import { ethers } from 'ethers';

@Injectable()
export class TradeService {
    constructor(
        private readonly userService: UserService,
        private readonly walletService: WalletService,
        private readonly uniswapService: UniswapService,
        private readonly tokenService: TokenService,
        private readonly auditingLogService: AuditingLogService
    ) { }

    async trade(userId: number, otp: string, chain: string, tokenAddress: string, amount: string, tradeType: "buy" | "sell"): Promise<string> {
        const user = await this.userService.getUser(userId);
        if (!user) {
            throw new Error('User not found');
        }
        //verify otp
        if (!verifyOtp(decrypt(user.otpSecret), otp)) {
            throw new Error('Invalid OTP, Please try again:');
        }
        const chainInfo = Chains.find(c => c.name === chain);
        if (!chainInfo) {
            throw new Error('Invalid chain');
        }
        const wallet = await this.walletService.getWallet(userId, chainInfo.walletType as any);
        if (!wallet) {
            throw new Error('Wallet not found');
        }
        let swapResult: ISwapResult = null
        let swapService: ISwapService = null;

        switch (chain) {
            case 'ethereum':
            case 'ether':
            case 'optimism':
            case 'base':
            case 'arbitrum':
                swapService = this.uniswapService;
                break;
            default:
                throw new Error('Invalid chain');
        }
        switch (tradeType) {
            case "buy":
                swapResult = await swapService.buyToken(decrypt(wallet.privateKey), tokenAddress, amount, chain, wallet.buySlippage);
                const buyAuditingLog = new AuditingLog();
                buyAuditingLog.userId = userId;
                buyAuditingLog.action = tradeType;
                buyAuditingLog.profit = `${-1 * Number.parseFloat(amount)}`;
                buyAuditingLog.description = `Buy ${amount} ETH for ${ethers.formatUnits(swapResult.amountOut, swapResult.decimals)} ${swapResult.symbol}`;
                await this.auditingLogService.addLog(buyAuditingLog);
                break;
            case "sell":
                const balances = await this.walletService.getBalance(chain, wallet.address, tokenAddress,);
                if (!balances || balances.amount === '0') {
                    throw new Error('Insufficient balance');
                }
                const amountIn = Number.parseFloat(balances.amount) * Number.parseInt(amount) / 100;
                swapResult = await swapService.sellToken(decrypt(wallet.privateKey), tokenAddress, `${amountIn}`, chain, wallet.buySlippage);
                const auditingLog = new AuditingLog();
                auditingLog.userId = userId;
                auditingLog.action = tradeType;
                auditingLog.profit = `${amountIn}`;
                auditingLog.description = `Sell ${amountIn} ${swapResult.symbol} for ${ethers.formatEther(swapResult.amountOut)} ETH`;
                await this.auditingLogService.addLog(auditingLog);
                break;
        }
        if (!swapResult) {
            throw new Error('Trade failed');
        }

        return swapResult.hash;
    }
}
