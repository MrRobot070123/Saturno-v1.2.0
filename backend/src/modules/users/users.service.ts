import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { toAuditJson } from '../../common/utils/audit-json.util';
import { CreateUserDto, PaginationQueryDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private readonly userListSelect = {
    id: true,
    fullName: true,
    email: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    area: { select: { id: true, name: true } },
    roles: { select: { role: { select: { name: true } } } },
  };

  async findAll(hotelId: string, query: PaginationQueryDto) {
    const { page = 1, pageSize = 20, search } = query;
    const where = {
      hotelId,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: this.userListSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(hotelId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, hotelId },
      select: this.userListSelect,
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async create(hotelId: string, dto: CreateUserDto, actingUserId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Ya existe un usuario con ese correo');

    const passwordHash = await argon2.hash(dto.password);
    const roles = await this.prisma.role.findMany({ where: { name: { in: dto.roles } } });

    const user = await this.prisma.user.create({
      data: {
        hotelId,
        fullName: dto.fullName,
        email: dto.email,
        passwordHash,
        areaId: dto.areaId,
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
      },
      select: this.userListSelect,
    });

    await this.audit.log({
      userId: actingUserId,
      action: 'USER_CREATE',
      entity: 'User',
      entityId: user.id,
      newValues: { fullName: user.fullName, email: user.email, roles: dto.roles },
    });

    return user;
  }

  async update(hotelId: string, id: string, dto: UpdateUserDto, actingUserId: string) {
    const existing = await this.findOne(hotelId, id);

    if (dto.email) {
      const emailOwner = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (emailOwner && emailOwner.id !== id) {
        throw new ConflictException('Ya existe un usuario con ese correo');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          email: dto.email,
          areaId: dto.areaId,
          isActive: dto.isActive,
        },
      });

      if (dto.roles) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        const roles = await tx.role.findMany({ where: { name: { in: dto.roles } } });
        await tx.userRole.createMany({
          data: roles.map((r) => ({ userId: id, roleId: r.id })),
        });
      }
    });

    const updated = await this.findOne(hotelId, id);

    await this.audit.log({
      userId: actingUserId,
      action: dto.roles ? 'USER_ROLE_CHANGE' : 'USER_UPDATE',
      entity: 'User',
      entityId: id,
      oldValues: { roles: existing.roles.map((r) => r.role.name), isActive: existing.isActive },
      newValues: toAuditJson({ roles: dto.roles, isActive: dto.isActive }),
    });

    return updated;
  }
}
