import { Context, MiddlewareFn } from 'telegraf';
import { RedisService } from './redis.service';

export function sessionMiddleware(redisService: RedisService): MiddlewareFn<Context> {
    return async (ctx: any, next) => {
        const sessionKey = `session:${ctx.from?.id}`;

        // Load session từ Redis
        ctx.session = await redisService.get(sessionKey) || {};

        await next();

        // Sau khi xử lý, lưu lại session vào Redis
        await redisService.set(sessionKey, ctx.session, 3600); // TTL 1 giờ
    };
}
