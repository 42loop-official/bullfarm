// auditing log schema
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditingLogDocument = AuditingLog & Document;

@Schema()
export class AuditingLog {
    @Prop({ required: true })
    userId: number;

    @Prop({ required: true })
    action: string;

    @Prop({ required: true })
    description: string;

    @Prop()
    profit: string;

    @Prop({ default: Date.now })
    createdAt: Date;
}

export const AuditingLogSchema = SchemaFactory.createForClass(AuditingLog);