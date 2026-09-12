import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { CasePriority, CaseStatus, CaseType } from '@prisma/client';

export enum DashboardRange {
  TODAY = 'today',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_YEAR = 'this_year',
  CUSTOM = 'custom',
}

export class DashboardQueryDto {
  @IsOptional()
  @IsEnum(DashboardRange)
  range?: DashboardRange = DashboardRange.LAST_30_DAYS;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsEnum(CaseType)
  type?: CaseType;

  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @IsOptional()
  @IsEnum(CasePriority)
  priority?: CasePriority;

  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsUUID()
  responsibleId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
}
