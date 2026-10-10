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

// Hallazgo cargado manualmente (Fase A, sin IA). confidence queda en 1 y
// status en MATCHED porque lo está confirmando una persona directamente.
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

  // Si se omite (o viene vacío), la reseña se clasifica automáticamente con
  // IA al crearse (Fase B). Si se envían hallazgos manuales, se respetan
  // tal cual y NO se dispara la clasificación automática para esta reseña.
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

  // Filtro de drill-down desde el gráfico "Hallazgos de reseñas por área"
  // del dashboard: trae solo las reseñas que tienen al menos un hallazgo
  // clasificado en esa área (misma lógica que reportes/dashboard usan para
  // reviewFinding.areaId).
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

// Aprobación de un hallazgo PENDING_APPROVAL (Fase B): el administrador
// elige UNA de dos rutas —
//   a) vincularlo a un tipo de queja que YA existe (subtypeId), o
//   b) crear un tipo de queja NUEVO dentro de un área (areaId + name),
//      que es lo que la IA proponía como "suggestedArea"/"suggestedName".
// El servicio valida que venga exactamente una de las dos combinaciones.
export class ApproveFindingDto {
  @IsOptional()
  @IsUUID()
  subtypeId?: string;

  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}