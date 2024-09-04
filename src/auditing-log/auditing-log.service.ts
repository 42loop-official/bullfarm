import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AuditingLog } from './auditing-log.schema';
import { Model } from 'mongoose';

@Injectable()
export class AuditingLogService {
    constructor(@InjectModel("auditing-logs") private model: Model<AuditingLog>) { }

    async getLogs(userId: number): Promise<AuditingLog[]> {
        return await this.model.find({ userId });
    }

    async addLog(log: AuditingLog): Promise<AuditingLog> {
        return await this.model.create(log);
    }
}
