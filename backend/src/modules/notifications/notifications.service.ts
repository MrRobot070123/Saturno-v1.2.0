import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Notificaciones internas (regla #25). El canal por defecto es IN_APP;
// el enum NotificationChannel ya contempla EMAIL/TEAMS/WHATSAPP para que,
// en el futuro, un "NotificationDispatcher" pueda enviar por esos canales
// sin cambiar el modelo de datos ni los puntos donde se generan los eventos.
//
// Fase B agrega el botón "Enviar por WhatsApp" (vía gratuita wa.me, sin
// costo ni API de pago): cuando hay un teléfono de contacto disponible para
// la notificación, se guarda el enlace ya armado en `whatsappPhone` y el
// frontend pinta el botón; si no hay teléfono, la notificación queda igual,
// solo sin ese botón.
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // Arma el número en el formato que espera wa.me: solo dígitos, con
  // código de país, sin "+", espacios ni guiones.
  private normalizePhone(phone: string | null | undefined): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 8 ? digits : null;
  }


  // Sin emojis a propósito: son caracteres multibyte que se corrompen fácil
  // (se ven como "�") si el archivo se guarda con una codificación distinta
  // a UTF-8, algo común al editar en Windows.
  private buildCaseTicketText(updatedCase: any): string {
    return [
      `*Caso ${updatedCase.caseNumber}*`,
      `${updatedCase.location?.name ?? 'Ubicación sin definir'}${updatedCase.room ? ' · Hab. ' + updatedCase.room : ''}`,
      `${updatedCase.area?.name ?? 'Área sin definir'} · ${updatedCase.subtype?.name ?? 'Tipo sin definir'}`,
      `Prioridad: ${updatedCase.priority}`,
      '',
      updatedCase.description,
      '',
      `Asignado a: ${updatedCase.responsible.fullName}`,
    ].join('\n');
  }

  // Fase B (corrección): el botón de WhatsApp tiene sentido para quien hace
  // la asignación (recepción/administración, que "siempre tiene el sistema
  // abierto" — diseno-modulo-resenas-v2.1.0.md §4B), no para el responsable
  // mismo — avisarle a él con un enlace a SU PROPIO número no servía de nada.
  // Ahora:
  //  1) si el responsable también es un usuario del sistema, se le notifica
  //     ahí dentro (sin botón de WhatsApp: ya está adentro);
  //  2) a quien hizo la asignación se le notifica con el botón de WhatsApp
  //     apuntando al teléfono del responsable, exista o no como usuario, para
  //     que pueda avisarle de una vez con un clic.
  async notifyResponsibleAssigned(tx: Prisma.TransactionClient, updatedCase: any, assignedByUserId: string) {
    if (!updatedCase.responsible) return;

    if (updatedCase.responsible.userId) {
      await tx.notification.create({
        data: {
          userId: updatedCase.responsible.userId,
          caseId: updatedCase.id,
          title: 'Nuevo caso asignado',
          message: `Se te asignó el caso ${updatedCase.caseNumber}`,
        },
      });
    }

    if (assignedByUserId !== updatedCase.responsible.userId) {
      await tx.notification.create({
        data: {
          userId: assignedByUserId,
          caseId: updatedCase.id,
          title: 'Caso asignado',
          // El mensaje ya trae su propio encabezado (🎫 Caso ...), así que
          // sirve tanto para mostrarse en la campanita como para enviarse
          // tal cual por WhatsApp sin repetir el título.
          message: this.buildCaseTicketText(updatedCase),
          whatsappPhone: this.normalizePhone(updatedCase.responsible.phone),
        },
      });
    }
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

  // Fase B: la IA propuso un tipo de queja nuevo para un hallazgo de reseña
  // (status PENDING_APPROVAL). Se notifica a todos los usuarios del hotel
  // que tienen el permiso review:classification-approve (hoy, ADMINISTRADOR).
  // Si el área quedó resuelta y tiene un responsable con teléfono, se arma
  // también el enlace de WhatsApp para avisarle de una vez.
  async notifyPendingClassification(hotelId: string, finding: { id: string; excerpt: string; areaId: string | null; suggestedArea: string | null; suggestedName: string | null }, reviewText: string) {
    const approvers = await this.prisma.user.findMany({
      where: {
        hotelId,
        isActive: true,
        roles: {
          some: { role: { rolePermissions: { some: { permission: { code: 'review:classification-approve' } } } } },
        },
      },
      select: { id: true },
    });
    if (approvers.length === 0) return;

    let whatsappPhone: string | null = null;
    let areaIdForPhone = finding.areaId;
    if (!areaIdForPhone && finding.suggestedArea) {
      // La IA pudo no haber hecho match exacto de string contra un área que
      // sí existe (mayúsculas, acentos o espacios distintos); antes de
      // resignarse a no avisar por WhatsApp, se reintenta sin distinguir
      // mayúsculas ni espacios en los extremos.
      const fallbackArea = await this.prisma.area.findFirst({
        where: { hotelId, isActive: true, name: { equals: finding.suggestedArea.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      areaIdForPhone = fallbackArea?.id ?? null;
    }
    if (areaIdForPhone) {
      const responsible = await this.prisma.responsible.findFirst({
        where: { areaId: areaIdForPhone, isActive: true, phone: { not: null } },
        orderBy: { createdAt: 'asc' },
      });
      whatsappPhone = this.normalizePhone(responsible?.phone);
    }

    const areaLabel = finding.suggestedArea ?? 'un área por definir';
    const title = 'Nuevo tipo de queja sugerido por IA';
    const message = [
      '*Nuevo tipo de queja detectado por IA*',
      areaLabel,
      finding.suggestedName ?? 'Hallazgo sin clasificar aún',
      '',
      'Revisa y aprueba o rechaza desde Reseñas → Aprobaciones.',
    ].join('\n');

    await this.prisma.notification.createMany({
      data: approvers.map((a) => ({
        userId: a.id,
        title,
        message,
        whatsappPhone,
      })),
    });
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