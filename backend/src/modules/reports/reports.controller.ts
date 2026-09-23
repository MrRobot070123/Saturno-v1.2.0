import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { formatDateTimeCO } from '../../common/utils/date-format.util';
import { ReportsService } from './reports.service';
import { ExportColumn, ExportService } from './export.service';
import { ReportExportQueryDto, ReportQueryDto } from './dto/export-query.dto';

// Columnas del reporte general: el Área solo se agrega cuando la consulta
// NO viene filtrada por área (si ya se filtró por un área específica, la
// columna sería redundante en todas las filas).
function buildGeneralColumns(includeArea: boolean): ExportColumn[] {
  const columns: ExportColumn[] = [
    { header: 'Número', key: 'caseNumber', width: 16 },
    { header: 'Tipo', key: 'type', width: 12 },
    { header: 'Estado', key: 'status', width: 14 },
    { header: 'Prioridad', key: 'priority', width: 12 },
  ];
  if (includeArea) {
    columns.push({ header: 'Área', key: 'area', width: 18 });
  }
  columns.push(
    { header: 'Descripción', key: 'description', width: 30 },
    { header: 'Observación de solución', key: 'resolutionNote', width: 30 },
    { header: 'Creado por', key: 'createdByName', width: 20 },
    { header: 'Asignado a', key: 'responsibleName', width: 20 },
    { header: 'Creado (hora Colombia)', key: 'createdAt', width: 20 },
    { header: 'Cerrado (hora Colombia)', key: 'closedAt', width: 20 },
  );
  return columns;
}

const PENDING_COLUMNS: ExportColumn[] = [
  { header: 'Número', key: 'caseNumber', width: 16 },
  { header: 'Tipo', key: 'type', width: 12 },
  { header: 'Estado', key: 'status', width: 14 },
  { header: 'Prioridad', key: 'priority', width: 12 },
  { header: 'Ubicación', key: 'location', width: 18 },
  { header: 'Área', key: 'area', width: 18 },
  { header: 'Descripción', key: 'description', width: 30 },
  { header: 'Creado por', key: 'createdByName', width: 20 },
  { header: 'Asignado a', key: 'responsibleName', width: 20 },
  { header: 'Creado (hora Colombia)', key: 'createdAt', width: 20 },
];

const BY_AREA_COLUMNS: ExportColumn[] = [
  { header: 'Área', key: 'area_name', width: 22 },
  { header: 'Total', key: 'total', width: 10 },
  { header: 'Resueltos', key: 'resueltos', width: 12 },
  { header: 'Pendientes', key: 'pendientes', width: 12 },
  { header: 'Horas prom. resolución', key: 'avg_hours', width: 18 },
];

const BY_RESPONSIBLE_COLUMNS: ExportColumn[] = [
  { header: 'Responsable', key: 'responsible_name', width: 24 },
  { header: 'Total', key: 'total', width: 10 },
  { header: 'Resueltos', key: 'resueltos', width: 12 },
  { header: 'Pendientes', key: 'pendientes', width: 12 },
  { header: 'Horas prom. resolución', key: 'avg_hours', width: 18 },
];

const RESOLUTION_TIME_COLUMNS: ExportColumn[] = [
  { header: 'Caso', key: 'caseNumber', width: 16 },
  { header: 'Tipo', key: 'type', width: 12 },
  { header: 'Creado por', key: 'createdByName', width: 20 },
  { header: 'Asignado a', key: 'responsibleName', width: 20 },
  { header: 'Creado (hora Colombia)', key: 'createdAt', width: 20 },
  { header: 'Cerrado (hora Colombia)', key: 'closedAt', width: 20 },
  { header: 'Duración (horas)', key: 'durationHours', width: 16 },
];

// Todos los reportes exigen un rango de fechas (from/to) y aceptan de forma
// opcional areaId / responsibleId. Ver ReportQueryDto y ReportsService para los
// límites de rango y de filas.
//
// Nota: los campos "Creado por" y "Asignado a" (y el "Área" condicional del
// reporte general) se aplican por igual a Excel, CSV y PDF, porque los tres
// formatos comparten el mismo arreglo de columnas y las mismas filas.
@Controller('reports')
@UseGuards(PermissionsGuard)
@RequirePermissions('report:view')
export class ReportsController {
  constructor(
    private reportsService: ReportsService,
    private exportService: ExportService,
  ) {}

  // ---------- Vista previa en pantalla (máx. 300 filas en los reportes de detalle) ----------

  @Get('cases')
  general(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportQueryDto) {
    return this.reportsService.general(user.hotelId, query);
  }

  @Get('pending')
  pending(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportQueryDto) {
    return this.reportsService.pending(user.hotelId, query);
  }

  @Get('by-area')
  byArea(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportQueryDto) {
    return this.reportsService.byArea(user.hotelId, query);
  }

  @Get('by-responsible')
  byResponsible(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportQueryDto) {
    return this.reportsService.byResponsible(user.hotelId, query);
  }

