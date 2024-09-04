import { Module } from '@nestjs/common';
import { TradeService } from './trade.service';
import { TradeController } from './trade.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { TokenSchema } from '../token/token.schema';
import { WalletSchema } from '../wallet/wallet.schema';
import { TokenService } from '../token/token.service';
import { WalletService } from '../wallet/wallet.service';
import { UniswapService } from '../uniswap/uniswap.service';
import { UserSchema } from '../user/user.schema';
import { UserService } from '../user/user.service';
import { AuditingLogSchema } from '../auditing-log/auditing-log.schema';
import { AuditingLogService } from '../auditing-log/auditing-log.service';

@Module({
  imports: [MongooseModule.forFeatureAsync([
    { name: 'tokens', useFactory: () => { return TokenSchema } },
    { name: 'wallets', useFactory: () => { return WalletSchema } },
    { name: 'users', useFactory: () => { return UserSchema } },
    { name: 'auditing-logs', useFactory: () => { return AuditingLogSchema } }
  ])],
  providers: [TradeService, TokenService, WalletService, UniswapService, UserService, AuditingLogService],
  controllers: [TradeController]
})
export class TradeModule { }
