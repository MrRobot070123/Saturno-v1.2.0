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
      Orden: primero los catálogos que alimentan el formulario de Casos
      (ubicación → área → responsable → tipo de queja/solicitud, el mismo
      orden en que se eligen al crear un caso), y al final, aparte, el único
      catálogo que pertenece al módulo de Reseñas (no a Casos).
      Cada campo usa .form-field (etiqueta arriba, igual que el resto de la
      app) en vez de solo un placeholder: así ningún campo depende de tener
      espacio de sobra para no verse cortado, y en móvil cada tarjeta ocupa
      todo el ancho sin que ningún campo se salga de su tarjeta.
    -->
    <div class="settings-grid">
      <div class="card">
        <h4>Ubicaciones</h4>
        <div class="form-field">
          <label>Nueva ubicación</label>
          <div class="field-row">
            <input placeholder="Ej. Torre Caimán" [(ngModel)]="newLocation" />
            <button class="btn btn-primary btn-sm" (click)="addLocation()">Agregar</button>
          </div>
        </div>
        <ul class="catalog-list">
          <li *ngFor="let l of locations()">
            {{ l.name }}
            <button class="btn btn-outline btn-sm" (click)="toggleLocation(l)">
              {{ l.isActive ? 'Desactivar' : 'Activar' }}
            </button>
          </li>
        </ul>
      </div>

      <div class="card">
        <h4>Áreas</h4>
        <div class="form-field">
          <label>Nueva área</label>
          <div class="field-row">
            <input placeholder="Ej. Mantenimiento" [(ngModel)]="newArea" />
            <button class="btn btn-primary btn-sm" (click)="addArea()">Agregar</button>
          </div>
        </div>
        <ul class="catalog-list">
          <li *ngFor="let a of areas()">
            {{ a.name }}
            <button class="btn btn-outline btn-sm" (click)="toggleArea(a)">
              {{ a.isActive ? 'Desactivar' : 'Activar' }}
            </button>
          </li>
        </ul>
      </div>

      <div class="card">
        <h4>Responsables</h4>
        <p class="card-hint">A quién se le puede asignar un caso dentro de cada área.</p>

        <div class="form-field">
          <label>Área</label>
          <select [(ngModel)]="selectedAreaForResponsible" (ngModelChange)="loadResponsibles()">
            <option value="">Selecciona un área</option>
            <option *ngFor="let a of areas()" [value]="a.id">{{ a.name }}</option>
          </select>
        </div>

        <div class="field-row">
          <div class="form-field">
            <label>Nombre del responsable</label>
            <input placeholder="Ej. Juan Pérez" [(ngModel)]="newResponsible" />
          </div>
          <div class="form-field">
            <label>WhatsApp (opcional)</label>
            <input placeholder="Ej. 573001234567" [(ngModel)]="newResponsiblePhone" />
          </div>
        </div>
        <button class="btn btn-primary btn-sm" (click)="addResponsible()" [disabled]="!selectedAreaForResponsible">
          Agregar responsable
        </button>

        <ul class="catalog-list">
          <li *ngFor="let r of responsibles()">
            {{ r.fullName }}
            <button class="btn btn-outline btn-sm" (click)="toggleResponsible(r)">
              {{ r.isActive ? 'Desactivar' : 'Activar' }}
            </button>
          </li>
          <li *ngIf="selectedAreaForResponsible && responsibles().length === 0" class="catalog-list-empty">
            Sin responsables registrados todavía para esta área.
          </li>
        </ul>
      </div>

      <div class="card">
        <h4>Tipos de queja/solicitud</h4>
        <p class="card-hint">
          Qué opciones aparecen al elegir un área en el formulario de casos (ej. área "Sistemas" + "Queja" →
          "Conexión a internet").
        </p>

        <div class="field-row">
          <div class="form-field">
            <label>Área</label>
            <select [(ngModel)]="selectedAreaForSubtype" (ngModelChange)="loadSubtypesForSelection()">
              <option value="">Selecciona un área</option>
              <option *ngFor="let a of areas()" [value]="a.id">{{ a.name }}</option>
            </select>
          </div>
          <div class="form-field">
            <label>Tipo de caso</label>
            <select [(ngModel)]="selectedTypeForSubtype" (ngModelChange)="loadSubtypesForSelection()">
              <option value="QUEJA">Queja</option>
              <option value="SOLICITUD">Solicitud</option>
            </select>
          </div>
        </div>

        <div class="form-field">
          <label>Nombre del tipo</label>
          <div class="field-row">
            <input placeholder="Ej. Conexión a internet" [(ngModel)]="newSubtype" />
            <button class="btn btn-primary btn-sm" (click)="addSubtype()" [disabled]="!selectedAreaForSubtype">
              Agregar
            </button>
          </div>
        </div>

        <ul class="catalog-list">
          <li *ngFor="let s of subtypesForSelection()">
            {{ s.name }}
            <button class="btn btn-outline btn-sm" (click)="toggleSubtype(s)">
              {{ s.isActive ? 'Desactivar' : 'Activar' }}
            </button>
          </li>
          <li *ngIf="selectedAreaForSubtype && subtypesForSelection().length === 0" class="catalog-list-empty">
            Sin tipos registrados todavía para esta combinación.
          </li>
        </ul>
      </div>

      <div class="card card-reviews">
        <h4>Plataformas de reseñas</h4>
        <p class="card-hint">
          Booking, Expedia, Google y otras plataformas desde donde se digitan reseñas de huéspedes (módulo de
          Reseñas, no afecta el formulario de Casos).
        </p>
        <div class="form-field">
          <label>Nueva plataforma</label>
          <div class="field-row">
            <input placeholder="Ej. Booking" [(ngModel)]="newReviewPlatform" />
            <button class="btn btn-primary btn-sm" (click)="addReviewPlatform()">Agregar</button>
          </div>
        </div>
        <ul class="catalog-list">
          <li *ngFor="let p of reviewPlatforms()">
            {{ p.name }}
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

    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
      align-items: start;
    }

    // El catálogo de reseñas es conceptualmente aparte (no alimenta el
    // formulario de Casos): ocupa el ancho completo al final para que no
    // quede mezclado visualmente entre los catálogos de Casos.
    .card-reviews { grid-column: 1 / -1; }

    h4 { margin-bottom: 4px; }
    .card-hint { margin: 0 0 14px; }

    // Un campo con su etiqueta arriba (mismo patrón que el resto de la app:
    // case-form, review-form). Nunca depende de espacio "de sobra" para no
    // cortarse, por eso reemplaza los inputs que solo tenían placeholder.
    .form-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .form-field label { font-size: 12px; font-weight: 600; color: var(--color-text-muted); }
    .form-field input,
    .form-field select {
      width: 100%; min-width: 0; padding: 9px 10px;
      border: 1px solid var(--color-border); border-radius: var(--radius-sm);
      background: var(--color-surface); color: var(--color-text);
    }

    // Fila de 2 campos lado a lado (ej. Nombre + WhatsApp, o input + botón
    // "Agregar"). flex-wrap es la pieza clave: si no caben uno junto al
    // otro, bajan a su propia línea en vez de salirse de la tarjeta -el bug
    // que rompía el diseño antes-, y cada input tiene min-width:0 para
    // poder encogerse de verdad en vez de imponer un ancho mínimo propio.
    .field-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
    .field-row .form-field { flex: 1 1 160px; min-width: 0; margin-bottom: 0; }
    .field-row input { flex: 1; min-width: 0; padding: 9px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); }
    .field-row button { flex: 0 0 auto; }

    .catalog-list { list-style: none; padding: 0; margin: 12px 0 0; max-height: 320px; overflow-y: auto; }
    .catalog-list li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--color-border); }
    .catalog-list-empty { color: var(--color-text-muted); border-bottom: none; }

    @media (max-width: 600px) {
      .settings-grid { grid-template-columns: 1fr; }
      .field-row { flex-direction: column; align-items: stretch; }
      .field-row button { width: 100%; justify-content: center; }
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
