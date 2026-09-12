import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CaseFilters, CasesService } from '../../../core/services/cases.service';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { CaseItem } from '../../../core/models/domain.models';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-cases-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cases-list.component.html',
  styleUrl: './cases-list.component.scss',
})
export class CasesListComponent implements OnInit {
  loading = signal(true);
  items = signal<CaseItem[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = 20;
  totalPages = signal(1);
  fixedType: string | null = null;
  drillDownLabel = signal<string | null>(null);

  filters: CaseFilters = {
    search: '',
    type: '',
    status: '',
    priority: '',
    sortBy: 'createdAt',
    sortDir: 'desc',
  };

  constructor(
    private casesService: CasesService,
    private catalogsService: CatalogsService,
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.fixedType = (this.route.snapshot.data['fixedType'] as string) ?? null;
    if (this.fixedType) this.filters.type = this.fixedType;

    // Filtros que llegan por la URL (ej. al hacer clic en una tarjeta o
    // gráfico del dashboard): se aplican antes de la primera carga.
    const qp = this.route.snapshot.queryParamMap;
    if (!this.fixedType && qp.get('type')) this.filters.type = qp.get('type')!;
    if (qp.get('status')) this.filters.status = qp.get('status')!;
    if (qp.get('priority')) this.filters.priority = qp.get('priority')!;
    if (qp.get('areaId')) this.filters.areaId = qp.get('areaId')!;
    if (qp.get('locationId')) this.filters.locationId = qp.get('locationId')!;
    if (qp.get('responsibleId')) this.filters.responsibleId = qp.get('responsibleId')!;
    if (qp.get('subtypeId')) this.filters.subtypeId = qp.get('subtypeId')!;
    if (qp.get('room')) this.filters.room = qp.get('room')!;
    if (qp.get('from')) this.filters.from = qp.get('from')!;
    if (qp.get('to')) this.filters.to = qp.get('to')!;
    if (qp.get('search')) this.filters.search = qp.get('search')!;

    if (qp.get('areaId') || qp.get('locationId') || qp.get('from') || qp.get('subtypeId') || qp.get('room')) {
      this.buildDrillDownLabel();
    }

    this.load();
  }

  // Arma un texto legible como "Área: Mantenimiento · 01/09/2026 – 09/09/2026"
  // para que quede claro por qué la lista llegó ya filtrada desde el
  // dashboard (areaId/locationId/fechas no tienen su propio selector visible
  // en esta pantalla).
  private buildDrillDownLabel(): void {
    const parts: Promise<string | null>[] = [];

    if (this.filters.areaId) {
      parts.push(
        new Promise((resolve) => {
          this.catalogsService.getAreas(false).subscribe({
            next: (areas) => resolve('Área: ' + (areas.find((a) => a.id === this.filters.areaId)?.name ?? '—')),
            error: () => resolve(null),
          });
        }),
      );
    }
    if (this.filters.locationId) {
      parts.push(
        new Promise((resolve) => {
          this.catalogsService.getLocations(false).subscribe({
            next: (locs) =>
              resolve('Ubicación: ' + (locs.find((l) => l.id === this.filters.locationId)?.name ?? '—')),
            error: () => resolve(null),
          });
        }),
      );
    }
    if (this.filters.room) {
      parts.push(Promise.resolve('Habitación: ' + this.filters.room));
    }
    if (this.filters.subtypeId) {
      const sid = this.filters.subtypeId;
      parts.push(
        new Promise((resolve) => {
          this.catalogsService.getAllSubtypes().subscribe({
            next: (subtypes) => resolve('Tipo: ' + (subtypes.find((s) => s.id === sid)?.name ?? '—')),
            error: () => resolve(null),
          });
        }),
      );
    }
    if (this.filters.from) {
      const from = new Date(this.filters.from).toLocaleDateString('es-CO');
      const to = this.filters.to ? new Date(this.filters.to).toLocaleDateString('es-CO') : from;
      parts.push(Promise.resolve(`Fechas: ${from} – ${to}`));
    }

    Promise.all(parts).then((resolved) => {
      const text = resolved.filter((p): p is string => !!p).join(' · ');
      this.drillDownLabel.set(text || null);
    });
  }

  clearDrillDownFilters(): void {
    this.filters.areaId = undefined;
    this.filters.locationId = undefined;
    this.filters.room = undefined;
    this.filters.subtypeId = undefined;
    this.filters.from = undefined;
    this.filters.to = undefined;
    this.drillDownLabel.set(null);
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    this.page.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.casesService
      .list({ ...this.filters, page: this.page(), pageSize: this.pageSize })
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.totalPages.set(res.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onSearchChange(): void {
    this.page.set(1);
    this.load();
  }

  sortBy(field: string): void {
    if (this.filters.sortBy === field) {
      this.filters.sortDir = this.filters.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.filters.sortBy = field;
      this.filters.sortDir = 'asc';
    }
    this.load();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.load();
  }

  openDetail(id: string): void {
    this.router.navigate(['/casos', id]);
  }

  pageTitle(): string {
    if (this.fixedType === 'QUEJA') return 'Quejas';
    if (this.fixedType === 'SOLICITUD') return 'Solicitudes';
    return 'Casos';
  }
}
