import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReviewsService } from '../../../core/services/reviews.service';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { Location, Review, ReviewPlatform } from '../../../core/models/domain.models';

@Component({
  selector: 'app-reviews-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="reviews-page">
      <div class="reviews-header">
        <div>
          <h2>Reseñas externas</h2>
          <p class="reviews-subtitle">
            Reseñas de Booking, Expedia, Google y otras plataformas, clasificadas por tipo de queja.
          </p>
        </div>
        <a routerLink="/resenas/nueva" class="btn btn-primary">+ Nueva reseña</a>
      </div>

      <div class="filters-bar">
        <input
          placeholder="Buscar por huésped o texto..."
          [(ngModel)]="search"
          (ngModelChange)="onFilterChange()"
        />
        <select [(ngModel)]="locationId" (ngModelChange)="onFilterChange()">
          <option value="">Todas las ubicaciones</option>
          <option *ngFor="let l of locations()" [value]="l.id">{{ l.name }}</option>
        </select>
        <select [(ngModel)]="platformId" (ngModelChange)="onFilterChange()">
          <option value="">Todas las plataformas</option>
          <option *ngFor="let p of platforms()" [value]="p.id">{{ p.name }}</option>
        </select>
        <label class="date-field">
          <span>Desde</span>
          <input type="date" [(ngModel)]="from" (ngModelChange)="onFilterChange()" />
        </label>
        <label class="date-field">
          <span>Hasta</span>
          <input type="date" [(ngModel)]="to" (ngModelChange)="onFilterChange()" />
        </label>
        <button class="btn btn-outline btn-sm clear-btn" (click)="clearFilters()">Limpiar filtros</button>
      </div>

      <!--
        Mismo patrón que /casos: tabla en escritorio, tarjetas en móvil
        (responsive-table, definido en styles.scss), filas clicables con
        resaltado al pasar el mouse, que llevan al detalle de la reseña.
      -->
      <div class="card table-card">
        <table class="data-table responsive-table" *ngIf="reviews().length > 0">
          <thead>
            <tr>
              <th>Huésped</th>
              <th>Plataforma</th>
              <th>Fecha estancia</th>
              <th>Ubicación</th>
              <th>Habitación</th>
              <th>Observación</th>
              <th>Hallazgos</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of reviews()" (click)="openDetail(r.id)" style="cursor: pointer">
              <td data-label="Huésped">{{ r.guestName }}</td>
              <td data-label="Plataforma"><span class="badge badge-platform">{{ r.platform.name }}</span></td>
              <td data-label="Fecha estancia">{{ r.stayDate | date: 'dd/MM/yyyy' }}</td>
              <td data-label="Ubicación">{{ r.location.name }}</td>
              <td data-label="Habitación" class="hide-mobile">{{ r.room ?? '—' }}</td>
              <td data-label="Observación" class="truncate">{{ r.rawText }}</td>
              <td data-label="Hallazgos">
                <ng-container *ngIf="r.findings.length > 0; else noFindings">
                  <span class="finding-chip" *ngFor="let f of r.findings">
                    {{ f.area?.name }} · {{ f.subtype?.name || f.suggestedName }}
                  </span>
                </ng-container>
                <ng-template #noFindings><span class="review-no-findings">Sin clasificar</span></ng-template>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="empty-state" *ngIf="reviews().length === 0">No hay reseñas con estos filtros.</div>
      </div>

      <div class="pagination" *ngIf="total() > pageSize">
        <button class="btn btn-outline btn-sm" [disabled]="page === 1" (click)="changePage(page - 1)">Anterior</button>
        <span>Página {{ page }}</span>
        <button class="btn btn-outline btn-sm" [disabled]="page * pageSize >= total()" (click)="changePage(page + 1)">
          Siguiente
        </button>
      </div>
    </div>
  `,
  styles: [`
    .reviews-page { max-width: 1320px; margin: 0 auto; }
    .reviews-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap; gap:12px; }
    .reviews-subtitle { color:var(--color-text-muted); margin:4px 0 0; }

    .filters-bar { display:flex; flex-wrap:wrap; align-items:flex-end; gap:10px; margin-bottom:16px; }
    .filters-bar input { padding:9px 12px; border:1px solid var(--color-border); border-radius:var(--radius-sm); background:var(--color-surface); color:var(--color-text); }
    .filters-bar > input { flex:1; min-width:220px; }
    .filters-bar select {
      padding:9px 10px; border:1px solid var(--color-border); border-radius:var(--radius-sm);
      background:var(--color-surface); color:var(--color-text);
    }
    .date-field { display:flex; flex-direction:column; gap:2px; font-size:11px; font-weight:600; color:var(--color-text-muted); }
    .date-field input { width:100%; }

    .badge-platform { background:var(--color-accent); }
    .finding-chip {
      display:inline-block; font-size:12px; padding:3px 8px; margin:2px 4px 2px 0; border-radius:999px;
      background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface));
      color: var(--color-text);
      border: 1px solid var(--color-border);
    }
    .review-no-findings { color:var(--color-text-muted); font-size:13px; font-style:italic; }

    .truncate { max-width: 320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    .pagination { display:flex; gap:12px; align-items:center; justify-content:center; margin-top:16px; }

    @media (max-width: 768px) {
      .filters-bar input:not(.date-field input) { flex: 1 1 100%; min-width: 0; }
      .filters-bar select,
      .date-field { flex: 1 1 calc(50% - 5px); min-width: 0; }
      .clear-btn { flex: 1 1 100%; justify-content: center; }

      .truncate {
        max-width: none; overflow: visible; text-overflow: clip; white-space: normal;
        flex-direction: column; align-items: flex-start; gap: 4px; text-align: left;
      }

      td[data-label='Hallazgos'] { flex-direction: column; align-items: flex-start; text-align: left; }
    }
  `],
})
export class ReviewsListComponent implements OnInit {
  reviews = signal<Review[]>([]);
  locations = signal<Location[]>([]);
  platforms = signal<ReviewPlatform[]>([]);
  total = signal(0);

  search = '';
  locationId = '';
  platformId = '';
  from = '';
  to = '';
  page = 1;
  pageSize = 20;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private reviewsService: ReviewsService,
    private catalogsService: CatalogsService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.catalogsService.getLocations().subscribe((l) => this.locations.set(l));
    this.catalogsService.getReviewPlatforms().subscribe((p) => this.platforms.set(p));

    // Filtros que llegan por la URL (ej. al hacer clic en una tarjeta del
    // dashboard): mismo patrón que /casos.
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('locationId')) this.locationId = qp.get('locationId')!;
    if (qp.get('platformId')) this.platformId = qp.get('platformId')!;

    this.load();
  }

  load(): void {
    this.reviewsService
      .findAll({
        page: this.page,
        pageSize: this.pageSize,
        search: this.search || undefined,
        locationId: this.locationId || undefined,
        platformId: this.platformId || undefined,
        from: this.from ? `${this.from}T00:00:00.000Z` : undefined,
        to: this.to ? `${this.to}T23:59:59.999Z` : undefined,
      })
      .subscribe((res) => {
        this.reviews.set(res.data);
        this.total.set(res.total);
      });
  }

  onFilterChange(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page = 1;
      this.load();
    }, 400);
  }

  clearFilters(): void {
    this.search = '';
    this.locationId = '';
    this.platformId = '';
    this.from = '';
    this.to = '';
    this.page = 1;
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    this.load();
  }

  changePage(page: number): void {
    this.page = page;
    this.load();
  }

  openDetail(id: string): void {
    this.router.navigate(['/resenas', id]);
  }
}
