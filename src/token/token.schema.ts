import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TokenDocument = Token & Document;

@Schema()
export class Audit {
    @Prop({ default: null })
    codeVerified: string | null;

    @Prop({ default: null })
    lockTransactions: string | null;

    @Prop({ default: null })
    mintable: string | null;

    @Prop({ default: null })
    proxy: string | null;

    @Prop({ default: '' })
    status: string;

    @Prop({ default: null })
    unlimitedFees: string | null;

    @Prop({ default: null })
    is_contract_renounced: string | null;

    @Prop({ default: '' })
    auditAuthor: string;
}

export const AuditSchema = SchemaFactory.createForClass(Audit);

@Schema()
export class Team {
    @Prop({ default: '' })
    wallet: string;
}

export const TeamSchema = SchemaFactory.createForClass(Team);

@Schema()
export class TokenInfo {
    @Prop({ default: '' })
    website: string;

    @Prop({ default: '' })
    twitter: string;

    @Prop({ default: '' })
    description: string;

    @Prop({ default: '' })
    telegram: string;

    @Prop({ default: '' })
    logo: string;
}
export const TokenInfoSchema = SchemaFactory.createForClass(TokenInfo);

@Schema()
export class LiquidityInfo {
    @Prop({ default: '' })
    info: string;

    @Prop({ default: '' })
    pair_id: string;
}
export const LiquidityInfoSchema = SchemaFactory.createForClass(LiquidityInfo);

@Schema()
export class Token {
    @Prop({ required: true })
    address: string;

    @Prop({ type: AuditSchema, required: true })
    audit: Audit;

    @Prop({ required: true })
    chain: string;

    @Prop({ required: true })
    decimals: number;

    @Prop({ default: 'N/A' })
    exchange: string;

    @Prop({ default: 'N/A' })
    fee: string;

    @Prop({ required: true })
    holders: number;

    @Prop({ type: LiquidityInfo })
    liquidity: LiquidityInfo;

    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    symbol: string;

    @Prop({ type: TeamSchema, required: true })
    team: Team;

    @Prop({ type: TokenInfoSchema, required: true })
    tokenInfo: TokenInfo;

    @Prop({ required: true })
    totalSupply: string;
}

export const TokenSchema = SchemaFactory.createForClass(Token);
