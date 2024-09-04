import { Module } from '@nestjs/common';
import { AnalyzeService } from './analyze.service';
import { AnalyzeController } from './analyze.controller';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisClientOptions } from 'redis';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [CacheModule.register<RedisClientOptions>({
    store: redisStore as any,
    url: process.env.REDIS_URL,
    isGlobal: true,
  }),],
  providers: [AnalyzeService],
  controllers: [AnalyzeController]
})
export class AnalyzeModule { }
