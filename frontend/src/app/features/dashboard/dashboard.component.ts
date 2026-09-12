import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Chart, registerables, ChartEvent, ActiveElement } from 'chart.js';
import { DashboardService } from '../../core/services/dashboard.service';
import { CatalogsService } from '../../core/services/catalogs.service';
import { DashboardCharts, DashboardSummary, Area, Location, ChartSeriesPoint } from '../../core/models/domain.models';
import { resolveDateRangeIso, fixedRangeIso } from '../../core/utils/date-range.util';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('statusChart') statusChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('typeChart') typeChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('areaChart') areaChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('locationChart') locationChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('evolutionChart') evolutionChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('resolutionTimeChart') resolutionTimeChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('roomChart') roomChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('subtypeChart') subtypeChartRef!: ElementRef<HTMLCanvasElement>;

  loading = signal(true);
  summary = signal<DashboardSummary | null>(null);
  areas = signal<Area[]>([]);
  locations = signal<Location[]>([]);

  filters = {
    range: 'last_30_days',
    type: '',
    status: '',
    priority: '',
    areaId: '',
    locationId: '',
  };

  private charts: Chart[] = [];
  private viewReady = false;
  private lastChartsData: DashboardCharts | null = null;

  // Cambia el cursor a "mano" al pasar sobre un segmento/barra clicable,
  // para que quede visualmente claro que se puede hacer drill-down.
  private hoverPointer = (evt: ChartEvent, elements: ActiveElement[]) => {
    const target = evt.native?.target as HTMLElement | null;
    if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
  };

  constructor(
    private dashboardService: DashboardService,
    private catalogsService: CatalogsService,
    private router: Router,
  ) {
    this.catalogsService.getAreas().subscribe((areas) => this.areas.set(areas));
    this.catalogsService.getLocations().subscribe((locations) => this.locations.set(locations));
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.loadData();
  }

  ngOnDestroy(): void {
    this.charts.forEach((c) => c.destroy());
  }

  onFilterChange(): void {
    if (this.viewReady) this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const activeFilters = Object.fromEntries(
      Object.entries(this.filters).filter(([, v]) => v !== ''),
    );

    this.dashboardService.getSummary(activeFilters).subscribe((summary) => {
      this.summary.set(summary);
    });

    this.dashboardService.getCharts(activeFilters).subscribe((charts) => {
      this.renderCharts(charts);
      this.loading.set(false);
    });
  }

  // ---------------------------------------------------------------------
  // DRILL-DOWN: cada tarjeta y cada segmento de gráfico navega a /casos
  // con los filtros exactos que explican ese número (regla de negocio
  // pedida por gerencia: todo número debe poder "abrirse" a su detalle).
  // ---------------------------------------------------------------------

  private baseDrillFilters(): Record<string, string> {
    // Traduce los filtros activos del dashboard (rango, tipo, estado, etc.)
    // al mismo lenguaje de filtros que usa la lista de casos, para que el
    // total mostrado en /casos coincida con lo que se ve en el dashboard.
    const out: Record<string, string> = {};
    if (this.filters.type) out['type'] = this.filters.type;
    if (this.filters.status) out['status'] = this.filters.status;
    if (this.filters.priority) out['priority'] = this.filters.priority;
    if (this.filters.areaId) out['areaId'] = this.filters.areaId;
    if (this.filters.locationId) out['locationId'] = this.filters.locationId;

    const dateRange = resolveDateRangeIso(this.filters.range);
    if (dateRange.from) out['from'] = dateRange.from;
    if (dateRange.to) out['to'] = dateRange.to;

    return out;
  }

  goToCases(extra: Record<string, string> = {}): void {
    const queryParams = { ...this.baseDrillFilters(), ...extra };
    this.router.navigate(['/casos'], { queryParams });
  }

  // Para "Del día" / "De la semana" / "Del mes": ignoran el selector de
  // rango del dashboard porque son métricas de fecha fija.
  goToCasesFixedRange(kind: 'day' | 'week' | 'month'): void {
    const { from, to } = fixedRangeIso(kind);
    this.router.navigate(['/casos'], { queryParams: { ...this.baseDrillFilters(), from, to } });
  }

  // Handler genérico de clic para gráficos Chart.js: resuelve el punto de
  // datos clicado contra el arreglo original (que trae label + id) y arma
  // el filtro correspondiente.
  private buildChartClickHandler(
    points: () => ChartSeriesPoint[] | undefined,
    filterKey: string,
  ) {
    return (_evt: ChartEvent, elements: ActiveElement[]) => {
      if (!elements.length) return;
      const point = points()?.[elements[0].index];
      if (!point) return;
      const value = point.id ?? point.label;
      this.goToCases({ [filterKey]: value });
    };
  }


  private renderCharts(data: DashboardCharts): void {
    this.lastChartsData = data;
    this.charts.forEach((c) => c.destroy());
    this.charts = [];

    const statusColors: Record<string, string> = {
      SIN_RESOLVER: '#dc2626',
      EN_PROCESO: '#d97706',
      RESUELTO: '#16a34a',
      REABIERTO: '#7c3aed',
      ANULADO: '#6b7280',
    };

    this.charts.push(
      new Chart(this.statusChartRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: data.casosPorEstado.map((d) => d.label),
          datasets: [
            {
              data: data.casosPorEstado.map((d) => d.value),
              backgroundColor: data.casosPorEstado.map((d) => statusColors[d.label] ?? '#94a3b8'),
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom' } },
          onHover: this.hoverPointer,
          onClick: this.buildChartClickHandler(() => this.lastChartsData?.casosPorEstado, 'status'),
        },
      }),
    );

    this.charts.push(
      new Chart(this.typeChartRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: data.quejasVsSolicitudes.map((d) => d.label),
          datasets: [
            {
              data: data.quejasVsSolicitudes.map((d) => d.value),
              backgroundColor: ['#dc2626', '#2563eb'],
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom' } },
          onHover: this.hoverPointer,
          onClick: this.buildChartClickHandler(() => this.lastChartsData?.quejasVsSolicitudes, 'type'),
        },
      }),
    );

    this.charts.push(
      new Chart(this.areaChartRef.nativeElement, {
        type: 'bar',
        data: {
          labels: data.casosPorArea.map((d) => d.label),
          datasets: [{ label: 'Casos', data: data.casosPorArea.map((d) => d.value), backgroundColor: '#1e3a5f' }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          onHover: this.hoverPointer,
          onClick: this.buildChartClickHandler(() => this.lastChartsData?.casosPorArea, 'areaId'),
        },
      }),
    );

    this.charts.push(
      new Chart(this.locationChartRef.nativeElement, {
        type: 'bar',
        data: {
          labels: data.casosPorUbicacion.map((d) => d.label),
          datasets: [
            { label: 'Casos', data: data.casosPorUbicacion.map((d) => d.value), backgroundColor: '#0ea5a4' },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          onHover: this.hoverPointer,
          onClick: this.buildChartClickHandler(() => this.lastChartsData?.casosPorUbicacion, 'locationId'),
        },
      }),
    );

    this.charts.push(
      new Chart(this.evolutionChartRef.nativeElement, {
        type: 'line',
        data: {
          labels: data.evolucionCasos.map((d) => d.label),
          datasets: [
            {
              label: 'Casos por día',
              data: data.evolucionCasos.map((d) => d.value),
              borderColor: '#1e3a5f',
              backgroundColor: 'rgba(30,58,95,0.1)',
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          onHover: this.hoverPointer,
          onClick: (_evt, elements) => {
            if (!elements.length) return;
            const point = this.lastChartsData?.evolucionCasos[elements[0].index];
            if (!point) return;
            // point.label es 'YYYY-MM-DD': filtra los casos creados ese día exacto.
            const from = `${point.label}T00:00:00.000Z`;
            const to = `${point.label}T23:59:59.999Z`;
            this.router.navigate(['/casos'], { queryParams: { ...this.baseDrillFilters(), from, to } });
          },
        },
      }),
    );

    this.charts.push(
      new Chart(this.resolutionTimeChartRef.nativeElement, {
        type: 'bar',
        data: {
          labels: data.tiempoPromedioResolucionPorArea.map((d) => d.label),
          datasets: [
            {
              label: 'Horas promedio',
              data: data.tiempoPromedioResolucionPorArea.map((d) => d.value),
              backgroundColor: '#d97706',
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          onHover: this.hoverPointer,
          onClick: (_evt, elements) => {
            if (!elements.length) return;
            const point = this.lastChartsData?.tiempoPromedioResolucionPorArea[elements[0].index];
            if (!point) return;
            // Este punto solo trae el nombre del área (no el id): se resuelve
            // contra el catálogo de áreas ya cargado.
            const area = this.areas().find((a) => a.name === point.label);
            this.goToCases({ status: 'RESUELTO', ...(area ? { areaId: area.id } : {}) });
          },
        },
      }),
    );

    this.charts.push(
      new Chart(this.roomChartRef.nativeElement, {
        type: 'bar',
        data: {
          labels: data.casosPorHabitacion.map((d) => d.label),
          datasets: [
            { label: 'Casos', data: data.casosPorHabitacion.map((d) => d.value), backgroundColor: '#7c3aed' },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          onHover: this.hoverPointer,
          onClick: this.buildChartClickHandler(() => this.lastChartsData?.casosPorHabitacion, 'room'),
        },
      }),
    );

    this.charts.push(
      new Chart(this.subtypeChartRef.nativeElement, {
        type: 'bar',
        data: {
          labels: data.casosPorTipoQueja.map((d) => d.label),
          datasets: [
            { label: 'Casos', data: data.casosPorTipoQueja.map((d) => d.value), backgroundColor: '#019cff' },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: { legend: { display: false } },
          onHover: this.hoverPointer,
          onClick: this.buildChartClickHandler(() => this.lastChartsData?.casosPorTipoQueja, 'subtypeId'),
        },
      }),
    );
  }
}
