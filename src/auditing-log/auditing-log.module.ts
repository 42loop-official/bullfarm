import { Module } from '@nestjs/common';
import { AuditingLogService } from './auditing-log.service';
import { AuditingLogController } from './auditing-log.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditingLogSchema } from './auditing-log.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'auditing-logs', schema: AuditingLogSchema }])],
  providers: [AuditingLogService],
  controllers: [AuditingLogController]
})
export class AuditingLogModule {}
