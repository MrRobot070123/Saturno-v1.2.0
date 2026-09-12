import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CaseQueryDto } from '../cases/dto/case.dto';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private buildWhere(hotelId: string, query: CaseQueryDto): Prisma.CaseWhereInput {
    return {
      hotelId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.areaId ? { areaId: query.areaId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.responsibleId ? { responsibleId: query.responsibleId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
  }

  // Reporte general: todos los casos según filtros.
  async general(hotelId: string, query: CaseQueryDto) {
    const where = this.buildWhere(hotelId, query);
    return this.prisma.case.findMany({
      where,
      include: {
        location: true,
        area: true,
        responsible: true,
        createdBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Reporte de pendientes: SIN_RESOLVER + EN_PROCESO.
  async pending(hotelId: string, query: CaseQueryDto) {
    const where = this.buildWhere(hotelId, query);
    return this.prisma.case.findMany({
      where: { ...where, status: { in: ['SIN_RESOLVER', 'EN_PROCESO'] } },
      include: { location: true, area: true, responsible: true },
      orderBy: { priority: 'desc' },
    });
  }

  // Reporte por área: total, resueltos, pendientes, tiempo promedio.
  async byArea(hotelId: string) {
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
      LEFT JOIN cases c ON c."areaId" = a.id AND c."hotelId" = ${hotelId}
      WHERE a."hotelId" = ${hotelId}
      GROUP BY a.name
      ORDER BY a.name
    `;
  }

  // Reporte por responsable: asignados, resueltos, pendientes, tiempo promedio.
  async byResponsible(hotelId: string) {
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
      LEFT JOIN cases c ON c."responsibleId" = r.id
      WHERE a."hotelId" = ${hotelId}
      GROUP BY r."fullName"
      ORDER BY r."fullName"
    `;
  }

  // Reporte de tiempos: caso, creación, cierre, duración.
  async resolutionTimes(hotelId: string, query: CaseQueryDto) {
    const where = this.buildWhere(hotelId, query);
    const cases = await this.prisma.case.findMany({
      where: { ...where, closedAt: { not: null } },
      select: { caseNumber: true, createdAt: true, closedAt: true, type: true },
      orderBy: { closedAt: 'desc' },
    });

    return cases.map((c) => ({
      caseNumber: c.caseNumber,
      type: c.type,
      createdAt: c.createdAt,
      closedAt: c.closedAt,
      durationHours: c.closedAt
        ? Number(((c.closedAt.getTime() - c.createdAt.getTime()) / 3_600_000).toFixed(1))
        : null,
    }));
  }
}
