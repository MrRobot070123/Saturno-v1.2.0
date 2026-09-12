import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  findRoles() {
    return this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  findPermissions() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }

  async updateRolePermissions(
    roleId: string,
    permissionCodes: string[],
    actingUserId: string,
  ) {
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
    });

    const before = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId, permissionId: p.id })),
      }),
    ]);

    await this.audit.log({
      userId: actingUserId,
      action: 'ROLE_PERMISSIONS_CHANGE',
      entity: 'Role',
      entityId: roleId,
      oldValues: { permissions: before.map((b) => b.permission.code) },
      newValues: { permissions: permissionCodes },
    });

    return this.findRoles();
  }
}
