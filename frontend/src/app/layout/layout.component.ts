import { Component, ElementRef, HostListener, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { NotificationBannerService } from '../core/services/notification-banner.service';
import { NotificationsHttpService } from '../core/services/admin.services';
import { ReviewsService } from '../core/services/reviews.service';
import { ThemeService } from '../core/services/theme.service';
import { IdleSessionService } from '../core/services/idle-session.service';
import { AppFooterComponent } from '../shared/components/app-footer/app-footer.component';
import { AppNotification } from '../core/models/domain.models';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  permission?: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, AppFooterComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent implements OnDestroy {
  // Escritorio: menú lateral expandido (íconos + texto) o colapsado (solo íconos).
  sidebarCollapsed = signal(false);
  // Móvil: el menú es un drawer que se abre/cierra sobre el contenido.
  mobileNavOpen = signal(false);
  unreadCount = signal(0);
  notifPanelOpen = signal(false);
  notifications = signal<AppNotification[]>([]);
  notifLoading = signal(false);
  // Fase B: contador de hallazgos de reseñas pendientes de aprobación,
  // mostrado como badge junto al ítem "Aprobaciones" del menú.
  pendingApprovalsCount = signal(0);

  navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: '📊' },
    { label: 'Casos', path: '/casos', icon: '🗂️' },
    { label: 'Quejas', path: '/quejas', icon: '⚠️' },
    { label: 'Solicitudes', path: '/solicitudes', icon: '📝' },
    { label: 'Reseñas', path: '/resenas', icon: '⭐', permission: 'review:view' },
    {
      label: 'Aprobaciones',
      path: '/resenas/aprobaciones',
      icon: '✅',
      permission: 'review:classification-approve',
    },
    { label: 'Reportes', path: '/reportes', icon: '📈', permission: 'report:view' },
    { label: 'Usuarios', path: '/usuarios', icon: '👥', permission: 'user:manage' },
    { label: 'Configuración', path: '/configuracion', icon: '⚙️', permission: 'catalog:manage' },
    { label: 'Auditoría', path: '/auditoria', icon: '🛡️', permission: 'audit:view' },
  ];

  constructor(
    public auth: AuthService,
    public banner: NotificationBannerService,
    public theme: ThemeService,
    private notificationsHttp: NotificationsHttpService,
    private reviewsService: ReviewsService,
    private idle: IdleSessionService,
    private router: Router,
    private elementRef: ElementRef<HTMLElement>,
  ) {
    this.refreshUnread();
    this.refreshPendingApprovals();
    // LayoutComponent solo existe mientras hay una sesión iniciada (está
    // detrás de authGuard en app.routes.ts), así que este es el lugar
    // correcto para arrancar el temporizador de cierre por inactividad.
    this.idle.start();
  }

  ngOnDestroy(): void {
    this.idle.stop();
  }

  // Cierra el panel de notificaciones al hacer clic en cualquier parte del
  // documento que no sea el propio panel o el botón de la campanita (antes
  // solo se cerraba volviendo a hacer clic en la campanita).
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.notifPanelOpen()) return;
    const wrapper = this.elementRef.nativeElement.querySelector('.notif-wrapper');
    if (wrapper && !wrapper.contains(event.target as Node)) {
      this.notifPanelOpen.set(false);
    }
  }

  // Escape cierra el drawer móvil y el panel de notificaciones.
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.mobileNavOpen.set(false);
    this.notifPanelOpen.set(false);
  }

  // Si el usuario rota el teléfono o agranda la ventana hasta modo escritorio,
  // el drawer no debe quedar "abierto" en segundo plano.
  @HostListener('window:resize')
  onResize(): void {
    if (!this.isMobile()) {
      this.mobileNavOpen.set(false);
    }
  }

  // Debe coincidir con el breakpoint de layout.component.scss (max-width: 768px).
  private isMobile(): boolean {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  visibleNavItems(): NavItem[] {
    return this.navItems.filter((item) => !item.permission || this.auth.hasPermission(item.permission));
  }

  // routerLinkActive marca un ítem como activo si la URL actual EMPIEZA con
  // su ruta, así que '/resenas' (Reseñas) también se resaltaba estando en
  // '/resenas/aprobaciones' (Aprobaciones), porque una es prefijo de la otra.
  // Aquí se elige el ítem con la ruta más específica que calce con la URL
  // actual, y solo ese se resalta.
  isItemActive(item: NavItem): boolean {
    const url = this.router.url.split('?')[0].split('#')[0];
    const matches = (path: string) => url === path || url.startsWith(path + '/');
    if (!matches(item.path)) return false;
    const moreSpecificMatch = this.navItems.some(
      (other) => other.path !== item.path && other.path.length > item.path.length && matches(other.path),
    );
    return !moreSpecificMatch;
  }

  // En móvil abre/cierra el drawer; en escritorio colapsa/expande el menú.
  toggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileNavOpen.update((v) => !v);
    } else {
      this.sidebarCollapsed.update((v) => !v);
    }
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  refreshUnread(): void {
    this.notificationsHttp.list(true).subscribe({
      next: (items) => this.unreadCount.set(items.length),
      error: () => this.unreadCount.set(0),
    });
  }

  // Solo se consulta si el usuario tiene el permiso: evita una llamada (y un
  // 403 esperado) para roles que nunca van a ver ese ítem del menú.
  refreshPendingApprovals(): void {
    if (!this.auth.hasPermission('review:classification-approve')) return;
    this.reviewsService.findPendingFindings().subscribe({
      next: (items) => this.pendingApprovalsCount.set(items.length),
      error: () => this.pendingApprovalsCount.set(0),
    });
  }

  // El contador de "no leídas" se recalcula aquí mismo a partir de la lista
  // recién traída (en vez de confiar en el valor cargado al inicio de la
  // sesión): no hay WebSocket que avise de notificaciones nuevas (son
  // polling/consulta, ver README → Roadmap), así que sin esto el badge se
  // quedaba desactualizado si se generaba una notificación nueva (p. ej. al
  // asignar un caso) mientras la campanita no se volvía a abrir.
  toggleNotifPanel(): void {
    const opening = !this.notifPanelOpen();
    this.notifPanelOpen.set(opening);
    if (opening) {
      this.notifLoading.set(true);
      this.notificationsHttp.list(false).subscribe({
        next: (items) => {
          this.notifications.set(items);
          this.unreadCount.set(items.filter((n) => !n.readAt).length);
          this.notifLoading.set(false);
        },
        error: () => this.notifLoading.set(false),
      });
    }
  }

  openNotification(n: AppNotification): void {
    if (!n.readAt) {
      this.notificationsHttp.markRead(n.id).subscribe(() => this.refreshUnread());
    }
    this.notifPanelOpen.set(false);
    if (n.caseId) {
      this.router.navigate(['/casos', n.caseId]);
    }
  }

  // Arma el enlace wa.me a partir del teléfono y el texto de la notificación
  // (vía gratuita, sin API de pago: ver diseno-modulo-resenas-v2.1.0.md §4B).
  whatsappHref(n: AppNotification): string {
    return `https://wa.me/${n.whatsappPhone}?text=${encodeURIComponent(n.message)}`;
  }

  markAllNotificationsRead(): void {
    this.notificationsHttp.markAllRead().subscribe(() => {
      this.notifications.update((items) => items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      this.refreshUnread();
    });
  }

  logout(): void {
    this.idle.stop();
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}