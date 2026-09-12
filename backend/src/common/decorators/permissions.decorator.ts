import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
// Uso: @RequirePermissions('case:assign', 'case:close')
// El PermissionsGuard exige que el usuario tenga AL MENOS UNO de los
// permisos listados (cualquiera cubre el acceso), evaluado en backend
// contra la tabla role_permissions - nunca confiando en ocultar botones
// en Angular (regla #12 del proyecto).
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
