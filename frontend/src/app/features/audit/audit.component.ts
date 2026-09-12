import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditHttpService } from '../../core/services/admin.services';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Auditoría del sistema</h2>
    <p style="color:var(--color-text-muted)">Registro de solo lectura. Ningún usuario puede modificar esta información.</p>

    <div class="filters-bar" style="margin-bottom:16px; display:flex; gap:10px">
      <input placeholder="Acción (ej. LOGIN, USER_CREATE)" [(ngModel)]="actionFilter" (ngModelChange)="load()" />
      <input placeholder="Entidad (ej. Case, User)" [(ngModel)]="entityFilter" (ngModelChange)="load()" />
    </div>

    <div class="card" style="padding:0; overflow-x:auto">
      <table class="data-table" *ngIf="!loading() && items().length > 0">
        <thead>
          <tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>ID</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let log of items()">
            <td>{{ log.createdAt | date: 'medium' }}</td>
            <td>{{ log.user?.fullName ?? 'Sistema' }}</td>
            <td>{{ log.action }}</td>
            <td>{{ log.entity }}</td>
            <td>{{ log.entityId }}</td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="!loading() && items().length === 0">Sin registros para los filtros indicados.</div>
    </div>
  `,
})
export class AuditComponent {
  loading = signal(true);
  items = signal<any[]>([]);
  actionFilter = '';
  entityFilter = '';

  constructor(private auditHttp: AuditHttpService) {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.auditHttp
      .list(1, 50, { action: this.actionFilter, entity: this.entityFilter })
      .subscribe((res) => {
        this.items.set(res.items);
        this.loading.set(false);
      });
  }
}
