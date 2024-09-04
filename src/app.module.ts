import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { TelegramModule } from './telegram/telegram.module';
import * as redisStore from 'cache-manager-redis-yet';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletModule } from './wallet/wallet.module';
import { UniswapModule } from './uniswap/uniswap.module';
import { TokenModule } from './token/token.module';
import { TradeModule } from './trade/trade.module';
import { AuditingLogModule } from './auditing-log/auditing-log.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AnalyzeModule } from './analyze/analyze.module';

@Module({
  imports: [CacheModule.register({
    store: redisStore as any,
    host: 'localhost',
    port: 6379,
    isGlobal: true,
  }
  ),
  ConfigModule.forRoot({
    envFilePath: [`.env.${process.env.NODE_ENV}` || '.env'],
    isGlobal: true, // Đặt ConfigModule là toàn cục, không cần import lại trong các module khác
  }),
  MongooseModule.forRoot(process.env.MONGO_URI, { pass: process.env.MONGO_PASS, dbName: process.env.MONGO_DB, user: process.env.MONGO_USER }),
    AuthModule,
    UserModule,
    TelegramModule,
    WalletModule,
    UniswapModule,
    TokenModule,
    TradeModule,
    AuditingLogModule,
    AnalyzeModule
  ],
  controllers: [AppController],
  providers: [{
    provide: APP_INTERCEPTOR,
    useClass: CacheInterceptor,
  }, AppService],
})
export class AppModule { }
