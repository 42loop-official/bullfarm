import { Module } from '@nestjs/common';
import { UniswapService } from './uniswap.service';
import { UniswapController } from './uniswap.controller';

@Module({
  imports: [],
  providers: [UniswapService],
  controllers: [UniswapController]
})
export class UniswapModule { }
