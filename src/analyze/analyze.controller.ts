import { Controller, Get, Param } from '@nestjs/common';
import { AnalyzeService } from './analyze.service';
import { IApiResult } from 'src/interfaces/IApiResult';

@Controller('analyze')
export class AnalyzeController {
    constructor(private AnalyzeService: AnalyzeService) { }
    @Get("token/:address")
    async analyze(@Param("address") address: string) {
        const apiResult: IApiResult = {
            success: false,
            message: "Failed to get token info",
            data: null
        };
        try {
            apiResult.data = await this.AnalyzeService.analyze(address);
            apiResult.success = true;
            apiResult.message = "Token info retrieved successfully";
        } catch (e) {
            apiResult.message = e.message;
        }
        return apiResult;
    }

    @Get("info/:address")
    async basic(@Param("address") address: string) {
        const apiResult: IApiResult = {
            success: false,
            message: "Failed to get basic info",
            data: null
        };
        try {
            apiResult.data = await this.AnalyzeService.getInfo(address);
            apiResult.success = true;
            apiResult.message = "Basic info retrieved successfully";
        } catch (e) {
            apiResult.message = e.message;
        }
        return apiResult;
    }
}
