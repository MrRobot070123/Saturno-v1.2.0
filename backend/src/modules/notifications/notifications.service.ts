import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Notificaciones internas (regla #25). El canal por defecto es IN_APP;
// el enum NotificationChannel ya contempla EMAIL/TEAMS/WHATSAPP para que,
// en el futuro, un "NotificationDispatcher" pueda enviar por esos canales
// sin cambiar el modelo de datos ni los puntos donde se generan los eventos.
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async notifyResponsibleAssigned(tx: Prisma.TransactionClient, updatedCase: any) {
    if (!updatedCase.responsible?.userId) return;
    await tx.notification.create({
      data: {
        userId: updatedCase.responsible.userId,
        caseId: updatedCase.id,
        title: 'Nuevo caso asignado',
        message: `Se te asignó el caso ${updatedCase.caseNumber}`,
      },
    });
  }

  async notifyStatusChanged(tx: Prisma.TransactionClient, updatedCase: any, statusLabel: string) {
    if (!updatedCase.createdById) return;
    await tx.notification.create({
      data: {
        userId: updatedCase.createdById,
        caseId: updatedCase.id,
        title: `Caso ${statusLabel.toLowerCase()}`,
        message: `El caso ${updatedCase.caseNumber} cambió a estado ${statusLabel}`,
      },
    });

    if (updatedCase.priority === 'CRITICA') {
      // En una integración real, aquí se dispararía también el canal EMAIL/TEAMS.
      await tx.notification.create({
        data: {
          userId: updatedCase.createdById,
          caseId: updatedCase.id,
          title: 'Caso crítico',
          message: `El caso crítico ${updatedCase.caseNumber} requiere atención`,
        },
      });
    }
  }

  async findForUser(userId: string, onlyUnread = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(onlyUnread ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
