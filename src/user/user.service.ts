import { Injectable } from '@nestjs/common';
import { User } from './user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { encrypt } from '../utils/cryptoUtils';

@Injectable()
export class UserService {
    constructor(@InjectModel('users') private model: Model<User>) { }

    async addUser(userId: number, secretKey: string): Promise<User> {
        const user = new this.model({ userId, otpSecret: encrypt(secretKey) });
        return await user.save();
    }

    async updateUser(user: User): Promise<boolean> {
        // update user
        const excute = await this.model.updateOne({ userId: user.userId }, user).exec()
        return excute.modifiedCount > 0;
    }

    async getUser(userId: number): Promise<User> {
        return await this.model.findOne({ userId });
    }

    async exitsUser(userId: number): Promise<boolean> {
        return await this.model.exists({ userId }) ? true : false;
    }
}
