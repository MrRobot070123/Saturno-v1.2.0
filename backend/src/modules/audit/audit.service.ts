import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntryInput {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValues?: Prisma.InputJsonValue | null;
  newValues?: Prisma.InputJsonValue | null;
  ip?: string | null;
}

// Único punto de escritura de auditoría general del sistema. No expone
// ningún método de update/delete: por diseño la tabla es append-only.
// Ningún rol -incluido ADMINISTRADOR- puede modificarla desde la API
// (regla #11 del proyecto).
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(entry: AuditEntryInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        oldValues: entry.oldValues ?? undefined,
        newValues: entry.newValues ?? undefined,
        ip: entry.ip ?? null,
      },
    });
  }

  async findAll(params: {
    page: number;
    pageSize: number;
    entity?: string;
    action?: string;
    userId?: string;
    from?: Date;
    to?: Date;
  }) {
    const { page, pageSize, entity, action, userId, from, to } = params;
    const where = {
      ...(entity ? { entity } : {}),
      ...(action ? { action } : {}),
      ...(userId ? { userId } : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { fullName: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}
