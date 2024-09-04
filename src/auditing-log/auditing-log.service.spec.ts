import { Test, TestingModule } from '@nestjs/testing';
import { AuditingLogService } from './auditing-log.service';

describe('AuditingLogService', () => {
  let service: AuditingLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditingLogService],
    }).compile();

    service = module.get<AuditingLogService>(AuditingLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
