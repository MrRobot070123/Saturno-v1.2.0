import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReviewClassifierService } from './review-classifier.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AddFindingDto, ApproveFindingDto, CreateReviewDto, ReviewQueryDto } from './dto/review.dto';

const REVIEW_INCLUDE = {
  location: { select: { id: true, name: true } },
  platform: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
  findings: {
    include: {
      area: { select: { id: true, name: true } },
      subtype: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, fullName: true } },
      generatedCase: { select: { id: true, caseNumber: true } },
    },
  },
} as const;

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private classifier: ReviewClassifierService,
  ) {}

  async findAll(hotelId: string, query: ReviewQueryDto) {
    const where = {
      hotelId,
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.platformId ? { platformId: query.platformId } : {}),
      ...(query.areaId ? { findings: { some: { areaId: query.areaId } } } : {}),
      ...(query.from || query.to
        ? {
            stayDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { guestName: { contains: query.search, mode: 'insensitive' as const } },
              { rawText: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { stayDate: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(hotelId: string, id: string) {
    const review = await this.prisma.review.findFirst({
      where: { id, hotelId },
      include: REVIEW_INCLUDE,
    });
    if (!review) throw new NotFoundException('Reseña no encontrada');
    return review;
  }

  async create(user: AuthenticatedUser, dto: CreateReviewDto) {
    // Los subtipos manuales deben existir y pertenecer al hotel del usuario
    // (misma validación de integridad que ya aplica Cases al asignar área).
    const subtypeIds = (dto.findings ?? []).map((f) => f.subtypeId);
    const subtypes = subtypeIds.length
      ? await this.prisma.caseSubtype.findMany({
          where: { id: { in: subtypeIds }, area: { hotelId: user.hotelId } },
        })
      : [];
    if (subtypes.length !== subtypeIds.length) {
      throw new NotFoundException('Uno o más tipos de queja indicados no existen');
    }
    const subtypeById = new Map(subtypes.map((s) => [s.id, s]));

    const review = await this.prisma.review.create({
      data: {
        hotelId: user.hotelId,
        stayDate: new Date(dto.stayDate),
        locationId: dto.locationId,
        room: dto.room,
        guestName: dto.guestName,
        platformId: dto.platformId,
        rawText: dto.rawText,
        createdById: user.userId,
        findings: dto.findings?.length
          ? {
              create: dto.findings.map((f) => ({
                excerpt: f.excerpt,
                subtypeId: f.subtypeId,
                areaId: subtypeById.get(f.subtypeId)!.areaId,
                confidence: 1,
                status: 'MATCHED',
                reviewedById: user.userId,
                reviewedAt: new Date(),
              })),
            }
          : undefined,
      },
      include: REVIEW_INCLUDE,
    });

    await this.audit.log({
      userId: user.userId,
      action: 'REVIEW_CREATE',
      entity: 'Review',
      entityId: review.id,
      newValues: { guestName: review.guestName, platformId: review.platformId },
    });

    // Fase B: si no se cargaron hallazgos manuales, se dispara la
    // clasificación automática con IA en el mismo request (bajo volumen de
    // reseñas digitadas manualmente, no amerita una cola en segundo plano).
    // Si falla (sin API key, red, etc.) NO se revierte la creación de la
    // reseña: queda guardada con aiError para poder diagnosticar/reintentar.
    if (!dto.findings?.length) {
      await this.runAiClassification(user.hotelId, review.id, dto.rawText);
      return this.findOne(user.hotelId, review.id);
    }

    return review;
  }

  private async runAiClassification(hotelId: string, reviewId: string, rawText: string) {
    try {
      const findings = await this.classifier.classify(hotelId, rawText);

      for (const f of findings) {
        const status = f.subtypeId ? 'MATCHED' : 'PENDING_APPROVAL';
        const finding = await this.prisma.reviewFinding.create({
          data: {
            reviewId,
            excerpt: f.excerpt,
            areaId: f.areaId ?? null,
            subtypeId: f.subtypeId ?? null,
            suggestedName: f.suggestedName ?? null,
            suggestedArea: f.suggestedArea ?? null,
            confidence: f.confidence,
            status,
          },
        });

        if (status === 'PENDING_APPROVAL') {
          await this.notifications.notifyPendingClassification(hotelId, finding, rawText);
        }
      }

      await this.prisma.review.update({
        where: { id: reviewId },
        data: { aiProcessedAt: new Date(), aiError: null },
      });
    } catch (err: any) {
      this.logger.error(`Clasificación IA falló para la reseña ${reviewId}: ${err?.message ?? err}`);
      await this.prisma.review.update({
        where: { id: reviewId },
        data: { aiError: String(err?.message ?? 'Error desconocido').slice(0, 500) },
      });
    }
  }

  async addFinding(hotelId: string, reviewId: string, dto: AddFindingDto, user: AuthenticatedUser) {
    const review = await this.prisma.review.findFirst({ where: { id: reviewId, hotelId } });
    if (!review) throw new NotFoundException('Reseña no encontrada');

    const subtype = await this.prisma.caseSubtype.findFirst({
      where: { id: dto.subtypeId, area: { hotelId } },
    });
    if (!subtype) throw new NotFoundException('Tipo de queja no encontrado');

    const finding = await this.prisma.reviewFinding.create({
      data: {
        reviewId,
        excerpt: dto.excerpt,
        subtypeId: subtype.id,
        areaId: subtype.areaId,
        confidence: 1,
        status: 'MATCHED',
        reviewedById: user.userId,
        reviewedAt: new Date(),
      },
    });

    await this.audit.log({
      userId: user.userId,
      action: 'REVIEW_FINDING_ADD',
      entity: 'ReviewFinding',
      entityId: finding.id,
      newValues: { reviewId, subtypeId: subtype.id },
    });

    return finding;
  }

  // ---------- Fase B: aprobación de hallazgos propuestos por la IA ----------

  findPendingFindings(hotelId: string) {
    return this.prisma.reviewFinding.findMany({
      where: { status: 'PENDING_APPROVAL', review: { hotelId } },
      include: {
        review: {
          select: {
            id: true,
            guestName: true,
            stayDate: true,
            platform: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveFinding(hotelId: string, findingId: string, dto: ApproveFindingDto, user: AuthenticatedUser) {
    const finding = await this.prisma.reviewFinding.findFirst({
      where: { id: findingId, review: { hotelId } },
    });
    if (!finding) throw new NotFoundException('Hallazgo no encontrado');
    if (finding.status !== 'PENDING_APPROVAL') {
      throw new ConflictException('Este hallazgo ya fue revisado');
    }

    let subtypeId: string;
    let areaId: string;

    if (dto.subtypeId) {
      // Opción A: vincular a un tipo de queja que ya existe.
      const subtype = await this.prisma.caseSubtype.findFirst({
        where: { id: dto.subtypeId, area: { hotelId } },
      });
      if (!subtype) throw new NotFoundException('Tipo de queja no encontrado');
      subtypeId = subtype.id;
      areaId = subtype.areaId;
    } else if (dto.areaId && dto.name) {
      // Opción B: crear el tipo de queja nuevo que la IA propuso.
      const area = await this.prisma.area.findFirst({ where: { id: dto.areaId, hotelId } });
      if (!area) throw new NotFoundException('Área no encontrada');

      const existing = await this.prisma.caseSubtype.findFirst({
        where: { areaId: dto.areaId, type: 'QUEJA', name: dto.name },
      });
      const subtype =
        existing ??
        (await this.prisma.caseSubtype.create({
          data: { areaId: dto.areaId, type: 'QUEJA', name: dto.name },
        }));
      subtypeId = subtype.id;
      areaId = area.id;
    } else {
      throw new BadRequestException(
        'Indica un subtypeId existente, o areaId + name para crear un tipo de queja nuevo',
      );
    }

    const updated = await this.prisma.reviewFinding.update({
      where: { id: findingId },
      data: {
        subtypeId,
        areaId,
        status: 'APPROVED',
        reviewedById: user.userId,
        reviewedAt: new Date(),
      },
      include: {
        area: { select: { id: true, name: true } },
        subtype: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      userId: user.userId,
      action: 'REVIEW_FINDING_APPROVE',
      entity: 'ReviewFinding',
      entityId: findingId,
      newValues: { subtypeId, areaId },
    });

    return updated;
  }

  async rejectFinding(hotelId: string, findingId: string, user: AuthenticatedUser) {
    const finding = await this.prisma.reviewFinding.findFirst({
      where: { id: findingId, review: { hotelId } },
    });
    if (!finding) throw new NotFoundException('Hallazgo no encontrado');
    if (finding.status !== 'PENDING_APPROVAL') {
      throw new ConflictException('Este hallazgo ya fue revisado');
    }

    const updated = await this.prisma.reviewFinding.update({
      where: { id: findingId },
      data: { status: 'REJECTED', reviewedById: user.userId, reviewedAt: new Date() },
    });

    await this.audit.log({
      userId: user.userId,
      action: 'REVIEW_FINDING_REJECT',
      entity: 'ReviewFinding',
      entityId: findingId,
    });

    return updated;
  }
}