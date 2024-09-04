import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WalletDocument = Wallet & Document;

@Schema()
export class Wallet {
  @Prop({ unique: true, required: true })
  address: string;

  @Prop({ required: true })
  userId: number;

  @Prop({ required: true })
  privateKey: string;

  @Prop()
  mnemonic?: string;

  @Prop({required: true})
  type: string;

  @Prop({default: 5})
  buySlippage: number;

  @Prop({default: 5})
  sellSlippage: number;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);
