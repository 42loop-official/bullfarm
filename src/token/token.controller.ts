import { Controller, Get, Param } from '@nestjs/common';
import { TokenService } from './token.service';
import { IApiResult } from '../interfaces/IApiResult';

@Controller('token')
export class TokenController {
    constructor(private tokenService: TokenService) { }

    @Get(':address')
    async getToken(@Param('address') address: string): Promise<IApiResult> {
        const apiResult: IApiResult = { success: false, message: '', data: null };
        try {
            const token = await this.tokenService.getToken(address);
            apiResult.success = true;
            apiResult.data = token;
        } catch (error) {
            apiResult.message = "No token found with the given address";
            console.error(error);
        }

        return apiResult;
    }
}
