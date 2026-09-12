import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CaseNumberService } from './case-number.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { toAuditJson } from '../../common/utils/audit-json.util';
import {
  AssignCaseDto,
  CaseQueryDto,
  ChangeStatusDto,
  CloseCaseDto,
  CreateCaseDto,
  ReopenCaseDto,
  UpdateCaseDto,
} from './dto/case.dto';

// Transiciones de estado permitidas (regla #8). Cualquier transición fuera
// de este mapa es rechazada explícitamente: el estado del caso nunca se
// puede "saltar" pasos por error de UI o manipulación del request.
const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  SIN_RESOLVER: [CaseStatus.EN_PROCESO, CaseStatus.ANULADO],
  EN_PROCESO: [CaseStatus.RESUELTO, CaseStatus.ANULADO],
  RESUELTO: [CaseStatus.REABIERTO],
  REABIERTO: [CaseStatus.EN_PROCESO, CaseStatus.RESUELTO],
  ANULADO: [],
};

const caseDetailInclude = {
  location: true,
  area: true,
  subtype: true,
  responsible: true,
  createdBy: { select: { id: true, fullName: true, email: true } },
  closedBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.CaseInclude;

@Injectable()
export class CasesService {
  constructor(
    private prisma: PrismaService,
    private caseNumber: CaseNumberService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateCaseDto) {
    return this.prisma.$transaction(async (tx) => {
      const caseNumber = await this.caseNumber.generate(tx, user.hotelId, dto.type);

      // Fecha/hora SIEMPRE del servidor (createdAt default now() en el
      // esquema); nunca se acepta una fecha enviada por el cliente (regla #7).
      const created = await tx.case.create({
        data: {
          hotelId: user.hotelId,
          caseNumber,
          type: dto.type,
          description: dto.description,
          locationId: dto.locationId,
          room: dto.room,
          areaId: dto.areaId,
          subtypeId: dto.subtypeId,
          responsibleId: dto.responsibleId,
          priority: dto.priority ?? 'MEDIA',
          status: CaseStatus.SIN_RESOLVER,
          createdById: user.userId,
        },
        include: caseDetailInclude,
      });

      await tx.caseHistory.create({
        data: {
          caseId: created.id,
          action: 'CREADO',
          toStatus: CaseStatus.SIN_RESOLVER,
          userId: user.userId,
          note: `Caso ${created.caseNumber} registrado`,
        },
      });

      await tx.caseAudit.create({
        data: {
          caseId: created.id,
          userId: user.userId,
          action: 'CREATE',
          newValues: { type: dto.type, priority: created.priority, locationId: dto.locationId },
        },
      });

      return created;
    });
  }

  async findAll(hotelId: string, query: CaseQueryDto) {
    const {
      page = 1,
      pageSize = 20,
      search,
      type,
      status,
      priority,
      areaId,
      locationId,
      responsibleId,
      subtypeId,
      room,
      from,
      to,
      sortBy = 'createdAt',
      sortDir = 'desc',
    } = query;

    const where: Prisma.CaseWhereInput = {
      hotelId,
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(areaId ? { areaId } : {}),
      ...(locationId ? { locationId } : {}),
      ...(responsibleId ? { responsibleId } : {}),
      ...(subtypeId ? { subtypeId } : {}),
      ...(room ? { room } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { caseNumber: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { createdBy: { fullName: { contains: search, mode: 'insensitive' } } },
              { responsible: { fullName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    // Paginación y ordenamiento resueltos en backend (regla #19), no en el
    // navegador: soporta correctamente miles/cientos de miles de registros.
    const allowedSort = ['createdAt', 'priority', 'status', 'caseNumber', 'closedAt'];
    const orderField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.case.findMany({
        where,
        include: caseDetailInclude,
        orderBy: { [orderField]: sortDir === 'asc' ? 'asc' : 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.case.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(hotelId: string, id: string) {
    const found = await this.prisma.case.findFirst({
      where: { id, hotelId },
      include: caseDetailInclude,
    });
    if (!found) throw new NotFoundException('Caso no encontrado');
    return found;
  }

  async getHistory(hotelId: string, caseId: string) {
    await this.findOne(hotelId, caseId); // valida existencia + pertenencia al hotel
    return this.prisma.caseHistory.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { fullName: true } } },
    });
  }

  async update(hotelId: string, id: string, dto: UpdateCaseDto, user: AuthenticatedUser) {
    const existing = await this.findOne(hotelId, id);
    this.assertNotResolvedUnlessPrivileged(existing.status, user, 'case:edit-resolved');

    const updated = await this.prisma.case.update({
      where: { id },
      data: {
        description: dto.description,
        locationId: dto.locationId,
        room: dto.room,
        subtypeId: dto.subtypeId,
        priority: dto.priority,
      },
      include: caseDetailInclude,
    });

    await this.prisma.caseAudit.create({
      data: {
        caseId: id,
        userId: user.userId,
        action: 'UPDATE',
        oldValues: {
          description: existing.description,
          locationId: existing.locationId,
          room: existing.room,
          subtypeId: existing.subtypeId,
          priority: existing.priority,
        },
        newValues: toAuditJson(dto),
      },
    });

    return updated;
  }

  async assign(hotelId: string, id: string, dto: AssignCaseDto, user: AuthenticatedUser) {
    const existing = await this.findOne(hotelId, id);
    this.assertNotResolvedUnlessPrivileged(existing.status, user, 'case:edit-resolved');

    return this.prisma.$transaction(async (tx) => {
      await tx.caseAssignment.create({
        data: {
          caseId: id,
          areaId: dto.areaId,
          responsibleId: dto.responsibleId,
          assignedById: user.userId,
        },
      });

      const updated = await tx.case.update({
        where: { id },
        data: { areaId: dto.areaId, responsibleId: dto.responsibleId },
        include: caseDetailInclude,
      });

      await tx.caseHistory.create({
        data: {
          caseId: id,
          action: 'ASIGNADO',
          userId: user.userId,
          note: `Asignado a área/responsable`,
        },
      });

      await tx.caseAudit.create({
        data: {
          caseId: id,
          userId: user.userId,
          action: 'ASSIGN',
          oldValues: { areaId: existing.areaId, responsibleId: existing.responsibleId },
          newValues: { areaId: dto.areaId, responsibleId: dto.responsibleId },
        },
      });

      await this.notifications.notifyResponsibleAssigned(tx, updated);

      return updated;
    });
  }

  async changeStatus(hotelId: string, id: string, dto: ChangeStatusDto, user: AuthenticatedUser) {
    const existing = await this.findOne(hotelId, id);
    this.validateTransition(existing.status, dto.status);

    // RESUELTO tiene su propio endpoint (close) que exige observación de
    // solución: no se permite llegar a RESUELTO por esta vía genérica.
    if (dto.status === CaseStatus.RESUELTO) {
      throw new BadRequestException('Usa el endpoint de cierre para marcar un caso como resuelto');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.case.update({
        where: { id },
        data: { status: dto.status },
        include: caseDetailInclude,
      });

      await tx.caseHistory.create({
        data: {
          caseId: id,
          action: 'CAMBIO_ESTADO',
          fromStatus: existing.status,
          toStatus: dto.status,
          userId: user.userId,
          note: dto.note,
        },
      });

      await tx.caseAudit.create({
        data: {
          caseId: id,
          userId: user.userId,
          action: 'STATUS_CHANGE',
          oldValues: { status: existing.status },
          newValues: { status: dto.status },
        },
      });

      if (dto.status === CaseStatus.EN_PROCESO) {
        await this.notifications.notifyStatusChanged(tx, updated, 'En proceso');
      }

      return updated;
    });
  }

  async close(hotelId: string, id: string, dto: CloseCaseDto, user: AuthenticatedUser) {
    const existing = await this.findOne(hotelId, id);
    this.validateTransition(existing.status, CaseStatus.RESUELTO);

    return this.prisma.$transaction(async (tx) => {
      const closedAt = new Date(); // fecha/hora de cierre generada por el servidor
      const updated = await tx.case.update({
        where: { id },
        data: {
          status: CaseStatus.RESUELTO,
          resolutionNote: dto.resolutionNote,
          closedAt,
          closedById: user.userId, // generado automáticamente, nunca enviado por el cliente
        },
        include: caseDetailInclude,
      });

      await tx.caseHistory.create({
        data: {
          caseId: id,
          action: 'RESUELTO',
          fromStatus: existing.status,
          toStatus: CaseStatus.RESUELTO,
          userId: user.userId,
          note: dto.resolutionNote,
        },
      });

      await tx.caseAudit.create({
        data: {
          caseId: id,
          userId: user.userId,
          action: 'CLOSE',
          oldValues: { status: existing.status },
          newValues: { status: CaseStatus.RESUELTO, resolutionNote: dto.resolutionNote },
        },
      });

      await this.notifications.notifyStatusChanged(tx, updated, 'Resuelto');

      return updated;
    });
  }

  async reopen(hotelId: string, id: string, dto: ReopenCaseDto, user: AuthenticatedUser) {
    // Reapertura es una excepción controlada por permisos (regla #8): solo
    // ADMINISTRADOR o SUPERVISOR pueden reabrir, y siempre queda auditado.
    if (!user.permissions.includes('case:reopen')) {
      throw new ForbiddenException('No tienes permisos para reabrir casos');
    }

    const existing = await this.findOne(hotelId, id);
    this.validateTransition(existing.status, CaseStatus.REABIERTO);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.case.update({
        where: { id },
        data: { status: CaseStatus.REABIERTO },
        include: caseDetailInclude,
      });

      await tx.caseHistory.create({
        data: {
          caseId: id,
          action: 'REABIERTO',
          fromStatus: existing.status,
          toStatus: CaseStatus.REABIERTO,
          userId: user.userId,
          note: dto.reason,
        },
      });

      await tx.caseAudit.create({
        data: {
          caseId: id,
          userId: user.userId,
          action: 'REOPEN',
          oldValues: { status: existing.status },
          newValues: { status: CaseStatus.REABIERTO, reason: dto.reason },
        },
      });

      return updated;
    });
  }

  private validateTransition(from: CaseStatus, to: CaseStatus) {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `No es posible cambiar el estado de ${from} a ${to}`,
      );
    }
  }

  private assertNotResolvedUnlessPrivileged(
    status: CaseStatus,
    user: AuthenticatedUser,
    permission: string,
  ) {
    const isLocked = status === CaseStatus.RESUELTO || status === CaseStatus.ANULADO;
    if (isLocked && !user.permissions.includes(permission)) {
      throw new ForbiddenException(
        'Un caso resuelto o anulado no puede modificarse sin permisos especiales',
      );
    }
  }
}
