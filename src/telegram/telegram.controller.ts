import { Controller, Post, Body, Res, Query, Get, Req } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { TelegramService } from './telegram.service';

@Controller('tg')
export class TelegramController {
    constructor(private readonly telegramService: TelegramService) { }

    @Post('webhook')
    async handleUpdate(@Body() update: any, @Res() reply: FastifyReply) {
        const bot = this.telegramService.getBot();
        try {
            await bot.handleUpdate(update); // Sử dụng req.raw để tương thích với Fastify
            reply.status(200).send();
        } catch (err) {
            reply.status(500).send(err.message);
        }
    }
}
