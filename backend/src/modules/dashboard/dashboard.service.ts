import { Injectable } from '@nestjs/common';
import { CaseStatus, CaseType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveDateRange } from '../../common/utils/date-range.util';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

// Ningún número en este servicio está hardcodeado (regla #15/#17): todo se
// calcula contra PostgreSQL en el momento de la petición, respetando los
// filtros activos del dashboard.
@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private buildWhere(hotelId: string, query: DashboardQueryDto): Prisma.CaseWhereInput {
    const dateRange = resolveDateRange(query.range, query.from, query.to);
    return {
      hotelId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.areaId ? { areaId: query.areaId } : {}),
      ...(query.responsibleId ? { responsibleId: query.responsibleId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(Object.keys(dateRange).length ? { createdAt: dateRange } : {}),
    };
  }

  async summary(hotelId: string, query: DashboardQueryDto) {
    const where = this.buildWhere(hotelId, query);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      total,
      totalQuejas,
      totalSolicitudes,
      sinResolver,
      enProceso,
      resueltos,
      criticos,
      delDia,
      delaSemana,
      delMes,
    ] = await this.prisma.$transaction([
      this.prisma.case.count({ where }),
      this.prisma.case.count({ where: { ...where, type: CaseType.QUEJA } }),
      this.prisma.case.count({ where: { ...where, type: CaseType.SOLICITUD } }),
      this.prisma.case.count({ where: { ...where, status: CaseStatus.SIN_RESOLVER } }),
      this.prisma.case.count({ where: { ...where, status: CaseStatus.EN_PROCESO } }),
      this.prisma.case.count({ where: { ...where, status: CaseStatus.RESUELTO } }),
      this.prisma.case.count({ where: { ...where, priority: 'CRITICA' } }),
      this.prisma.case.count({ where: { ...where, createdAt: { gte: startOfToday } } }),
      this.prisma.case.count({ where: { ...where, createdAt: { gte: startOfWeek } } }),
      this.prisma.case.count({ where: { ...where, createdAt: { gte: startOfMonth } } }),
    ]);

    const resolutionRate = total > 0 ? Number(((resueltos / total) * 100).toFixed(1)) : 0;

    const avgResolution = await this.prisma.$queryRaw<{ avg_hours: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM ("closedAt" - "createdAt")) / 3600) as avg_hours
      FROM cases
      WHERE "hotelId" = ${hotelId} AND "closedAt" IS NOT NULL
      ${query.type ? Prisma.sql`AND "type" = ${query.type}::"CaseType"` : Prisma.empty}
    `;

    return {
      totalCasos: total,
      totalQuejas,
      totalSolicitudes,
      sinResolver,
      enProceso,
      resueltos,
      pendientes: sinResolver + enProceso,
      criticos,
      delDia,
      delaSemana,
      delMes,
      porcentajeResolucion: resolutionRate,
      tiempoPromedioResolucionHoras: avgResolution[0]?.avg_hours
        ? Number(avgResolution[0].avg_hours.toFixed(1))
        : null,
    };
  }

  async charts(hotelId: string, query: DashboardQueryDto) {
    const where = this.buildWhere(hotelId, query);

    const [byStatus, byType, byArea, byLocation, byAreaTimes, byRoom, bySubtype] = await Promise.all([
      this.prisma.case.groupBy({ by: ['status'], where, _count: true }),
      this.prisma.case.groupBy({ by: ['type'], where, _count: true }),
      this.prisma.case.groupBy({ by: ['areaId'], where, _count: true }),
      this.prisma.case.groupBy({ by: ['locationId'], where, _count: true }),
      this.prisma.$queryRaw<{ area_name: string; avg_hours: number | null }[]>`
        SELECT a.name as area_name,
               AVG(EXTRACT(EPOCH FROM (c."closedAt" - c."createdAt")) / 3600) as avg_hours
        FROM cases c
        JOIN areas a ON a.id = c."areaId"
        WHERE c."hotelId" = ${hotelId} AND c."closedAt" IS NOT NULL
        GROUP BY a.name
        ORDER BY a.name
      `,
      // Solo casos que sí tienen habitación (torres); el resto de
      // ubicaciones no aplican y quedarían como un bucket "null" sin valor.
      this.prisma.case.groupBy({
        by: ['room'],
        where: { ...where, room: { not: null } },
        _count: true,
        orderBy: { room: 'asc' },
      }),
      this.prisma.case.groupBy({
        by: ['subtypeId'],
        where: { ...where, subtypeId: { not: null } },
        _count: true,
      }),
    ]);

    const evolution = await this.prisma.$queryRaw<{ day: string; total: number }[]>`
      SELECT to_char("createdAt", 'YYYY-MM-DD') as day, COUNT(*)::int as total
      FROM cases
      WHERE "hotelId" = ${hotelId}
      GROUP BY day
      ORDER BY day ASC
      LIMIT 60
    `;

    const areaNames = await this.prisma.area.findMany({ where: { hotelId } });
    const locationNames = await this.prisma.location.findMany({ where: { hotelId } });
    const subtypeNames = await this.prisma.caseSubtype.findMany({ where: { area: { hotelId } } });
    const areaMap = new Map(areaNames.map((a) => [a.id, a.name]));
    const locationMap = new Map(locationNames.map((l) => [l.id, l.name]));
    const subtypeMap = new Map(subtypeNames.map((s) => [s.id, s.name]));

    return {
      casosPorEstado: byStatus.map((r) => ({ label: r.status, value: r._count, id: r.status })),
      quejasVsSolicitudes: byType.map((r) => ({ label: r.type, value: r._count, id: r.type })),
      casosPorArea: byArea.map((r) => ({
        label: r.areaId ? areaMap.get(r.areaId) ?? 'Sin área' : 'Sin área',
        value: r._count,
        id: r.areaId,
      })),
      casosPorUbicacion: byLocation.map((r) => ({
        label: locationMap.get(r.locationId) ?? 'Desconocida',
        value: r._count,
        id: r.locationId,
      })),
      evolucionCasos: evolution.map((r) => ({ label: r.day, value: r.total })),
      tiempoPromedioResolucionPorArea: byAreaTimes.map((r) => ({
        label: r.area_name,
        value: r.avg_hours ? Number(r.avg_hours.toFixed(1)) : 0,
      })),
      casosPorHabitacion: byRoom.map((r) => ({ label: r.room ?? '—', value: r._count, id: r.room ?? undefined })),
      casosPorTipoQueja: bySubtype.map((r) => ({
        label: r.subtypeId ? subtypeMap.get(r.subtypeId) ?? 'Otro' : 'Otro',
        value: r._count,
        id: r.subtypeId ?? undefined,
      })),
    };
  }
}
