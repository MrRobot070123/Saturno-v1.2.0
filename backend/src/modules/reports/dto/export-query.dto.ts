import { IsIn, IsOptional } from 'class-validator';
import { CaseQueryDto } from '../../cases/dto/case.dto';

// El endpoint de exportación admite los mismos filtros que la lista de
// casos, más el parámetro 'format'. Se declara aquí explícitamente porque
// el ValidationPipe global usa forbidNonWhitelisted: true - cualquier campo
// de la query string que no esté declarado en el DTO se rechaza, así que
// 'format' necesita su propio DTO (extendiendo CaseQueryDto) en vez de
// viajar "suelto" junto a los filtros de caso.
export class ExportQueryDto extends CaseQueryDto {
  @IsOptional()
  @IsIn(['csv', 'excel', 'pdf'])
  format?: 'csv' | 'excel' | 'pdf';
}

// Para los reportes que no aceptan filtros de caso (por área, por
// responsable): solo necesitan el parámetro 'format'.
export class SimpleExportQueryDto {
  @IsOptional()
  @IsIn(['csv', 'excel', 'pdf'])
  format?: 'csv' | 'excel' | 'pdf';
}
