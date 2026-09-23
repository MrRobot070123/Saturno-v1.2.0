import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { CasePriority, CaseStatus, CaseType } from '@prisma/client';

export class CreateCaseDto {
  @IsEnum(CaseType, { message: 'El tipo de caso debe ser QUEJA o SOLICITUD' })
  type: CaseType;

  @IsUUID()
  locationId: string;

  // Habitación (solo aplica cuando la ubicación es una torre con
  // numeración de habitaciones; el frontend la muestra condicionalmente).
  @IsOptional()
  @IsString()
  room?: string;

  @IsString()
  @MinLength(10, { message: 'La descripción debe ser suficientemente detallada' })
  description: string;

  @IsOptional()
  @IsUUID()
  areaId?: string;

  // Tipo de queja/solicitud (depende del área elegida).
  @IsOptional()
  @IsUUID()
  subtypeId?: string;

  @IsOptional()
  @IsUUID()
  responsibleId?: string;

  @IsOptional()
  @IsEnum(CasePriority)
  priority?: CasePriority;
}

export class UpdateCaseDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsString()
  room?: string;

  @IsOptional()
  @IsUUID()
  subtypeId?: string;

  @IsOptional()
  @IsEnum(CasePriority)
  priority?: CasePriority;
}

export class AssignCaseDto {
  @IsUUID()
  areaId: string;

  @IsUUID()
  responsibleId: string;
}

export class ChangeStatusDto {
  @IsEnum(CaseStatus)
  status: CaseStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CloseCaseDto {
  @IsString()
  @MinLength(5, { message: 'La observación de solución es obligatoria' })
  resolutionNote: string;
}

export class ReopenCaseDto {
  @IsString()
  @MinLength(5, { message: 'Debes indicar el motivo de la reapertura' })
  reason: string;
}

export class CaseQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize = 20;

  @IsOptional()
  @IsString()
  search?: string;

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
  locationId?: string;

  @IsOptional()
  @IsUUID()
  responsibleId?: string;

  @IsOptional()
  @IsUUID()
  subtypeId?: string;

  @IsOptional()
  @IsString()
  room?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortDir?: 'asc' | 'desc';
}
