import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogsService } from '../../core/services/catalogs.service';
import { NotificationBannerService } from '../../core/services/notification-banner.service';
import { Area, CaseSubtype, CaseType, Location, Responsible, ReviewPlatform } from '../../core/models/domain.models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Configuración de catálogos</h2>
    <p class="settings-intro">
      Administra las opciones que verán los usuarios al crear una Queja o Solicitud: en qué
      <strong>ubicación</strong> ocurrió, a qué <strong>área</strong> del hotel corresponde, qué
      <strong>tipo</strong> de queja/solicitud es, y quién es el <strong>responsable</strong> dentro de esa
      área. Desactivar un elemento lo oculta de los formularios nuevos, pero conserva el historial de los
      casos que ya lo usaron.
    </p>

    <!--
      Exactamente el mismo patrón que ya funcionaba bien antes del módulo de
      reseñas (4 tarjetas en una sola fila, auto-ajustadas): ninguna regla
      nueva de "3 columnas forzadas en PC" - esa fue la única pieza no
      probada de los últimos intentos. Solo `auto-fit`, igual que siempre:
      en pantallas anchas pone todas las tarjetas que quepan en una fila
      (con las 5 tarjetas actuales, normalmente las 5 en una sola línea o
      4+1 según el ancho real de la ventana); en celular cae solo a 1
      columna (cascada natural). Ninguna tarjeta tiene alto fijo - es la
      lista (.catalog-list) la que se autolimita con max-height + scroll
      propio, nunca la tarjeta completa.
    -->
    <div class="settings-grid">
      <div class="card">
        <h4>Ubicaciones</h4>
        <div class="add-row">
          <input placeholder="Nueva ubicación" [(ngModel)]="newLocation" />
          <button class="btn btn-primary btn-sm" (click)="addLocation()">Agregar</button>
        </div>
        <ul class="catalog-list">
          <li *ngFor="let l of locations()">
            <span>{{ l.name }}</span>
            <button class="btn btn-outline btn-sm" (click)="toggleLocation(l)">
              {{ l.isActive ? 'Desactivar' : 'Activar' }}
            </button>
          </li>
        </ul>
      </div>

      <div class="card">
        <h4>Áreas</h4>
        <div class="add-row">
          <input placeholder="Nueva área" [(ngModel)]="newArea" />
          <button class="btn btn-primary btn-sm" (click)="addArea()">Agregar</button>
        </div>
        <ul class="catalog-list">
          <li *ngFor="let a of areas()">
            <span>{{ a.name }}</span>
            <button class="btn btn-outline btn-sm" (click)="toggleArea(a)">
              {{ a.isActive ? 'Desactivar' : 'Activar' }}
            </button>
          </li>
        </ul>
      </div>

      <div class="card">
        <h4>Responsables</h4>
        <p class="card-hint">A quién se le puede asignar un caso dentro de un área.</p>
        <div class="add-row add-row-stacked">
          <select [(ngModel)]="selectedAreaForResponsible" (ngModelChange)="loadResponsibles()">
            <option value="">Selecciona un área</option>
            <option *ngFor="let a of areas()" [value]="a.id">{{ a.name }}</option>
          </select>
          <div class="add-row-fields">
            <input placeholder="Nombre del responsable" [(ngModel)]="newResponsible" class="field-name" />
            <input placeholder="WhatsApp (opcional)" [(ngModel)]="newResponsiblePhone" class="field-phone" />
            <button class="btn btn-primary btn-sm" (click)="addResponsible()" [disabled]="!selectedAreaForResponsible">
              Agregar
            </button>
          </div>
        </div>
        <ul class="catalog-list">
          <li *ngFor="let r of responsibles()">
            <span>{{ r.fullName }}</span>
            <button class="btn btn-outline btn-sm" (click)="toggleResponsible(r)">
              {{ r.isActive ? 'Desactivar' : 'Activar' }}
            </button>
          </li>
          <li *ngIf="selectedAreaForResponsible && responsibles().length === 0" class="catalog-list-empty">
            Sin responsables registrados todavía para esta área.
          </li>
          <li *ngIf="!selectedAreaForResponsible" class="catalog-list-empty">
            Selecciona un área para ver sus responsables.
          </li>
        </ul>
      </div>

      <div class="card">
        <h4>Tipos de queja/solicitud</h4>
        <p class="card-hint">Opciones que aparecen al elegir un área en el formulario de casos.</p>
        <div class="add-row add-row-stacked">
          <div class="add-row-fields">
            <select [(ngModel)]="selectedAreaForSubtype" (ngModelChange)="loadSubtypesForSelection()" class="field-grow">
              <option value="">Selecciona un área</option>
              <option *ngFor="let a of areas()" [value]="a.id">{{ a.name }}</option>
            </select>
            <select [(ngModel)]="selectedTypeForSubtype" (ngModelChange)="loadSubtypesForSelection()">
              <option value="QUEJA">Queja</option>
              <option value="SOLICITUD">Solicitud</option>
            </select>
          </div>
          <div class="add-row-fields">
            <input placeholder="Nombre del tipo" [(ngModel)]="newSubtype" class="field-grow" />
            <button class="btn btn-primary btn-sm" (click)="addSubtype()" [disabled]="!selectedAreaForSubtype">
              Agregar
            </button>
          </div>
        </div>
        <ul class="catalog-list">
          <li *ngFor="let s of subtypesForSelection()">
            <span>{{ s.name }}</span>
            <button class="btn btn-outline btn-sm" (click)="toggleSubtype(s)">
              {{ s.isActive ? 'Desactivar' : 'Activar' }}
            </button>
          </li>
          <li *ngIf="selectedAreaForSubtype && subtypesForSelection().length === 0" class="catalog-list-empty">
            Sin tipos registrados todavía para esta combinación.
          </li>
          <li *ngIf="!selectedAreaForSubtype" class="catalog-list-empty">
            Selecciona un área para ver sus tipos.
          </li>
        </ul>
      </div>

      <div class="card">
        <h4>Plataformas de reseñas</h4>
        <p class="card-hint">Booking, Expedia, Google y otras fuentes de reseñas de huéspedes.</p>
        <div class="add-row">
          <input placeholder="Nueva plataforma" [(ngModel)]="newReviewPlatform" />
          <button class="btn btn-primary btn-sm" (click)="addReviewPlatform()">Agregar</button>
        </div>
        <ul class="catalog-list">
          <li *ngFor="let p of reviewPlatforms()">
            <span>{{ p.name }}</span>
            <button class="btn btn-outline btn-sm" (click)="toggleReviewPlatform(p)">
              {{ p.isActive ? 'Desactivar' : 'Activar' }}
            </button>
          </li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .settings-intro { color: var(--color-text-muted); max-width: 900px; }

    // auto-fit puro, sin ninguna regla adicional: en PC pone todas las
    // tarjetas que quepan en una fila, en celular cae solo a 1 columna.
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }

    h4 { margin: 0 0 4px; }
    .card-hint { margin: 0 0 12px; color: var(--color-text-muted); font-size: 13px; }

    .add-row { display: flex; gap: 8px; margin-bottom: 12px; }
    .add-row input { flex: 1; min-width: 0; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); }
    .add-row select { padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); }

    // Lista de elementos: SIN alto fijo en la tarjeta - es la lista la que
    // se autolimita (max-height + scroll propio). Así nunca recorta ni
    // empuja el formulario de arriba, y la tarjeta crece lo justo.
    .catalog-list { list-style: none; padding: 0; margin: 0; max-height: 300px; overflow-y: auto; }
    .catalog-list li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 2px; border-bottom: 1px solid var(--color-border); }
    .catalog-list li span { overflow-wrap: anywhere; }
    .catalog-list-empty { color: var(--color-text-muted); border-bottom: none; font-size: 13px; }

    // Filas con varios campos (Responsables: área + nombre + WhatsApp; Tipos:
    // área + tipo, luego nombre). flex-wrap evita que un campo "empuje" el
    // layout fuera de la tarjeta, y min-width:0 permite que los inputs se
    // encojan de verdad en vez de imponer un ancho mínimo propio.
    .add-row-stacked { flex-direction: column; align-items: stretch; gap: 8px; }
    .add-row-fields { display: flex; flex-wrap: wrap; gap: 8px; }
    .add-row-fields input,
    .add-row-fields select { min-width: 0; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); }
    .add-row-fields .field-name { flex: 2 1 160px; }
    .add-row-fields .field-phone { flex: 1 1 140px; }
    .add-row-fields .field-grow { flex: 1 1 160px; }
    .add-row-fields button { flex: 0 0 auto; }

    @media (max-width: 480px) {
      .add-row-fields .field-name,
      .add-row-fields .field-phone,
      .add-row-fields .field-grow,
      .add-row-fields select,
      .add-row-fields button { flex: 1 1 100%; }
    }
  `],
})
export class SettingsComponent {
  locations = signal<Location[]>([]);
  areas = signal<Area[]>([]);
  responsibles = signal<Responsible[]>([]);
  subtypesForSelection = signal<CaseSubtype[]>([]);

  newLocation = '';
  newArea = '';
  newResponsible = '';
  newSubtype = '';
  newResponsiblePhone = '';
  newReviewPlatform = '';
  reviewPlatforms = signal<ReviewPlatform[]>([]);
  selectedAreaForResponsible = '';
  selectedAreaForSubtype = '';
  selectedTypeForSubtype: CaseType = 'QUEJA';

  constructor(private catalogsService: CatalogsService, private banner: NotificationBannerService) {
    this.loadLocations();
    this.loadAreas();
    this.loadReviewPlatforms();
  }

  loadLocations(): void {
    this.catalogsService.getLocations(false).subscribe((l) => this.locations.set(l));
  }

  loadAreas(): void {
    this.catalogsService.getAreas(false).subscribe((a) => this.areas.set(a));
  }

  loadResponsibles(): void {
    if (!this.selectedAreaForResponsible) {
      this.responsibles.set([]);
      return;
    }
    this.catalogsService.getResponsiblesByArea(this.selectedAreaForResponsible).subscribe((r) => this.responsibles.set(r));
  }

  loadSubtypesForSelection(): void {
    if (!this.selectedAreaForSubtype) {
      this.subtypesForSelection.set([]);
      return;
    }
    this.catalogsService
      .getSubtypes(this.selectedAreaForSubtype, this.selectedTypeForSubtype, false)
      .subscribe((s) => this.subtypesForSelection.set(s));
  }

  addLocation(): void {
    if (!this.newLocation.trim()) return;
    this.catalogsService.createLocation(this.newLocation.trim()).subscribe(() => {
      this.newLocation = '';
      this.banner.showSuccess('Ubicación agregada.');
      this.loadLocations();
    });
  }

  toggleLocation(l: Location): void {
    this.catalogsService.updateLocation(l.id, { isActive: !l.isActive }).subscribe(() => this.loadLocations());
  }

  addArea(): void {
    if (!this.newArea.trim()) return;
    this.catalogsService.createArea(this.newArea.trim()).subscribe(() => {
      this.newArea = '';
      this.banner.showSuccess('Área agregada.');
      this.loadAreas();
    });
  }

  toggleArea(a: Area): void {
    this.catalogsService.updateArea(a.id, { isActive: !a.isActive }).subscribe(() => this.loadAreas());
  }

  addResponsible(): void {
    if (!this.newResponsible.trim() || !this.selectedAreaForResponsible) return;
    this.catalogsService
      .createResponsible(this.selectedAreaForResponsible, this.newResponsible.trim(), this.newResponsiblePhone.trim() || undefined)
      .subscribe(() => {
        this.newResponsible = '';
        this.newResponsiblePhone = '';
        this.banner.showSuccess('Responsable agregado.');
        this.loadResponsibles();
      });
  }

  toggleResponsible(r: Responsible): void {
    this.catalogsService.updateResponsible(r.id, { isActive: !r.isActive }).subscribe(() => this.loadResponsibles());
  }

  addSubtype(): void {
    if (!this.newSubtype.trim() || !this.selectedAreaForSubtype) return;
    this.catalogsService
      .createSubtype(this.selectedAreaForSubtype, this.selectedTypeForSubtype, this.newSubtype.trim())
      .subscribe(() => {
        this.newSubtype = '';
        this.banner.showSuccess('Tipo agregado.');
        this.loadSubtypesForSelection();
      });
  }

  toggleSubtype(s: CaseSubtype): void {
    this.catalogsService.updateSubtype(s.id, { isActive: !s.isActive }).subscribe(() => this.loadSubtypesForSelection());
  }

  loadReviewPlatforms(): void {
    this.catalogsService.getReviewPlatforms(false).subscribe((p) => this.reviewPlatforms.set(p));
  }

  addReviewPlatform(): void {
    if (!this.newReviewPlatform.trim()) return;
    this.catalogsService.createReviewPlatform(this.newReviewPlatform.trim()).subscribe(() => {
      this.newReviewPlatform = '';
      this.banner.showSuccess('Plataforma agregada.');
      this.loadReviewPlatforms();
    });
  }

  toggleReviewPlatform(p: ReviewPlatform): void {
    this.catalogsService.updateReviewPlatform(p.id, { isActive: !p.isActive }).subscribe(() => this.loadReviewPlatforms());
  }
}
