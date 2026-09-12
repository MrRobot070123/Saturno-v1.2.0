import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest() as { user: AuthenticatedUser };
    if (!user) throw new ForbiddenException('No autenticado');

    const hasPermission = required.some((p) => user.permissions.includes(p));
    if (!hasPermission) {
      throw new ForbiddenException('No tienes permisos para realizar esta acción');
    }
    return true;
  }
}
