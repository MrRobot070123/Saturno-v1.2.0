import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { NotificationBannerService } from './notification-banner.service';

// Cierra la sesión automáticamente tras un período sin actividad del
// usuario en la página (mover el mouse, escribir, hacer clic, desplazarse).
// Se arranca desde LayoutComponent (solo existe mientras hay una sesión
// activa) y se detiene al destruirse ese componente.
const IDLE_LIMIT_MS = 60 * 60 * 1000; // 1 hora
// No reinicia el temporizador en CADA evento (mousemove puede disparar
// decenas de veces por segundo); basta con notar que hubo actividad una
// vez cada pocos segundos.
const RESET_THROTTLE_MS = 5_000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

@Injectable({ providedIn: 'root' })
export class IdleSessionService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastReset = 0;
  private running = false;
  private readonly onActivity = () => this.handleActivity();

  constructor(
    private ngZone: NgZone,
    private authService: AuthService,
    private banner: NotificationBannerService,
    private router: Router,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    // Los listeners de actividad corren FUERA de Angular: se disparan con
    // muchísima frecuencia (mousemove, scroll) y no necesitan disparar
    // detección de cambios; solo el cierre de sesión final vuelve a entrar
    // a la zona de Angular (this.ngZone.run(...) en handleTimeout).
    this.ngZone.runOutsideAngular(() => {
      ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, this.onActivity, { passive: true }));
      this.scheduleTimeout();
    });
  }

  stop(): void {
    this.running = false;
    ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, this.onActivity));
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private handleActivity(): void {
    const now = Date.now();
    if (now - this.lastReset < RESET_THROTTLE_MS) return;
    this.lastReset = now;
    this.scheduleTimeout();
  }

  private scheduleTimeout(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.handleTimeout(), IDLE_LIMIT_MS);
  }

  private handleTimeout(): void {
    this.stop();
    this.ngZone.run(() => {
      this.authService.clearSession();
      this.banner.showError('Tu sesión se cerró automáticamente por inactividad.');
      this.router.navigate(['/login']);
    });
  }
}
