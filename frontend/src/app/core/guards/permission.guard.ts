import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Este guard SOLO evita que la UI muestre una pantalla que el usuario no
// podrá usar (mejor experiencia). La autorización real y vinculante ocurre
// siempre en el backend (PermissionsGuard/RolesGuard de NestJS): ocultar un
// botón o ruta en Angular nunca es, por sí solo, una medida de seguridad.
export const permissionGuard = (requiredPermission: string): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.hasPermission(requiredPermission)) return true;
    router.navigate(['/dashboard']);
    return false;
  };
};