  @Get('resolution-time')
  resolutionTime(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportQueryDto) {
    return this.reportsService.resolutionTimes(user.hotelId, query);
  }

  // ---------- Exportación (máx. 5.000 filas; si se supera, responde 400 con un mensaje claro) ----------

  @Get('cases/export')
  async exportGeneral(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportExportQueryDto,
    @Res() res: Response,
  ) {
    const format = query.format ?? 'excel';
    const rows = await this.reportsService.general(user.hotelId, query, 'export');
    const flat = rows.map((r) => ({
      caseNumber: r.caseNumber,
      type: r.type,
      status: r.status,
      priority: r.priority,
      area: r.area?.name ?? 'Sin asignar',
      description: r.description,
      resolutionNote: r.resolutionNote ?? '',
      createdByName: r.createdBy?.fullName ?? '',
      responsibleName: r.responsible?.fullName ?? 'Sin asignar',
      createdAt: formatDateTimeCO(r.createdAt),
      closedAt: formatDateTimeCO(r.closedAt),
    }));

    // Área solo se agrega como columna si la consulta NO trae un área
    // específica ya filtrada (query.areaId vacío = "todas las áreas").
    const columns = buildGeneralColumns(!query.areaId);

    return this.dispatchExport(res, format, 'reporte-casos', 'Reporte General de Casos', columns, flat);
  }

  @Get('pending/export')
  async exportPending(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportExportQueryDto,
    @Res() res: Response,
  ) {
    const format = query.format ?? 'excel';
    const rows = await this.reportsService.pending(user.hotelId, query, 'export');
    const flat = rows.map((r) => ({
      caseNumber: r.caseNumber,
      type: r.type,
      status: r.status,
      priority: r.priority,
      location: r.location?.name ?? '',
      area: r.area?.name ?? 'Sin asignar',
      description: r.description,
      createdByName: r.createdBy?.fullName ?? '',
      responsibleName: r.responsible?.fullName ?? 'Sin asignar',
      createdAt: formatDateTimeCO(r.createdAt),
    }));

    return this.dispatchExport(
      res,
      format,
      'reporte-pendientes',
      'Reporte de Casos Pendientes',
      PENDING_COLUMNS,
      flat,
    );
  }

  @Get('by-area/export')
  async exportByArea(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportExportQueryDto,
    @Res() res: Response,
  ) {
    const format = query.format ?? 'excel';
    const rows = await this.reportsService.byArea(user.hotelId, query);
    const flat = rows.map((r) => ({
      area_name: r.area_name,
      total: r.total,
      resueltos: r.resueltos,
      pendientes: r.pendientes,
      avg_hours: r.avg_hours ? Number(r.avg_hours).toFixed(1) : '—',
    }));

    return this.dispatchExport(res, format, 'reporte-por-area', 'Reporte de Casos por Área', BY_AREA_COLUMNS, flat);
  }

  @Get('by-responsible/export')
  async exportByResponsible(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportExportQueryDto,
    @Res() res: Response,
  ) {
    const format = query.format ?? 'excel';
    const rows = await this.reportsService.byResponsible(user.hotelId, query);
    const flat = rows.map((r) => ({
      responsible_name: r.responsible_name,
      total: r.total,
      resueltos: r.resueltos,
      pendientes: r.pendientes,
      avg_hours: r.avg_hours ? Number(r.avg_hours).toFixed(1) : '—',
    }));

    return this.dispatchExport(
      res,
      format,
      'reporte-por-responsable',
      'Reporte de Casos por Responsable',
      BY_RESPONSIBLE_COLUMNS,
      flat,
    );
  }

  @Get('resolution-time/export')
  async exportResolutionTime(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportExportQueryDto,
    @Res() res: Response,
  ) {
    const format = query.format ?? 'excel';
    const rows = await this.reportsService.resolutionTimes(user.hotelId, query, 'export');
    const flat = rows.map((r) => ({
      caseNumber: r.caseNumber,
      type: r.type,
      createdByName: r.createdByName,
      responsibleName: r.responsibleName,
      createdAt: formatDateTimeCO(r.createdAt),
      closedAt: formatDateTimeCO(r.closedAt),
      durationHours: r.durationHours ?? '—',
    }));

    return this.dispatchExport(
      res,
      format,
      'reporte-tiempos-resolucion',
      'Reporte de Tiempos de Resolución',
      RESOLUTION_TIME_COLUMNS,
      flat,
    );
  }

  // Único punto que decide qué generador usar según el formato pedido,
  // reutilizado por los 5 endpoints de exportación (evita duplicar el
  // if/else csv/pdf/excel en cada uno).
  private dispatchExport(
    res: Response,
    format: 'csv' | 'excel' | 'pdf',
    filename: string,
    title: string,
    columns: ExportColumn[],
    rows: any[],
  ) {
    if (format === 'csv') return this.exportService.exportCsv(res, filename, columns, rows);
    if (format === 'pdf') return this.exportService.exportPdf(res, title, filename, columns, rows);
    return this.exportService.exportExcel(res, filename, columns, rows);
  }
}
