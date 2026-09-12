import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationBannerService } from '../services/notification-banner.service';

// Traduce cualquier error de backend a un mensaje amigable visible en un
// banner global, sin exponer nunca detalles técnicos/stack traces (el
// backend ya los omite, pero el frontend tampoco debe intentar mostrarlos).
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const banner = inject(NotificationBannerService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let message = 'No fue posible completar la operación. Intenta nuevamente.';

      if (error.status === 0) {
        message = 'No hay conexión con el servidor. Verifica tu red.';
      } else if (error.status === 401) {
        message = 'Tu sesión ha expirado.';
      } else if (error.status === 403) {
        message = 'No tienes permisos para realizar esta acción.';
      } else if (error.status === 404) {
        message = 'No se encontró la información solicitada.';
      } else if (error.status === 409) {
        message = typeof error.error?.message === 'string' ? error.error.message : 'El recurso ya existe.';
      } else if (error.status >= 400 && error.status < 500) {
        message = Array.isArray(error.error?.message)
          ? error.error.message.join(', ')
          : error.error?.message ?? message;
      }

      banner.showError(message);
      return throwError(() => error);
    }),
  );
};
