import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportQueryDto } from './dto/export-query.dto';

// Límites de protección (consumo de memoria/CPU del backend):
// - Vista previa en pantalla: máximo 300 filas. El frontend avisa si se llega al tope.
// - Exportación: máximo 5.000 filas. Si el filtro devuelve más, se rechaza con un
//   mensaje claro en vez de cargar todo en memoria (Excel/PDF se arman en RAM).
// - Rango de fechas: máximo 366 días.
export const REPORT_PREVIEW_LIMIT = 300;
export const REPORT_EXPORT_LIMIT = 5000;
const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

type ReportMode = 'preview' | 'export';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // Valida el rango recibido y lo convierte a Date.
  private parseRange(query: ReportQueryDto): { from: Date; to: Date } {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('El rango de fechas no es válido.');
    }
    if (from > to) {
      throw new BadRequestException('La fecha inicial no puede ser posterior a la final.');
    }
    if ((to.getTime() - from.getTime()) / DAY_MS > MAX_RANGE_DAYS) {
      throw new BadRequestException(`El rango máximo permitido es de ${MAX_RANGE_DAYS} días.`);
    }
    return { from, to };
  }

  private buildWhere(hotelId: string, query: ReportQueryDto): Prisma.CaseWhereInput {
    const { from, to } = this.parseRange(query);
    return {
      hotelId,
      createdAt: { gte: from, lte: to },
      ...(query.areaId ? { areaId: query.areaId } : {}),
      ...(query.responsibleId ? { responsibleId: query.responsibleId } : {}),
    };
  }

  // Ejecuta la consulta con tope de filas según el modo. En exportación pide
  // una fila de más para detectar que se superó el límite.
  private async fetchLimited<T>(mode: ReportMode, run: (take: number) => Promise<T[]>): Promise<T[]> {
    if (mode === 'preview') {
      return run(REPORT_PREVIEW_LIMIT);
    }
    const rows = await run(REPORT_EXPORT_LIMIT + 1);
    if (rows.length > REPORT_EXPORT_LIMIT) {
      throw new BadRequestException(
        `El reporte supera los ${REPORT_EXPORT_LIMIT} casos. Acota el rango de fechas o filtra por área o responsable.`,
      );
    }
    return rows;
  }

  // Reporte general: casos del rango, con filtros opcionales de área/responsable.
  // Incluye quién creó el caso y a quién está asignado (regla del reporte general
  // completo: campos "Creado por" / "Asignado a" en la exportación).
  async general(hotelId: string, query: ReportQueryDto, mode: ReportMode = 'preview') {
    const where = this.buildWhere(hotelId, query);
    return this.fetchLimited(mode, (take) =>
      this.prisma.case.findMany({
        where,
        take,
        include: {
          location: true,
          area: true,
          responsible: true,
          createdBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  // Reporte de pendientes: SIN_RESOLVER + EN_PROCESO dentro del rango.
  async pending(hotelId: string, query: ReportQueryDto, mode: ReportMode = 'preview') {
    const where = this.buildWhere(hotelId, query);
    return this.fetchLimited(mode, (take) =>
      this.prisma.case.findMany({
        where: { ...where, status: { in: ['SIN_RESOLVER', 'EN_PROCESO'] } },
        take,
        include: {
          location: true,
          area: true,
          responsible: true,
          createdBy: { select: { fullName: true } },
        },
        orderBy: { priority: 'desc' },
      }),
    );
  }

  // Reporte por área: total, resueltos, pendientes y tiempo promedio,
  // contando solo los casos creados dentro del rango.
  async byArea(hotelId: string, query: ReportQueryDto) {
    const { from, to } = this.parseRange(query);
    const areaFilter = query.areaId ? Prisma.sql`AND a.id = ${query.areaId}` : Prisma.empty;

    return this.prisma.$queryRaw<
      { area_name: string; total: number; resueltos: number; pendientes: number; avg_hours: number | null }[]
    >`
      SELECT
        a.name as area_name,
        COUNT(c.id)::int as total,
        COUNT(c.id) FILTER (WHERE c.status = 'RESUELTO')::int as resueltos,
        COUNT(c.id) FILTER (WHERE c.status IN ('SIN_RESOLVER', 'EN_PROCESO'))::int as pendientes,
        AVG(EXTRACT(EPOCH FROM (c."closedAt" - c."createdAt")) / 3600) FILTER (WHERE c."closedAt" IS NOT NULL) as avg_hours
      FROM areas a
      LEFT JOIN cases c
        ON c."areaId" = a.id
       AND c."hotelId" = ${hotelId}
       AND c."createdAt" >= ${from}
       AND c."createdAt" <= ${to}
      WHERE a."hotelId" = ${hotelId}
      ${areaFilter}
      GROUP BY a.name
      ORDER BY a.name
    `;
  }

  // Reporte por responsable: asignados, resueltos, pendientes y tiempo
  // promedio dentro del rango, con filtro opcional por área y/o persona.
  // Se agrupa por r.id (además del nombre) para que dos responsables con el
  // mismo nombre en áreas distintas no se mezclen en una sola fila.
  async byResponsible(hotelId: string, query: ReportQueryDto) {
    const { from, to } = this.parseRange(query);
    const areaFilter = query.areaId ? Prisma.sql`AND r."areaId" = ${query.areaId}` : Prisma.empty;
    const responsibleFilter = query.responsibleId ? Prisma.sql`AND r.id = ${query.responsibleId}` : Prisma.empty;

    return this.prisma.$queryRaw<
      { responsible_name: string; total: number; resueltos: number; pendientes: number; avg_hours: number | null }[]
    >`
      SELECT
        r."fullName" as responsible_name,
        COUNT(c.id)::int as total,
        COUNT(c.id) FILTER (WHERE c.status = 'RESUELTO')::int as resueltos,
        COUNT(c.id) FILTER (WHERE c.status IN ('SIN_RESOLVER', 'EN_PROCESO'))::int as pendientes,
        AVG(EXTRACT(EPOCH FROM (c."closedAt" - c."createdAt")) / 3600) FILTER (WHERE c."closedAt" IS NOT NULL) as avg_hours
      FROM responsibles r
      JOIN areas a ON a.id = r."areaId"
      LEFT JOIN cases c
        ON c."responsibleId" = r.id
       AND c."createdAt" >= ${from}
       AND c."createdAt" <= ${to}
      WHERE a."hotelId" = ${hotelId}
      ${areaFilter}
      ${responsibleFilter}
      GROUP BY r.id, r."fullName"
      ORDER BY r."fullName"
    `;
  }

  // Reporte de tiempos: caso, creación, cierre y duración, para los casos
  // creados dentro del rango que ya están cerrados. Incluye "Creado por" y
  // "Asignado a" igual que los otros reportes de detalle.
  async resolutionTimes(hotelId: string, query: ReportQueryDto, mode: ReportMode = 'preview') {
    const where = this.buildWhere(hotelId, query);
    const cases = await this.fetchLimited(mode, (take) =>
      this.prisma.case.findMany({
        where: { ...where, closedAt: { not: null } },
        take,
        select: {
          caseNumber: true,
          createdAt: true,
          closedAt: true,
          type: true,
          createdBy: { select: { fullName: true } },
          responsible: { select: { fullName: true } },
        },
        orderBy: { closedAt: 'desc' },
      }),
    );

    return cases.map((c) => ({
      caseNumber: c.caseNumber,
      type: c.type,
      createdAt: c.createdAt,
      closedAt: c.closedAt,
      createdByName: c.createdBy?.fullName ?? '',
      responsibleName: c.responsible?.fullName ?? 'Sin asignar',
      durationHours: c.closedAt
        ? Number(((c.closedAt.getTime() - c.createdAt.getTime()) / 3_600_000).toFixed(1))
        : null,
    }));
  }
}
