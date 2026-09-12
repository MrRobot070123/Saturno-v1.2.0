import { Injectable } from '@angular/core';

const ACCESS_TOKEN_KEY = 'hcs_access_token';
const REFRESH_TOKEN_KEY = 'hcs_refresh_token';
const USER_KEY = 'hcs_user';

// Nota: esta app se ejecuta como SPA servida por su propio contenedor Docker
// (no dentro del entorno de artifacts de Claude.ai), por lo que localStorage
// del navegador real del usuario es válido y es el mecanismo estándar de
// Angular para persistir sesión entre recargas.
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  setUser(user: unknown): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  getUser<T>(): T | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
