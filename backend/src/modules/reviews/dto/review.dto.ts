import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type as TransformType } from 'class-transformer';

// Hallazgo cargado manualmente (Fase A, sin IA todavía). confidence queda en
// 1 y status en MATCHED porque lo está confirmando una persona directamente.
export class CreateFindingDto {
  @IsUUID()
  subtypeId: string;

  @IsString()
  @MinLength(5, { message: 'Copia el fragmento del texto que sustenta este hallazgo' })
  excerpt: string;
}

export class CreateReviewDto {
  @IsISO8601({}, { message: 'La fecha de estancia (stayDate) es obligatoria' })
  stayDate: string;

  @IsUUID()
  locationId: string;

  @IsOptional()
  @IsString()
  room?: string;

  @IsString()
  @MinLength(2)
  guestName: string;

  @IsUUID()
  platformId: string;

  @IsString()
  @MinLength(10, { message: 'Pega la observación completa que dejó el huésped' })
  rawText: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @TransformType(() => CreateFindingDto)
  findings?: CreateFindingDto[];
}

export class AddFindingDto extends CreateFindingDto {}

export class ReviewQueryDto {
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
  search?: string; // nombre del huésped o texto de la reseña

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  platformId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}