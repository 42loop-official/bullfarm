import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { TradeService } from './trade.service';
import { FastifyRequest } from 'fastify';
import { ITradeParam } from '../interfaces/swap/ITradeParam';
import { IApiResult } from '../interfaces/IApiResult';

@Controller('trade')
export class TradeController {
    constructor(private readonly tradeService: TradeService) { }

    @Post(":id/:chain")
    async trade(@Param('id') id: number, @Param('chain') chain: string, @Body() param: ITradeParam, @Req() req: FastifyRequest) {
        const apiResult: IApiResult = {
            success: false,
            message: 'Failed to trade',
            data: null
        };
        try {
            // get otp header
            const otpHeader = req.headers['x-otp'] as string;
            if (!otpHeader) {
                apiResult.message = 'OTP is required';
            }
            if (!id) {
                apiResult.message = 'User id is required';
            }
            if (!param || !chain || !param.address || !param.amount || !param.type) {
                apiResult.message = 'Invalid trade param';
            }
            const tradeResult = await this.tradeService.trade(id, otpHeader, chain, param.address, param.amount, param.type);
            if (tradeResult) {
                apiResult.success = true;
                apiResult.message = 'Trade successfully';
                apiResult.data = tradeResult;
            }
        } catch (error) {
            apiResult.message = error.message;
            console.error(error);
        }
        return apiResult;
    }
}
