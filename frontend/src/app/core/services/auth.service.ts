import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenStorageService } from './token-storage.service';
import { AuthUser, LoginResponse } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Signal reactivo consumido por el layout/guards para reaccionar a
  // cambios de sesión sin recargar la página. Se inicializa en el
  // constructor (no como valor por defecto del campo) porque en ese punto
  // "tokenStorage" aún no ha sido asignado por la inyección de dependencias.
  currentUser = signal<AuthUser | null>(null);

  constructor(private http: HttpClient, private tokenStorage: TokenStorageService) {
    this.currentUser.set(this.tokenStorage.getUser<AuthUser>());
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(
        tap((res) => {
          this.tokenStorage.setTokens(res.accessToken, res.refreshToken);
          this.tokenStorage.setUser(res.user);
          this.currentUser.set(res.user);
        }),
      );
  }

  logout(): Observable<unknown> {
    const refreshToken = this.tokenStorage.getRefreshToken();
    return this.http
      .post(`${environment.apiUrl}/auth/logout`, { refreshToken })
      .pipe(tap(() => this.clearSession()));
  }

  clearSession(): void {
    this.tokenStorage.clear();
    this.currentUser.set(null);
  }

  isAuthenticated(): boolean {
    return !!this.tokenStorage.getAccessToken();
  }

  hasPermission(permission: string): boolean {
    return this.currentUser()?.permissions.includes(permission) ?? false;
  }

  hasRole(role: string): boolean {
    return this.currentUser()?.roles.includes(role as any) ?? false;
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/change-password`, {
      currentPassword,
      newPassword,
    });
  }
}
