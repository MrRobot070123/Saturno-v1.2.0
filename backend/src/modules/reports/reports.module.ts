import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ExportService } from './export.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ExportService],
})
export class ReportsModule {}
