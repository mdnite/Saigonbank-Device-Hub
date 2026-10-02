import { Module } from '@nestjs/common';
import { AuditsController } from './audits.controller';
import { AuditSummariesController } from './audit-summaries.controller';
import { AuditSummariesService } from './audit-summaries.service';
import { AuditsService } from './audits.service';

@Module({
  controllers: [AuditsController, AuditSummariesController],
  providers: [AuditsService, AuditSummariesService],
})
export class AuditsModule {}
