import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService } from '../../core/services/reports.service';
import { CaseFilters } from '../../core/services/cases.service';
import { CatalogsService } from '../../core/services/catalogs.service';
import { Area, Responsible } from '../../core/models/domain.models';
import { dayEndIso, dayStartIso, daysAgoCO, rangeDays, todayCO } from '../../core/utils/date-range.util';

type ReportKind = 'general' | 'pending' | 'byArea' | 'byResponsible' | 'resolutionTime';
type ColDef = [key: string, header: string];

// Deben coincidir con los límites del backend (reports.service.ts).
const MAX_RANGE_DAYS = 366;
const PREVIEW_LIMIT = 300;
const EXPORT_LIMIT = 5000;

// Cada tipo de reporte sabe cuál es su endpoint de exportación en el
// backend (/reports/<path>/export) y el nombre de archivo sugerido.
const REPORT_EXPORT_INFO: Record<
  ReportKind,
  { path: 'cases' | 'pending' | 'by-area' | 'by-responsible' | 'resolution-time'; filename: string }
> = {
  general: { path: 'cases', filename: 'reporte-casos' },
  pending: { path: 'pending', filename: 'reporte-pendientes' },
  byArea: { path: 'by-area', filename: 'reporte-por-area' },
  byResponsible: { path: 'by-responsible', filename: 'reporte-por-responsable' },
  resolutionTime: { path: 'resolution-time', filename: 'reporte-tiempos-resolucion' },
};

