import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogsService } from '../../core/services/catalogs.service';
import { NotificationBannerService } from '../../core/services/notification-banner.service';
import { Area, CaseSubtype, CaseType, Location, Responsible } from '../../core/models/domain.models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Configuración de catálogos</h2>
    <p style="color:var(--color-text-muted)">
      Administra las opciones que verán los usuarios al crear una Queja o Solicitud: en qué
      <strong>ubicación</strong> ocurrió, a qué <strong>área</strong> del hotel corresponde, qué
      <strong>tipo</strong> de queja/solicitud es, y quién es el <strong>responsable</strong> dentro de esa
      área. Desactivar un elemento lo oculta de los formularios nuevos, pero conserva el historial de los
      casos que ya lo usaron.
    </p>

    <div class="settings-grid">
      <div class="card">
        <h4>Ubicaciones</h4>
        <div class="add-row">
          <input placeholder="Nueva ubicación" [(ngModel)]="newLocation" />
          <button class="btn btn-primary btn-sm" (click)="addLocation()">Agregar</button>
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
        <div class="add-row">
          <input placeholder="Nueva área" [(ngModel)]="newArea" />
          <button class="btn btn-primary btn-sm" (click)="addArea()">Agregar</button>
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
        <div class="add-row" style="flex-direction:column; align-items:stretch; gap:8px">
          <select [(ngModel)]="selectedAreaForResponsible" (ngModelChange)="loadResponsibles()">
            <option value="">Selecciona un área</option>
            <option *ngFor="let a of areas()" [value]="a.id">{{ a.name }}</option>
          </select>
          <div style="display:flex; gap:8px">
            <input placeholder="Nombre del responsable" [(ngModel)]="newResponsible" />
            <button class="btn btn-primary btn-sm" (click)="addResponsible()" [disabled]="!selectedAreaForResponsible">
              Agregar
            </button>
          </div>
        </div>
        <ul class="catalog-list">
          <li *ngFor="let r of responsibles()">
            {{ r.fullName }}
            <button class="btn btn-outline btn-sm" (click)="toggleResponsible(r)">
              {{ r.isActive ? 'Desactivar' : 'Activar' }}
            </button>
          </li>
        </ul>
      </div>

      <div class="card">
        <h4>Tipos de queja/solicitud</h4>
        <p class="card-hint" style="margin-top:0">
          Define qué opciones aparecen al elegir un área en el formulario de casos (ej. área "Sistemas" +
          "Queja" → "Conexión a internet").
        </p>
        <div class="add-row" style="flex-direction:column; align-items:stretch; gap:8px">
          <div style="display:flex; gap:8px">
            <select [(ngModel)]="selectedAreaForSubtype" (ngModelChange)="loadSubtypesForSelection()" style="flex:1">
              <option value="">Selecciona un área</option>
              <option *ngFor="let a of areas()" [value]="a.id">{{ a.name }}</option>
            </select>
            <select [(ngModel)]="selectedTypeForSubtype" (ngModelChange)="loadSubtypesForSelection()">
              <option value="QUEJA">Queja</option>
              <option value="SOLICITUD">Solicitud</option>
            </select>
          </div>
          <div style="display:flex; gap:8px">
            <input placeholder="Nombre del tipo (ej. Conexión a internet)" [(ngModel)]="newSubtype" />
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
          <li *ngIf="selectedAreaForSubtype && subtypesForSelection().length === 0" style="color:var(--color-text-muted); border-bottom:none">
            Sin tipos registrados todavía para esta combinación.
          </li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .settings-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px,1fr)); gap:16px; }
    .add-row { display:flex; gap:8px; margin-bottom:12px; }
    .add-row input { flex:1; padding:8px 10px; border:1px solid var(--color-border); border-radius:6px; }
    .add-row select { padding:8px 10px; border:1px solid var(--color-border); border-radius:6px; }
    .catalog-list { list-style:none; padding:0; margin:0; max-height:320px; overflow-y:auto; }
    .catalog-list li { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--color-border); }
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
  selectedAreaForResponsible = '';
  selectedAreaForSubtype = '';
  selectedTypeForSubtype: CaseType = 'QUEJA';

  constructor(private catalogsService: CatalogsService, private banner: NotificationBannerService) {
    this.loadLocations();
    this.loadAreas();
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
    this.catalogsService.createResponsible(this.selectedAreaForResponsible, this.newResponsible.trim()).subscribe(() => {
      this.newResponsible = '';
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
}
