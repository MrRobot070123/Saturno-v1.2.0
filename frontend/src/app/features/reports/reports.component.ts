import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService } from '../../core/services/reports.service';

type ReportKind = 'general' | 'pending' | 'byArea' | 'byResponsible' | 'resolutionTime';

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

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Reportes</h2>

    <div class="filters-bar" style="margin-bottom:16px; display:flex; gap:10px; flex-wrap:wrap">
      <select [(ngModel)]="activeReport" (ngModelChange)="load()">
        <option value="general">Reporte general</option>
        <option value="pending">Pendientes (Sin resolver / En proceso)</option>
        <option value="byArea">Por área</option>
        <option value="byResponsible">Por responsable</option>
        <option value="resolutionTime">Tiempos de resolución</option>
      </select>

      <button class="btn btn-outline btn-sm" (click)="exportFile('excel')" [disabled]="exporting()">
        Exportar Excel
      </button>
      <button class="btn btn-outline btn-sm" (click)="exportFile('csv')" [disabled]="exporting()">
        Exportar CSV
      </button>
      <button class="btn btn-outline btn-sm" (click)="exportFile('pdf')" [disabled]="exporting()">
        Exportar PDF
      </button>
    </div>

    <div class="card" style="overflow-x:auto; padding:0">
      <div *ngIf="loading()" style="padding:20px">
        <div class="skeleton" style="height:36px;margin-bottom:8px" *ngFor="let i of [1,2,3,4,5]"></div>
      </div>

      <table class="data-table" *ngIf="!loading() && rows().length > 0">
        <thead>
          <tr>
            <th *ngFor="let col of columns()">{{ col }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows()">
            <td *ngFor="let col of columnKeys()">{{ row[col] }}</td>
          </tr>
        </tbody>
      </table>

      <div class="empty-state" *ngIf="!loading() && rows().length === 0">
        No existen resultados para este reporte.
      </div>
    </div>
  `,
})
export class ReportsComponent {
  activeReport: ReportKind = 'general';
  loading = signal(true);
  exporting = signal(false);
  rows = signal<any[]>([]);
  columns = signal<string[]>([]);
  columnKeys = signal<string[]>([]);

  constructor(private reportsService: ReportsService) {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const handlers: Record<ReportKind, () => void> = {
      general: () =>
        this.reportsService.general({}).subscribe((r) => this.setData(r, [
          ['caseNumber', 'Número'], ['type', 'Tipo'], ['status', 'Estado'], ['priority', 'Prioridad'],
          ['description', 'Descripción'],
        ])),
      pending: () =>
        this.reportsService.pending({}).subscribe((r) => this.setData(r, [
          ['caseNumber', 'Número'], ['status', 'Estado'], ['priority', 'Prioridad'], ['description', 'Descripción'],
        ])),
      byArea: () =>
        this.reportsService.byArea().subscribe((r) => this.setData(r, [
          ['area_name', 'Área'], ['total', 'Total'], ['resueltos', 'Resueltos'], ['pendientes', 'Pendientes'], ['avg_hours', 'Horas prom.'],
        ])),
      byResponsible: () =>
        this.reportsService.byResponsible().subscribe((r) => this.setData(r, [
          ['responsible_name', 'Responsable'], ['total', 'Total'], ['resueltos', 'Resueltos'], ['pendientes', 'Pendientes'], ['avg_hours', 'Horas prom.'],
        ])),
      resolutionTime: () =>
        this.reportsService.resolutionTime({}).subscribe((r) => this.setData(r, [
          ['caseNumber', 'Caso'], ['createdAt', 'Creación'], ['closedAt', 'Cierre'], ['durationHours', 'Duración (h)'],
        ])),
    };
    handlers[this.activeReport]();
  }

  private setData(rows: any[], colDefs: [string, string][]): void {
    this.rows.set(rows);
    this.columnKeys.set(colDefs.map((c) => c[0]));
    this.columns.set(colDefs.map((c) => c[1]));
    this.loading.set(false);
  }

  exportFile(format: 'csv' | 'excel' | 'pdf'): void {
    const info = REPORT_EXPORT_INFO[this.activeReport];
    this.exporting.set(true);
    this.reportsService.export(info.path, {}, format).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ext = format === 'excel' ? 'xlsx' : format;
        a.href = url;
        a.download = `${info.filename}.${ext}`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => this.exporting.set(false),
    });
  }
}
