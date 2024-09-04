import { Controller, Get, Param, Query } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { IApiResult } from '../interfaces/IApiResult';

@Controller('wallet')
export class WalletController {
    constructor(private readonly walletService: WalletService) { }

    /**
     * Kiểm tra xem một user đã có wallet chưa
     * @param id 
     * @param type 
     * @returns 
     */
    @Get('exits/:id')
    async exitsWallet(@Param('id') id: number, @Query('type') type: 'solana' | 'evm' | 'ton') {
        const apiResult: IApiResult = {
            success: false,
            message: 'Failed to check wallet',
            data: null
        };
        try {
            apiResult.data = await this.walletService.exitsWallet(id, type);
            apiResult.success = true;
            apiResult.message = 'Wallet checked successfully';
        } catch (e) {
            apiResult.message = e.message;
        }
        return apiResult;
    }

    @Get(':type/:id')
    async getWallet(@Param("type") type: "solana" | "evm" | "ton", @Param('id') id: number) {
        const apiResult: IApiResult = {
            success: false,
            message: 'Failed to get wallet',
            data: null
        };
        try {
            const wallet = await this.walletService.getWallet(id, type)
            apiResult.data = wallet.address;
            apiResult.success = true;
        } catch (error) {
            apiResult.message = error.message;
        }
        return apiResult;
    }

    /**
     * Tạo một wallet mới cho user
     * @param id 
     * @param type 
     * @returns 
     */
    @Get('create/:id')
    async createWallet(@Param('id') id: number, @Query('type') type: 'solana' | 'evm' | 'ton') {
        const apiResult: IApiResult = {
            success: false,
            message: 'Failed to create wallet',
            data: null
        };
        try {
            apiResult.data = await this.walletService.createWallet(id, type);
            if (!apiResult.data) {
                return apiResult;
            }
            apiResult.success = true;
            apiResult.message = 'Wallet created successfully';
        } catch (e) {
            apiResult.message = e.message;
        }
        return apiResult;
    }

    @Get('balances/:chain/:address')
    async balance(@Param('chain') chain: string, @Param('address') address: string, @Query('token') token?: string) {
        const apiResult: IApiResult = {
            success: false,
            message: 'Failed to get balance',
            data: null
        };
        try {
            const balances = await this.walletService.getBalance(chain, address, token);
            delete balances.decimals;
            apiResult.data = balances;
            apiResult.success = true;
            apiResult.message = 'Balance checked successfully';
        } catch (error) {
            apiResult.message = error.message;
        }
        return apiResult;
    }
}
