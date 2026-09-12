import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { TokenStorageService } from '../services/token-storage.service';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;
const refreshSubject = new BehaviorSubject<string | null>(null);

// Adjunta el Bearer token a cada request y, ante un 401 (access token
// expirado), intenta refrescar la sesión UNA vez antes de forzar logout.
// Esto evita que el usuario pierda su trabajo por una expiración de 15 min.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStorage = inject(TokenStorageService);
  const authService = inject(AuthService);
  const http = inject(HttpClient);
  const router = inject(Router);

  const accessToken = tokenStorage.getAccessToken();
  const authReq = accessToken
    ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');
      if (error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }

      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        authService.clearSession();
        router.navigate(['/login']);
        return throwError(() => error);
      }

      if (!isRefreshing) {
        isRefreshing = true;
        refreshSubject.next(null);

        return http.post<{ accessToken: string; refreshToken: string }>(
          `${environment.apiUrl}/auth/refresh`,
          { refreshToken },
        ).pipe(
          switchMap((res) => {
            isRefreshing = false;
            tokenStorage.setTokens(res.accessToken, res.refreshToken);
            refreshSubject.next(res.accessToken);
            return next(req.clone({ setHeaders: { Authorization: `Bearer ${res.accessToken}` } }));
          }),
          catchError((refreshError) => {
            isRefreshing = false;
            authService.clearSession();
            router.navigate(['/login']);
            return throwError(() => refreshError);
          }),
        );
      }

      // Otra petición ya está refrescando: esperar a que termine y reintentar.
      return refreshSubject.pipe(
        filter((token) => token !== null),
        take(1),
        switchMap((token) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
      );
    }),
  );
};
