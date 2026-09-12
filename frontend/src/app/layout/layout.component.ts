import { Component, ElementRef, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { NotificationBannerService } from '../core/services/notification-banner.service';
import { NotificationsHttpService } from '../core/services/admin.services';
import { ThemeService } from '../core/services/theme.service';
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
export class LayoutComponent {
  sidebarCollapsed = signal(false);
  unreadCount = signal(0);
  notifPanelOpen = signal(false);
  notifications = signal<AppNotification[]>([]);
  notifLoading = signal(false);

  navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: '📊' },
    { label: 'Casos', path: '/casos', icon: '🗂️' },
    { label: 'Quejas', path: '/quejas', icon: '⚠️' },
    { label: 'Solicitudes', path: '/solicitudes', icon: '📝' },
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
    private router: Router,
    private elementRef: ElementRef<HTMLElement>,
  ) {
    this.refreshUnread();
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

  visibleNavItems(): NavItem[] {
    return this.navItems.filter((item) => !item.permission || this.auth.hasPermission(item.permission));
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  refreshUnread(): void {
    this.notificationsHttp.list(true).subscribe({
      next: (items) => this.unreadCount.set(items.length),
      error: () => this.unreadCount.set(0),
    });
  }

  // La campanita antes solo mostraba el contador, sin forma de ver el
  // contenido. Ahora abre/cierra un panel con la lista real.
  toggleNotifPanel(): void {
    const opening = !this.notifPanelOpen();
    this.notifPanelOpen.set(opening);
    if (opening) {
      this.notifLoading.set(true);
      this.notificationsHttp.list(false).subscribe({
        next: (items) => {
          this.notifications.set(items);
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

  markAllNotificationsRead(): void {
    this.notificationsHttp.markAllRead().subscribe(() => {
      this.notifications.update((items) => items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      this.refreshUnread();
    });
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
