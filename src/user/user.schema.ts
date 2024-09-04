import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ unique: true, required: true })
  userId: number;

  @Prop()
  clientIp: string;

  @Prop()
  point: number;

  @Prop()
  inviteCode?: string;

  @Prop()
  inviteBy?: number;

  @Prop({required: true})
  otpSecret: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