const GENERAL_COLS: ColDef[] = [
  ['caseNumber', 'Número'], ['type', 'Tipo'], ['status', 'Estado'], ['priority', 'Prioridad'],
  ['description', 'Descripción'],
];
const PENDING_COLS: ColDef[] = [
  ['caseNumber', 'Número'], ['status', 'Estado'], ['priority', 'Prioridad'], ['description', 'Descripción'],
];
const BY_AREA_COLS: ColDef[] = [
  ['area_name', 'Área'], ['total', 'Total'], ['resueltos', 'Resueltos'], ['pendientes', 'Pendientes'],
  ['avg_hours', 'Horas prom.'],
];
const BY_RESPONSIBLE_COLS: ColDef[] = [
  ['responsible_name', 'Responsable'], ['total', 'Total'], ['resueltos', 'Resueltos'],
  ['pendientes', 'Pendientes'], ['avg_hours', 'Horas prom.'],
];
const RESOLUTION_COLS: ColDef[] = [
  ['caseNumber', 'Caso'], ['createdAt', 'Creación'], ['closedAt', 'Cierre'], ['durationHours', 'Duración (h)'],
];

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Reportes</h2>
    <p class="note">
      Elige el rango de fechas (máximo {{ maxRangeDays }} días) y presiona <strong>Consultar</strong>.
      Las consultas y exportaciones se limitan a ese rango.
    </p>

    <div class="card report-filters">
      <!-- Bloque 1: qué reporte y con qué filtros -->
      <div class="filters-grid">
        <label class="field field-wide">
          <span>Reporte</span>
          <select [(ngModel)]="activeReport" (ngModelChange)="onReportChange()">
            <option value="general">Reporte general</option>
            <option value="pending">Pendientes (Sin resolver / En proceso)</option>
            <option value="byArea">Por área</option>
            <option value="byResponsible">Por responsable</option>
            <option value="resolutionTime">Tiempos de resolución</option>
          </select>
        </label>

        <label class="field">
          <span>Desde</span>
          <input type="date" [(ngModel)]="dateFrom" [attr.max]="dateTo || today" />
        </label>

        <label class="field">
          <span>Hasta</span>
          <input type="date" [(ngModel)]="dateTo" [attr.min]="dateFrom || null" [attr.max]="today" />
        </label>

        <label class="field">
          <span>Área</span>
          <select [(ngModel)]="areaId" (ngModelChange)="onAreaChange()">
            <option value="">Todas las áreas</option>
            <option *ngFor="let a of areas()" [value]="a.id">{{ a.name }}</option>
          </select>
        </label>

        <label class="field" *ngIf="usesResponsible()">
          <span>Responsable</span>
          <select [(ngModel)]="responsibleId" [disabled]="!areaId">
            <option value="">{{ areaId ? 'Todos los responsables' : 'Elige un área primero' }}</option>
            <option *ngFor="let r of responsibles()" [value]="r.id">{{ r.fullName }}</option>
          </select>
        </label>
      </div>

      <div class="quick-ranges">
        <span class="quick-ranges-label">Rango rápido:</span>
        <button class="chip" type="button" (click)="setRange('today')">Hoy</button>
        <button class="chip" type="button" (click)="setRange('7d')">7 días</button>
        <button class="chip" type="button" (click)="setRange('30d')">30 días</button>
        <button class="chip" type="button" (click)="setRange('month')">Este mes</button>
      </div>

      <hr class="divider" />

      <!-- Bloque 2: acciones. Izquierda = consultar/limpiar, derecha = exportar -->
      <div class="actions">
        <div class="actions-group">
          <button class="btn btn-primary" type="button" (click)="query()" [disabled]="loading() || !!rangeError">
            {{ loading() ? 'Consultando...' : 'Consultar' }}
          </button>
          <button class="btn btn-outline" type="button" (click)="clearFilters()" [disabled]="loading()">
            Quitar filtros
          </button>
        </div>

        <div class="actions-group">
          <button
            class="btn btn-export btn-excel"
            type="button"
            (click)="exportFile('excel')"
            [disabled]="exporting() || !!rangeError"
            title="Exportar a Excel"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <g stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none">
                <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="2.4" />
                <path d="M3.2 9h17.6M3.2 15h17.6M9 3.2v17.6M15 3.2v17.6" stroke-width="1.2" />
              </g>
            </svg>
            Excel
          </button>
          <button
            class="btn btn-export btn-csv"
            type="button"
            (click)="exportFile('csv')"
            [disabled]="exporting() || !!rangeError"
            title="Exportar a CSV"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none">
                <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="2.4" />
                <path d="M7.5 9h.01M7.5 12h.01M7.5 15h.01M12 9h.01M12 12h.01M12 15h.01M16.5 9h.01M16.5 12h.01M16.5 15h.01" stroke-width="2.2" />
              </g>
            </svg>
            CSV
          </button>
          <button
            class="btn btn-export btn-pdf"
            type="button"
            (click)="exportFile('pdf')"
            [disabled]="exporting() || !!rangeError"
            title="Exportar a PDF"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <g stroke="#fff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" fill="none">
                <path d="M6.5 3h7l4 4v13.2a.8.8 0 0 1-.8.8H6.5a.8.8 0 0 1-.8-.8V3.8a.8.8 0 0 1 .8-.8Z" />
                <path d="M13.5 3v4h4" />
                <path d="M8.3 13h7.4M8.3 16.6h4.8" stroke-width="1.3" />
              </g>
            </svg>
            PDF
          </button>
        </div>
      </div>

      <p class="form-error" *ngIf="rangeError">{{ rangeError }}</p>
      <p class="form-error" *ngIf="errorMessage()">{{ errorMessage() }}</p>
    </div>

    <div class="card table-card">
      <div *ngIf="loading()" style="padding:20px">
        <div class="skeleton" style="height:36px;margin-bottom:8px" *ngFor="let i of [1,2,3,4,5]"></div>
      </div>

      <table class="data-table responsive-table" *ngIf="!loading() && rows().length > 0">
        <thead>
          <tr>
            <th *ngFor="let col of columns()">{{ col }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows()">
            <td *ngFor="let key of columnKeys(); let i = index" [attr.data-label]="columns()[i]">{{ cell(row, key) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="empty-state" *ngIf="!loading() && !queried()">
        Elige los filtros y presiona <strong>Consultar</strong> para ver el reporte.
      </div>
      <div class="empty-state" *ngIf="!loading() && queried() && rows().length === 0">
        No existen resultados para los filtros seleccionados.
      </div>
    </div>

    <p class="note" *ngIf="truncated()">
      Se muestran los primeros {{ previewLimit }} resultados. Acota el rango o los filtros, o usa
      <strong>Exportar</strong> para obtener el reporte completo (hasta {{ exportLimit }} casos).
    </p>
  `,
  styles: [`
    .note { font-size: 13px; color: var(--color-text-muted); margin: 6px 0 14px; }

    .report-filters { display: flex; flex-direction: column; gap: 14px; margin-bottom: 16px; }

    .filters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; }

    .field { display: flex; flex-direction: column; gap: 5px; min-width: 0; font-size: 12px; font-weight: 600; color: var(--color-text-muted); }
    .field select, .field input {
      width: 100%; padding: 9px 10px; font-size: 14px; font-weight: 400;
      border: 1px solid var(--color-border); border-radius: var(--radius-sm);
      background: var(--color-surface); color: var(--color-text);
    }
    .field-wide { grid-column: span 1; }

    .quick-ranges { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .quick-ranges-label { font-size: 12px; color: var(--color-text-muted); margin-right: 2px; }
    .chip {
      border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text);
      border-radius: 999px; padding: 5px 14px; font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .chip:hover { background: var(--color-primary-light); color: #fff; border-color: transparent; }

    .divider { border: none; border-top: 1px solid var(--color-border); margin: 0; }

    .actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
    .actions-group { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

    .btn-export {
      display: inline-flex; align-items: center; gap: 6px; border: none; border-radius: var(--radius-sm);
      padding: 9px 14px; font-size: 13px; font-weight: 700; cursor: pointer;
    }
    .btn-export:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-excel { background: #1c7d4d; color: #fff; }
    .btn-excel:hover:not(:disabled) { background: #166840; }
    .btn-pdf { background: #c62f2f; color: #fff; }
    .btn-pdf:hover:not(:disabled) { background: #a92626; }
    .btn-csv { background: transparent; color: var(--color-text); border: 1px solid var(--color-border); }
    .btn-csv:hover:not(:disabled) { background: var(--color-bg); }

    .form-error { color: var(--color-status-sin-resolver, #dc2626); font-size: 13px; margin: 0; }

    :host-context([data-theme='dark']) input[type='date'] { color-scheme: dark; }

    @media (max-width: 768px) {
      .field-wide { grid-column: 1 / -1; }
      .actions { flex-direction: column; align-items: stretch; }
      .actions-group { justify-content: center; }
      .actions-group .btn, .actions-group .btn-export { flex: 1 1 auto; justify-content: center; }
    }
  `],
})
export class ReportsComponent {
  readonly maxRangeDays = MAX_RANGE_DAYS;
  readonly previewLimit = PREVIEW_LIMIT;
  readonly exportLimit = EXPORT_LIMIT;
  readonly today = todayCO();

  activeReport: ReportKind = 'general';
  // Por defecto: últimos 7 días (hoy incluido). No se consulta nada hasta
  // que el usuario presiona "Consultar".
  dateFrom = daysAgoCO(6);
  dateTo = todayCO();
  areaId = '';
  responsibleId = '';

  areas = signal<Area[]>([]);
  responsibles = signal<Responsible[]>([]);

  loading = signal(false);
  exporting = signal(false);
  queried = signal(false);
  truncated = signal(false);
  errorMessage = signal<string | null>(null);
  rows = signal<any[]>([]);
  columns = signal<string[]>([]);
  columnKeys = signal<string[]>([]);

  constructor(
    private reportsService: ReportsService,
    private catalogsService: CatalogsService,
  ) {
    // Todas las áreas (también las inactivas): los reportes históricos deben
    // poder filtrar por un área que ya no esté activa.
    this.catalogsService.getAreas(false).subscribe((areas) => this.areas.set(areas));
  }

  // El filtro de responsable no aplica al reporte "por área".
  usesResponsible(): boolean {
    return this.activeReport !== 'byArea';
  }

  private isDetailReport(): boolean {
    return this.activeReport === 'general' || this.activeReport === 'pending' || this.activeReport === 'resolutionTime';
  }

  // Mensaje de validación del rango, o null si es válido.
  get rangeError(): string | null {
    if (!this.dateFrom || !this.dateTo) return 'Elige la fecha inicial y la final.';
    if (this.dateFrom > this.dateTo) return 'La fecha inicial no puede ser posterior a la final.';
    if (rangeDays(this.dateFrom, this.dateTo) > MAX_RANGE_DAYS) {
      return `El rango máximo es de ${MAX_RANGE_DAYS} días. Acórtalo para continuar.`;
    }
    return null;
  }

  setRange(kind: 'today' | '7d' | '30d' | 'month'): void {
    const today = todayCO();
    this.dateTo = today;
    if (kind === 'today') this.dateFrom = today;
    if (kind === '7d') this.dateFrom = daysAgoCO(6);
    if (kind === '30d') this.dateFrom = daysAgoCO(29);
    if (kind === 'month') this.dateFrom = today.slice(0, 8) + '01';
  }

  // Al cambiar de reporte se limpian los resultados: hay que volver a consultar.
  onReportChange(): void {
    this.rows.set([]);
    this.queried.set(false);
    this.truncated.set(false);
    this.errorMessage.set(null);
  }

  // El responsable depende del área elegida (mismo patrón que el formulario de casos).
  onAreaChange(): void {
    this.responsibleId = '';
    this.responsibles.set([]);
    if (this.areaId) {
      this.catalogsService.getResponsiblesByArea(this.areaId).subscribe((r) => this.responsibles.set(r));
    }
  }

  // Quita área, responsable y rango de fechas (vuelven a sus valores por
  // defecto) y limpia el resultado mostrado en pantalla; hay que volver a
  // presionar "Consultar".
  clearFilters(): void {
    this.areaId = '';
    this.responsibleId = '';
    this.responsibles.set([]);
    this.dateFrom = daysAgoCO(6);
    this.dateTo = todayCO();
    this.rows.set([]);
    this.columns.set([]);
    this.columnKeys.set([]);
    this.queried.set(false);
    this.truncated.set(false);
    this.errorMessage.set(null);
  }

  private buildFilters(): CaseFilters {
    const filters: CaseFilters = {
      from: dayStartIso(this.dateFrom),
      to: dayEndIso(this.dateTo),
    };
    if (this.areaId) filters.areaId = this.areaId;
    if (this.responsibleId && this.usesResponsible()) filters.responsibleId = this.responsibleId;
    return filters;
  }

  query(): void {
    if (this.rangeError) return;
    this.errorMessage.set(null);
    this.loading.set(true);
    const filters = this.buildFilters();
    const fail = async (err: unknown) => {
      this.loading.set(false);
      this.errorMessage.set(await this.readError(err));
    };

    const handlers: Record<ReportKind, () => void> = {
      general: () =>
        this.reportsService.general(filters).subscribe({ next: (r) => this.setData(r, GENERAL_COLS), error: fail }),
      pending: () =>
        this.reportsService.pending(filters).subscribe({ next: (r) => this.setData(r, PENDING_COLS), error: fail }),
      byArea: () =>
        this.reportsService.byArea(filters).subscribe({ next: (r) => this.setData(r, BY_AREA_COLS), error: fail }),
      byResponsible: () =>
        this.reportsService
          .byResponsible(filters)
          .subscribe({ next: (r) => this.setData(r, BY_RESPONSIBLE_COLS), error: fail }),
      resolutionTime: () =>
        this.reportsService
          .resolutionTime(filters)
          .subscribe({ next: (r) => this.setData(r, RESOLUTION_COLS), error: fail }),
    };
    handlers[this.activeReport]();
  }

  private setData(rows: any[], colDefs: ColDef[]): void {
    this.rows.set(rows);
    this.columnKeys.set(colDefs.map((c) => c[0]));
    this.columns.set(colDefs.map((c) => c[1]));
    this.truncated.set(this.isDetailReport() && rows.length >= PREVIEW_LIMIT);
    this.queried.set(true);
    this.loading.set(false);
  }

  // Formato de celdas en pantalla: fechas en hora Colombia, promedios con 1 decimal.
  cell(row: any, key: string): string {
    const value = row[key];
    if (value === null || value === undefined || value === '') return '—';
    if ((key === 'createdAt' || key === 'closedAt') && typeof value === 'string') {
      return new Date(value).toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        dateStyle: 'short',
        timeStyle: 'short',
      });
    }
    if (key === 'avg_hours') return Number(value).toFixed(1);
    return String(value);
  }

  exportFile(format: 'csv' | 'excel' | 'pdf'): void {
    if (this.rangeError) return;
    const info = REPORT_EXPORT_INFO[this.activeReport];
    this.errorMessage.set(null);
    this.exporting.set(true);
    this.reportsService.export(info.path, this.buildFilters(), format).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ext = format === 'excel' ? 'xlsx' : format;
        a.href = url;
        a.download = `${info.filename}_${this.dateFrom}_${this.dateTo}.${ext}`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: async (err) => {
        this.exporting.set(false);
        this.errorMessage.set(await this.readError(err));
      },
    });
  }

  // Extrae el mensaje de error del backend (en exportación llega dentro de un Blob).
  private async readError(err: any): Promise<string> {
    const fallback = 'No se pudo generar el reporte. Intenta de nuevo o acota los filtros.';
    try {
      const body = err?.error instanceof Blob ? JSON.parse(await err.error.text()) : err?.error;
      const message = body?.message ?? body?.error?.message;
      return Array.isArray(message) ? message.join(' ') : (message ?? fallback);
    } catch {
      return fallback;
    }
  }
}
