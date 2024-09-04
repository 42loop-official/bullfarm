import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Token } from './token.schema';

@Injectable()
export class TokenService {
    constructor(@InjectModel('tokens') private model: Model<Token>) { }

    async getToken(address: string): Promise<Token> {
        return this.model.findOne({ address: new RegExp(`^${address}$`, 'i') });
    }

    async addToken(token: Token): Promise<boolean> {
        const result = await this.model.updateOne({ address: token.address }, token, { upsert: true });

        return result.matchedCount > 0 || result.upsertedCount > 0 || result.modifiedCount > 0;
    }

    async removeToken(tokenAddress: string): Promise<boolean> {
        const result = await this.model.deleteOne({ address: tokenAddress });
        return result.deletedCount > 0;
    }
}
