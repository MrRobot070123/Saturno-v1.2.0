import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReviewsService } from '../../../core/services/reviews.service';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { Area, CaseSubtype, PendingReviewFinding } from '../../../core/models/domain.models';
import { NotificationBannerService } from '../../../core/services/notification-banner.service';

// Fase B: pantalla donde el administrador (permiso
// review:classification-approve) revisa los tipos de queja nuevos que la IA
// propuso al clasificar reseñas (ReviewFinding en estado PENDING_APPROVAL),
// y decide por cada uno: vincularlo a un tipo ya existente, crear el tipo
// nuevo que la IA sugirió, o rechazarlo.
@Component({
  selector: 'app-pending-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="approvals-page">
      <div class="approvals-header">
        <div>
          <h2>Aprobaciones pendientes</h2>
          <p class="approvals-subtitle">
            Tipos de queja nuevos que la IA detectó en reseñas externas y aún no están en el catálogo.
          </p>
        </div>
      </div>

      <div class="skeleton" style="height: 200px" *ngIf="loading()"></div>

      <div class="empty-state card" *ngIf="!loading() && findings().length === 0">
        No hay hallazgos pendientes de aprobación por ahora.
      </div>

      <div class="card finding-card" *ngFor="let f of findings()">
        <div class="finding-top">
          <div>
            <a [routerLink]="['/resenas', f.review.id]">{{ f.review.guestName }}</a>
            <span class="muted"> · {{ f.review.platform.name }} · {{ f.review.location.name }} · {{ f.review.stayDate | date: 'dd/MM/yyyy' }}</span>
          </div>
          <span class="confidence">confianza {{ (f.confidence * 100) | number: '1.0-0' }}%</span>
        </div>

        <p class="excerpt">"{{ f.excerpt }}"</p>

        <div class="suggestion">
          <span class="badge-suggestion">IA propone: {{ f.suggestedArea || '(sin área)' }} · {{ f.suggestedName || '(sin nombre)' }}</span>
        </div>

        <div class="decision-row">
          <label class="radio-opt">
            <input type="radio" [name]="'mode-' + f.id" [(ngModel)]="modeById[f.id]" value="new" />
            Crear el tipo nuevo que propone la IA
          </label>
          <ng-container *ngIf="modeById[f.id] !== 'existing'">
            <select [(ngModel)]="areaIdById[f.id]" (ngModelChange)="onAreaChangeForNew(f.id)">
              <option value="">Área</option>
              <option *ngFor="let a of areas()" [value]="a.id">{{ a.name }}</option>
            </select>
            <input [(ngModel)]="nameById[f.id]" placeholder="Nombre del tipo de queja" />
          </ng-container>

          <label class="radio-opt">
            <input type="radio" [name]="'mode-' + f.id" [(ngModel)]="modeById[f.id]" value="existing" />
            Vincular a un tipo que ya existe
          </label>
          <ng-container *ngIf="modeById[f.id] === 'existing'">
            <select [(ngModel)]="existingAreaIdById[f.id]" (ngModelChange)="loadExistingSubtypes(f.id)">
              <option value="">Área</option>
              <option *ngFor="let a of areas()" [value]="a.id">{{ a.name }}</option>
            </select>
            <select [(ngModel)]="subtypeIdById[f.id]">
              <option value="">Tipo de queja</option>
              <option *ngFor="let s of subtypesById[f.id] || []" [value]="s.id">{{ s.name }}</option>
            </select>
          </ng-container>
        </div>

        <div class="actions-row">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            [disabled]="busyId() === f.id || !canApprove(f.id)"
            (click)="approve(f)"
          >
            {{ busyId() === f.id ? 'Guardando...' : 'Aprobar' }}
          </button>
          <button
            type="button"
            class="btn btn-outline btn-sm"
            [disabled]="busyId() === f.id"
            (click)="reject(f)"
          >
            Rechazar
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .approvals-page { max-width: 900px; margin: 0 auto; }
    .approvals-header { margin-bottom: 16px; }
    .approvals-subtitle { color: var(--color-text-muted); margin: 4px 0 0; }

    .empty-state { padding: 24px; text-align: center; color: var(--color-text-muted); }

    .finding-card { margin-bottom: 16px; }
    .finding-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .finding-top a { font-weight: 700; }
    .muted { color: var(--color-text-muted); font-size: 13px; }
    .confidence { font-size: 12px; color: var(--color-text-muted); white-space: nowrap; }

    .excerpt { font-style: italic; color: var(--color-text-muted); margin: 10px 0; }

    .badge-suggestion {
      display: inline-block; font-size: 12px; padding: 4px 10px; border-radius: 999px;
      background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));
      border: 1px solid var(--color-border);
    }

    .decision-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 12px 0; }
    .radio-opt { display: flex; align-items: center; gap: 6px; font-size: 13px; flex: 1 1 100%; }
    .decision-row select, .decision-row input {
      padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
      background: var(--color-surface); color: var(--color-text);
    }
    .decision-row input { flex: 1; min-width: 160px; }

    .actions-row { display: flex; gap: 8px; }

    @media (max-width: 768px) {
      .decision-row select, .decision-row input { flex: 1 1 100%; }
    }
  `],
})
export class PendingApprovalsComponent implements OnInit {
  loading = signal(true);
  findings = signal<PendingReviewFinding[]>([]);
  areas = signal<Area[]>([]);
  busyId = signal<string | null>(null);

  // Estado por hallazgo (claves = finding.id), simple y explícito en vez de
  // un FormArray: cada tarjeta se resuelve de forma independiente.
  modeById: Record<string, 'new' | 'existing'> = {};
  areaIdById: Record<string, string> = {};
  nameById: Record<string, string> = {};
  existingAreaIdById: Record<string, string> = {};
  subtypeIdById: Record<string, string> = {};
  subtypesById: Record<string, CaseSubtype[]> = {};

  constructor(
    private reviewsService: ReviewsService,
    private catalogsService: CatalogsService,
    private banner: NotificationBannerService,
  ) {}

  ngOnInit(): void {
    this.catalogsService.getAreas().subscribe((a) => this.areas.set(a));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.reviewsService.findPendingFindings().subscribe({
      next: (items) => {
        this.findings.set(items);
        for (const f of items) {
          this.modeById[f.id] = 'new';
          // Si la IA ya reconoció un área existente, se precarga.
          const matchedArea = this.areas().find((a) => a.name === f.suggestedArea);
          this.areaIdById[f.id] = matchedArea?.id ?? '';
          this.nameById[f.id] = f.suggestedName ?? '';
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onAreaChangeForNew(findingId: string): void {
    // Sin lógica adicional por ahora; existe como hook si luego se valida
    // duplicados en vivo contra el catálogo del área elegida.
    void findingId;
  }

  loadExistingSubtypes(findingId: string): void {
    this.subtypeIdById[findingId] = '';
    this.subtypesById[findingId] = [];
    const areaId = this.existingAreaIdById[findingId];
    if (!areaId) return;
    this.catalogsService.getSubtypes(areaId, 'QUEJA').subscribe((s) => (this.subtypesById[findingId] = s));
  }

  canApprove(findingId: string): boolean {
    if (this.modeById[findingId] === 'existing') {
      return !!this.subtypeIdById[findingId];
    }
    return !!this.areaIdById[findingId] && !!this.nameById[findingId]?.trim();
  }

  approve(f: PendingReviewFinding): void {
    if (!this.canApprove(f.id)) return;
    this.busyId.set(f.id);

    const payload =
      this.modeById[f.id] === 'existing'
        ? { subtypeId: this.subtypeIdById[f.id] }
        : { areaId: this.areaIdById[f.id], name: this.nameById[f.id].trim() };

    this.reviewsService.approveFinding(f.id, payload).subscribe({
      next: () => {
        this.banner.showSuccess('Hallazgo aprobado.');
        this.busyId.set(null);
        this.findings.update((items) => items.filter((x) => x.id !== f.id));
      },
      error: () => this.busyId.set(null),
    });
  }

  reject(f: PendingReviewFinding): void {
    this.busyId.set(f.id);
    this.reviewsService.rejectFinding(f.id).subscribe({
      next: () => {
        this.banner.showSuccess('Hallazgo rechazado.');
        this.busyId.set(null);
        this.findings.update((items) => items.filter((x) => x.id !== f.id));
      },
      error: () => this.busyId.set(null),
    });
  }
}