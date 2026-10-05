import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReviewsService } from '../../../core/services/reviews.service';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { Location, Review, ReviewPlatform } from '../../../core/models/domain.models';

@Component({
  selector: 'app-reviews-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
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
      <input type="date" [(ngModel)]="from" (ngModelChange)="onFilterChange()" />
      <input type="date" [(ngModel)]="to" (ngModelChange)="onFilterChange()" />
      <button class="btn btn-outline btn-sm" (click)="clearFilters()">Limpiar filtros</button>
    </div>

    <div class="review-card" *ngFor="let r of reviews()">
      <div class="review-card-header">
        <div>
          <strong>{{ r.guestName }}</strong>
          <span class="badge">{{ r.platform.name }}</span>
        </div>
        <span class="review-date">{{ r.stayDate | date: 'dd/MM/yyyy' }}</span>
      </div>
      <p class="review-location">
        {{ r.location.name }}<ng-container *ngIf="r.room"> · Hab. {{ r.room }}</ng-container>
      </p>
      <p class="review-text">{{ r.rawText }}</p>
      <div class="review-findings" *ngIf="r.findings.length > 0">
        <span class="finding-chip" *ngFor="let f of r.findings">
          {{ f.area?.name }} · {{ f.subtype?.name || f.suggestedName }}
        </span>
      </div>
      <p class="review-no-findings" *ngIf="r.findings.length === 0">Sin tipo de queja identificado todavía.</p>
    </div>

    <p *ngIf="reviews().length === 0" class="empty-state">No hay reseñas con estos filtros.</p>

    <div class="pagination" *ngIf="total() > pageSize">
      <button class="btn btn-outline btn-sm" [disabled]="page === 1" (click)="changePage(page - 1)">Anterior</button>
      <span>Página {{ page }}</span>
      <button class="btn btn-outline btn-sm" [disabled]="page * pageSize >= total()" (click)="changePage(page + 1)">
        Siguiente
      </button>
    </div>
  `,
  styles: [`
    .reviews-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap; gap:12px; }
    .reviews-subtitle { color:var(--color-text-muted); margin:4px 0 0; }
    .filters-bar { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
    .filters-bar input, .filters-bar select { padding:8px 10px; border:1px solid var(--color-border); border-radius:6px; }
    .review-card { border:1px solid var(--color-border); border-radius:8px; padding:14px 16px; margin-bottom:12px; }
    .review-card-header { display:flex; justify-content:space-between; align-items:center; }
    .badge { margin-left:8px; font-size:12px; padding:2px 8px; border-radius:999px; background:var(--color-surface-alt); }
    .review-date { color:var(--color-text-muted); font-size:13px; }
    .review-location { color:var(--color-text-muted); margin:4px 0; font-size:14px; }
    .review-text { margin:8px 0; }
    .review-findings { display:flex; gap:6px; flex-wrap:wrap; }
    .finding-chip { font-size:12px; padding:3px 8px; border-radius:999px; background:var(--color-warning-bg, #fff3cd); }
    .review-no-findings { color:var(--color-text-muted); font-size:13px; font-style:italic; }
    .empty-state { color:var(--color-text-muted); text-align:center; padding:24px; }
    .pagination { display:flex; gap:12px; align-items:center; justify-content:center; margin-top:16px; }
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

  constructor(private reviewsService: ReviewsService, private catalogsService: CatalogsService) {}

  ngOnInit(): void {
    this.catalogsService.getLocations().subscribe((l) => this.locations.set(l));
    this.catalogsService.getReviewPlatforms().subscribe((p) => this.platforms.set(p));
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
    this.load();
  }

  changePage(page: number): void {
    this.page = page;
    this.load();
  }
}