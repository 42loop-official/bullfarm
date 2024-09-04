import { Test, TestingModule } from '@nestjs/testing';
import { AuditingLogController } from './auditing-log.controller';

describe('AuditingLogController', () => {
  let controller: AuditingLogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditingLogController],
    }).compile();

    controller = module.get<AuditingLogController>(AuditingLogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
