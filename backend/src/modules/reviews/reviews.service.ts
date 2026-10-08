import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AddFindingDto, CreateReviewDto, ReviewQueryDto } from './dto/review.dto';

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
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async findAll(hotelId: string, query: ReviewQueryDto) {
    const where = {
      hotelId,
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.platformId ? { platformId: query.platformId } : {}),
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

    return review;
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
}