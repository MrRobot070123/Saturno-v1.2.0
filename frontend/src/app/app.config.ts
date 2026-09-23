import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideAnimations(),
    // Orden importante: errorInterceptor va PRIMERO (más externo) para que
    // authInterceptor quede más cerca del backend y pueda intentar renovar
    // la sesión (refresh token) ANTES de que error.interceptor muestre el
    // aviso "Tu sesión ha expirado". Con el orden anterior
    // ([authInterceptor, errorInterceptor]) ese aviso aparecía en cada
    // renovación silenciosa del access token (cada 15 min de uso normal),
    // aunque la sesión seguía activa y la petición se reintentaba sola.
    provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
  ],
};
