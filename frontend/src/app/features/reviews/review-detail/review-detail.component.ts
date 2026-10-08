import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ReviewsService } from '../../../core/services/reviews.service';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { Area, CaseSubtype, Review } from '../../../core/models/domain.models';
import { NotificationBannerService } from '../../../core/services/notification-banner.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-review-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="review-detail-page">
      <button class="btn btn-outline btn-sm" (click)="goBack()">← Volver a reseñas</button>

      <div *ngIf="loading()" class="skeleton" style="height: 260px; margin-top: 16px"></div>

      <ng-container *ngIf="!loading() && review() as r">
        <div class="detail-header">
          <div>
            <h2>{{ r.guestName }}</h2>
            <span class="badge badge-platform">{{ r.platform.name }}</span>
          </div>
        </div>

        <div class="detail-grid">
          <div class="card">
            <h4>Información de la estancia</h4>
            <dl>
              <dt>Ubicación</dt><dd>{{ r.location.name }}</dd>
              <dt *ngIf="r.room">Habitación</dt><dd *ngIf="r.room">{{ r.room }}</dd>
              <dt>Plataforma</dt><dd>{{ r.platform.name }}</dd>
              <dt>Fecha de estancia</dt><dd>{{ r.stayDate | date: 'mediumDate' }}</dd>
              <dt>Digitada por</dt><dd>{{ r.createdBy.fullName }}</dd>
              <dt>Fecha de registro</dt><dd>{{ r.createdAt | date: 'medium' }}</dd>
            </dl>
          </div>

          <div class="card">
            <h4>Observación del huésped</h4>
            <p class="review-text">{{ r.rawText }}</p>
          </div>
        </div>

        <div class="card actions-card">
          <h4>Tipos de queja identificados</h4>

          <ul class="findings-list" *ngIf="r.findings.length > 0">
            <li *ngFor="let f of r.findings">
              <span class="finding-chip">{{ f.area?.name }} · {{ f.subtype?.name || f.suggestedName }}</span>
              <em class="finding-excerpt">"{{ f.excerpt }}"</em>
            </li>
          </ul>
          <p class="review-no-findings" *ngIf="r.findings.length === 0">
            Todavía no se ha identificado ningún tipo de queja en esta reseña.
          </p>

          <div class="finding-add-row" *ngIf="auth.hasPermission('review:create')">
            <select [(ngModel)]="pendingAreaId" (ngModelChange)="loadSubtypesForPending()">
              <option value="">Área</option>
              <option *ngFor="let a of areas()" [value]="a.id">{{ a.name }}</option>
            </select>
            <select [(ngModel)]="pendingSubtypeId">
              <option value="">Tipo de queja</option>
              <option *ngFor="let s of pendingSubtypes()" [value]="s.id">{{ s.name }}</option>
            </select>
            <input [(ngModel)]="pendingExcerpt" placeholder="Fragmento del texto que lo sustenta" />
            <button
              type="button"
              class="btn btn-primary btn-sm"
              (click)="addFinding()"
              [disabled]="addingFinding() || !pendingSubtypeId || !pendingExcerpt.trim()"
            >
              {{ addingFinding() ? 'Agregando...' : 'Agregar hallazgo' }}
            </button>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .review-detail-page { max-width: 1100px; margin: 0 auto; }

    .detail-header { margin: 16px 0; display: flex; gap: 8px; align-items: center; }
    .detail-header .badge { margin-left: 8px; }
    .badge-platform { background: var(--color-accent); }

    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }

    dl { margin: 0; }
    dt { font-size: 12px; text-transform: uppercase; color: var(--color-text-muted); margin-top: 12px; font-weight: 700; }
    dd { margin: 2px 0 0; }

    .review-text { white-space: pre-wrap; margin: 0; }

    .actions-card { margin-bottom: 16px; }

    .findings-list { list-style: none; padding: 0; margin: 0 0 14px; }
    .findings-list li {
      padding: 10px 0; border-bottom: 1px solid var(--color-border);
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
    }
    .finding-chip {
      display:inline-block; font-size:12px; padding:3px 8px; border-radius:999px;
      background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));
      color: var(--color-text);
      border: 1px solid var(--color-border);
    }
    .finding-excerpt { color: var(--color-text-muted); font-size: 13px; }
    .review-no-findings { color: var(--color-text-muted); font-size: 13px; font-style: italic; }

    .finding-add-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .finding-add-row select, .finding-add-row input {
      padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
      background: var(--color-surface); color: var(--color-text);
    }
    .finding-add-row input { flex: 1; min-width: 180px; }

    @media (max-width: 768px) {
      .detail-grid { grid-template-columns: 1fr; }
      .finding-add-row select,
      .finding-add-row input,
      .finding-add-row button { flex: 1 1 100%; }
    }
  `],
})
export class ReviewDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading = signal(true);
  review = signal<Review | null>(null);
  areas = signal<Area[]>([]);
  pendingSubtypes = signal<CaseSubtype[]>([]);
  addingFinding = signal(false);

  pendingAreaId = '';
  pendingSubtypeId = '';
  pendingExcerpt = '';

  private reviewId = '';

  constructor(
    private reviewsService: ReviewsService,
    private catalogsService: CatalogsService,
    private banner: NotificationBannerService,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.reviewId = this.route.snapshot.paramMap.get('id')!;
    this.catalogsService.getAreas().subscribe((a) => this.areas.set(a));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.reviewsService.findOne(this.reviewId).subscribe({
      next: (r) => {
        this.review.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadSubtypesForPending(): void {
    this.pendingSubtypeId = '';
    this.pendingSubtypes.set([]);
    if (!this.pendingAreaId) return;
    this.catalogsService.getSubtypes(this.pendingAreaId, 'QUEJA').subscribe((s) => this.pendingSubtypes.set(s));
  }

  addFinding(): void {
    if (!this.pendingSubtypeId || !this.pendingExcerpt.trim()) return;
    this.addingFinding.set(true);
    this.reviewsService.addFinding(this.reviewId, this.pendingSubtypeId, this.pendingExcerpt.trim()).subscribe({
      next: () => {
        this.addingFinding.set(false);
        this.pendingAreaId = '';
        this.pendingSubtypeId = '';
        this.pendingExcerpt = '';
        this.pendingSubtypes.set([]);
        this.banner.showSuccess('Hallazgo agregado.');
        this.load();
      },
      error: () => this.addingFinding.set(false),
    });
  }

  goBack(): void {
    this.router.navigate(['/resenas']);
  }
}
