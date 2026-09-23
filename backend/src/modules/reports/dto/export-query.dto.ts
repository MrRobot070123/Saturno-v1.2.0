import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';

// Filtros de TODOS los reportes (vista previa y exportación).
//
// - from / to son OBLIGATORIOS: sin rango de fechas no se consulta. Así ningún
//   reporte puede leer toda la tabla de casos de una sola vez.
// - El ValidationPipe global usa forbidNonWhitelisted: true, por eso cada
//   parámetro que el frontend envíe debe estar declarado aquí; de lo contrario
//   la petición se rechaza con 400.
// - El frontend envía las fechas con la hora de Colombia, por ejemplo
//   "2026-09-21T00:00:00.000-05:00" (ISO 8601 con offset).
export class ReportQueryDto {
  @IsISO8601({}, { message: 'La fecha inicial (from) es obligatoria y debe tener formato ISO 8601' })
  from: string;

  @IsISO8601({}, { message: 'La fecha final (to) es obligatoria y debe tener formato ISO 8601' })
  to: string;

  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsUUID()
  responsibleId?: string;
}

// Exportación: los mismos filtros más el formato del archivo.
export class ReportExportQueryDto extends ReportQueryDto {
  @IsOptional()
  @IsIn(['csv', 'excel', 'pdf'])
  format?: 'csv' | 'excel' | 'pdf';
}
