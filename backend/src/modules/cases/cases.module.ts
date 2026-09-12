import { Module } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';
import { CaseNumberService } from './case-number.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [CasesController],
  providers: [CasesService, CaseNumberService],
  exports: [CasesService],
})
export class CasesModule {}
