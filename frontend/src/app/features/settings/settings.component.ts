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
      Las 5 tarjetas comparten la MISMA estructura: título + ayuda corta +
      formulario arriba (tamaño natural, .card-top), y la lista de elementos
      abajo (.catalog-list, con tope de alto y scroll propio - nunca empuja
      ni recorta el formulario de arriba).

      Vista PC (>= 769px): cuadrícula FIJA de 3 columnas iguales
      (grid-template-columns: repeat(3, 1fr), no auto-fit), con las 5
      tarjetas en el mismo orden del markup, así que el propio flujo del
      grid arma 2 líneas bien organizadas:
        fila 1 → Ubicaciones · Áreas · Responsables
        fila 2 → Tipos de queja/solicitud · Plataformas de reseñas
      Las 5 tarjetas tienen el mismo ancho (1fr c/u) y el mismo alto mínimo
      (min-height, nunca una altura fija que recorte contenido): como los
      textos de ayuda se mantuvieron cortos (1 línea) a propósito, en la
      práctica las 5 terminan con el mismo tamaño visual sin importar
      cuántos ítems tenga cada lista - el exceso de ítems se desplaza
      dentro de su propio espacio (.catalog-list) en vez de estirar o
      recortar la tarjeta.

      Vista móvil (< 769px): una sola columna, en cascada, con el alto
      NATURAL de cada tarjeta y de su lista (sin min-height ni scroll
      interno) - cada una ocupa lo que necesite y la página fluye completa,
      como se veía antes de introducir alturas fijas.

      Orden: primero los catálogos que alimentan el formulario de Casos, en
      el mismo orden en que se eligen al crear uno (ubicación → área →
      responsable → tipo), y al final el único catálogo del módulo de
      Reseñas (Plataformas), que no afecta el formulario de Casos.
    -->
    <div class="settings-grid">
      <div class="card">
        <div class="card-top">
          <h4>Ubicaciones</h4>
          <div class="form-field">
            <label>Nueva ubicación</label>
            <input placeholder="Ej. Torre Caimán" [(ngModel)]="newLocation" />
          </div>
          <button class="btn btn-primary btn-sm add-btn" (click)="addLocation()">Agregar</button>
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
        <div class="card-top">
          <h4>Áreas</h4>
          <div class="form-field">
            <label>Nueva área</label>
            <input placeholder="Ej. Mantenimiento" [(ngModel)]="newArea" />
          </div>
          <button class="btn btn-primary btn-sm add-btn" (click)="addArea()">Agregar</button>
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
        <div class="card-top">
          <h4>Responsables</h4>
          <p class="card-hint">A quién se le puede asignar un caso dentro de un área.</p>

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
          <button class="btn btn-primary btn-sm add-btn" (click)="addResponsible()" [disabled]="!selectedAreaForResponsible">
            Agregar responsable
          </button>
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
        <div class="card-top">
          <h4>Tipos de queja/solicitud</h4>
          <p class="card-hint">Opciones que aparecen al elegir un área en el formulario de casos.</p>

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
            <input placeholder="Ej. Conexión a internet" [(ngModel)]="newSubtype" />
          </div>
          <button class="btn btn-primary btn-sm add-btn" (click)="addSubtype()" [disabled]="!selectedAreaForSubtype">
            Agregar
          </button>
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
        <div class="card-top">
          <h4>Plataformas de reseñas</h4>
          <p class="card-hint">Booking, Expedia, Google y otras fuentes de reseñas de huéspedes.</p>
          <div class="form-field">
            <label>Nueva plataforma</label>
            <input placeholder="Ej. Booking" [(ngModel)]="newReviewPlatform" />
          </div>
          <button class="btn btn-primary btn-sm add-btn" (click)="addReviewPlatform()">Agregar</button>
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

    // Mobile-first: una sola columna, en cascada. El alto de cada tarjeta
    // es el natural (sin fijar), así que cada una ocupa lo que necesite y
    // la página fluye normal - igual que se veía antes de fijar alturas.
    .settings-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .card {
      display: flex;
      flex-direction: column;
      padding: 20px;
    }

    // Todo lo que no es la lista (título, ayuda, campos, botón "Agregar"):
    // tamaño natural, nunca se encoge.
    .card-top { flex: 0 0 auto; }

    h4 { margin-bottom: 4px; }
    .card-hint { margin: 0 0 14px; }

    .form-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .form-field label { font-size: 12px; font-weight: 600; color: var(--color-text-muted); }
    .form-field input,
    .form-field select {
      width: 100%; min-width: 0; padding: 9px 10px; font-size: 14px;
      border: 1px solid var(--color-border); border-radius: var(--radius-sm);
      background: var(--color-surface); color: var(--color-text);
    }

    // Único caso de 2 campos lado a lado (Nombre+WhatsApp, Área+Tipo): con
    // flex-wrap bajan a su propia línea si no caben, nunca se salen de la
    // tarjeta. min-width:0 en cada input/select es lo que permite que de
    // verdad se encojan en vez de imponer un ancho mínimo propio -eso era
    // lo que antes rompía el layout en pantallas angostas.
    .field-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .field-row .form-field { flex: 1 1 160px; min-width: 0; }

    // El botón "Agregar" siempre en su propia línea, mismo tamaño y
    // alineado a la izquierda en las 5 tarjetas (nunca pegado a un input:
    // así el bloque de formulario luce igual en todas).
    .add-btn { align-self: flex-start; margin-top: 2px; }

    // Lista de elementos: en móvil fluye con alto natural (ver media query
    // de abajo para el tope + scroll interno, que solo aplica en PC).
    .catalog-list {
      list-style: none;
      padding: 0;
      margin: 14px 0 0;
      border-top: 1px solid var(--color-border);
    }
    .catalog-list li {
      display: flex; justify-content: space-between; align-items: center; gap: 10px;
      padding: 9px 2px; border-bottom: 1px solid var(--color-border);
    }
    .catalog-list li span { overflow-wrap: anywhere; }
    .catalog-list-empty { color: var(--color-text-muted); border-bottom: none; font-size: 13px; }

    // Vista PC: cuadrícula FIJA de 3 columnas (no auto-fit) para que las 5
    // tarjetas queden organizadas en 2 líneas bien definidas - fila 1:
    // Ubicaciones/Áreas/Responsables, fila 2: Tipos de queja-solicitud/
    // Plataformas de reseñas (esta última deja la 3ra columna vacía, no se
    // estira). min-height (no height fija) es a propósito: pone un piso
    // común para que las 5 luzcan del mismo tamaño, pero si algún contenido
    // llegara a necesitar más espacio, la tarjeta crece en vez de recortar
    // o solapar texto. El tope real de tamaño lo pone la lista
    // (max-height + scroll propio), no la tarjeta completa.
    @media (min-width: 769px) {
      .settings-grid { grid-template-columns: repeat(3, 1fr); }
      .card { min-height: 460px; }
      .catalog-list { flex: 1 1 auto; min-height: 0; max-height: 230px; overflow-y: auto; }
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
