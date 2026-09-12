import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { CaseType } from '@prisma/client';

export class CreateLocationDto {
  @IsString()
  @MinLength(2)
  name: string;
}

export class CreateAreaDto {
  @IsString()
  @MinLength(2)
  name: string;
}

export class CreateResponsibleDto {
  @IsUUID()
  areaId: string;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class CreateSubtypeDto {
  @IsUUID()
  areaId: string;

  @IsEnum(CaseType)
  type: CaseType;

  @IsString()
  @MinLength(2)
  name: string;
}

export class UpdateCatalogItemDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
