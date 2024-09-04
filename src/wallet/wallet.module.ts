import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/user.schema';
import { UserService } from '../user/user.service';
import { WalletSchema } from './wallet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'users', schema: UserSchema },
      { name: 'wallets', schema: WalletSchema }
    ]),
  ],
  providers: [WalletService, UserService],
  controllers: [WalletController]
})
export class WalletModule { }
