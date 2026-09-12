import { SetMetadata } from '@nestjs/common';
import { RoleName } from '@prisma/client';

export const ROLES_KEY = 'roles';
// Uso: @Roles(RoleName.ADMINISTRADOR, RoleName.SUPERVISOR)
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
