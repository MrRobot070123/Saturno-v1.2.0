import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ReviewsService } from '../../../core/services/reviews.service';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { Area, CaseSubtype, Location, ReviewPlatform } from '../../../core/models/domain.models';
import { NotificationBannerService } from '../../../core/services/notification-banner.service';
import { generateRoomsForTower } from '../../../core/utils/rooms.util';
import { SentenceCaseDirective } from '../../../core/directives/sentence-case.directive';

interface PendingFinding {
  subtypeId: string;
  subtypeName: string;
  areaName: string;
  excerpt: string;
}

@Component({
  selector: 'app-review-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SentenceCaseDirective],
  template: `
    <div class="review-form-page">
      <div class="review-form-card">
        <h2>Nueva reseña</h2>
        <p class="review-form-subtitle">
          Digita una reseña dejada en Booking, Expedia, Google u otra plataforma.
        </p>

        <form [formGroup]="form" (ngSubmit)="submit()" class="review-form">
          <section class="form-section">
            <h4 class="form-section-title">Datos de la estancia</h4>
            <div class="form-row cols-2">
              <div class="form-field">
                <label>Fecha de estancia</label>
                <input type="date" formControlName="stayDate" />
                <span class="form-error" *ngIf="form.get('stayDate')?.touched && form.get('stayDate')?.invalid">
                  La fecha de estancia es obligatoria
                </span>
              </div>
              <div class="form-field">
                <label>Nombre del huésped o empresa</label>
                <input formControlName="guestName" placeholder="Ej. Juan Pérez" />
                <span class="form-error" *ngIf="form.get('guestName')?.touched && form.get('guestName')?.invalid">
                  Indica el nombre del huésped
                </span>
              </div>
            </div>

            <div class="form-row cols-2">
              <div class="form-field">
                <label>Ubicación</label>
                <select formControlName="locationId">
                  <option value="" disabled>Selecciona una ubicación</option>
                  <option *ngFor="let l of locations()" [value]="l.id">{{ l.name }}</option>
                </select>
              </div>
              <div class="form-field" *ngIf="rooms().length > 0">
                <label>Habitación</label>
                <select formControlName="room">
                  <option value="">Selecciona la habitación</option>
                  <option *ngFor="let r of rooms()" [value]="r">{{ r }}</option>
                </select>
              </div>
            </div>

            <div class="form-field">
              <label>Plataforma</label>
              <select formControlName="platformId">
                <option value="" disabled>Selecciona la plataforma</option>
                <option *ngFor="let p of platforms()" [value]="p.id">{{ p.name }}</option>
              </select>
              <span class="form-error" *ngIf="form.get('platformId')?.touched && form.get('platformId')?.invalid">
                Debes seleccionar la plataforma
              </span>
            </div>
          </section>

          <section class="form-section">
            <h4 class="form-section-title">Observación del huésped</h4>
            <div class="form-field">
              <textarea
                formControlName="rawText"
                appSentenceCase
                rows="4"
                placeholder="Pega aquí el texto completo de la reseña..."
              ></textarea>
              <span class="form-error" *ngIf="form.get('rawText')?.touched && form.get('rawText')?.invalid">
                Pega la observación completa (mínimo 10 caracteres)
              </span>
            </div>
          </section>

          <section class="form-section">
            <h4 class="form-section-title">
              Tipo(s) de queja identificados
              <span class="form-hint-small">(opcional por ahora — la clasificación automática llega en la Fase B)</span>
            </h4>

            <div class="finding-add-row">
              <select [(ngModel)]="pendingAreaId" [ngModelOptions]="{ standalone: true }" (ngModelChange)="loadSubtypesForPending()">
                <option value="">Área</option>
                <option *ngFor="let a of areas()" [value]="a.id">{{ a.name }}</option>
              </select>
              <select [(ngModel)]="pendingSubtypeId" [ngModelOptions]="{ standalone: true }">
                <option value="">Tipo de queja</option>
                <option *ngFor="let s of pendingSubtypes()" [value]="s.id">{{ s.name }}</option>
              </select>
              <input
                [(ngModel)]="pendingExcerpt"
                [ngModelOptions]="{ standalone: true }"
                placeholder="Fragmento del texto que lo sustenta"
              />
              <button type="button" class="btn btn-outline btn-sm" (click)="addFinding()">Agregar</button>
            </div>

            <ul class="pending-findings-list" *ngIf="pendingFindings().length > 0">
              <li *ngFor="let f of pendingFindings(); let i = index">
                <strong>{{ f.areaName }}</strong> · {{ f.subtypeName }} — <em>"{{ f.excerpt }}"</em>
                <button type="button" class="btn-link" (click)="removeFinding(i)">Quitar</button>
              </li>
            </ul>
          </section>

          <div class="review-form-actions">
            <button class="btn btn-primary btn-lg" type="submit" [disabled]="submitting()">
              {{ submitting() ? 'Guardando...' : '✓ Guardar reseña' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .review-form-page { display:flex; justify-content:center; padding:16px; }
    .review-form-card { max-width:720px; width:100%; }
    .form-section { margin-bottom:20px; }
    .form-section-title { margin-bottom:10px; }
    .form-hint-small { font-weight:400; font-size:12px; color:var(--color-text-muted); }
    .form-row.cols-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .form-field { display:flex; flex-direction:column; gap:4px; margin-bottom:10px; }
    .form-field input, .form-field select, .form-field textarea {
      padding:8px 10px; border:1px solid var(--color-border); border-radius:6px;
    }
    .form-error { color:var(--color-danger, #c62f2f); font-size:12px; }
    .finding-add-row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
    .finding-add-row select, .finding-add-row input { padding:8px 10px; border:1px solid var(--color-border); border-radius:6px; }
    .finding-add-row input { flex:1; min-width:180px; }
    .pending-findings-list { list-style:none; padding:0; margin:0; }
    .pending-findings-list li { padding:8px 0; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center; gap:8px; }
    .btn-link { background:none; border:none; color:var(--color-danger, #c62f2f); cursor:pointer; font-size:13px; }
    .review-form-actions { margin-top:16px; }

    @media (max-width: 768px) {
      .review-form-page { padding: 12px; }
      .form-row.cols-2 { grid-template-columns: 1fr; }
      .finding-add-row select,
      .finding-add-row input,
      .finding-add-row button { flex: 1 1 100%; }
      .review-form-actions .btn { width: 100%; justify-content: center; }
    }
  `],
})
export class ReviewFormComponent implements OnInit {
  private fb = inject(FormBuilder);

  submitting = signal(false);
  locations = signal<Location[]>([]);
  areas = signal<Area[]>([]);
  platforms = signal<ReviewPlatform[]>([]);
  rooms = signal<string[]>([]);
  pendingSubtypes = signal<CaseSubtype[]>([]);
  pendingFindings = signal<PendingFinding[]>([]);

  pendingAreaId = '';
  pendingSubtypeId = '';
  pendingExcerpt = '';

  form = this.fb.group({
    stayDate: ['', Validators.required],
    locationId: ['', Validators.required],
    room: [''],
    guestName: ['', [Validators.required, Validators.minLength(2)]],
    platformId: ['', Validators.required],
    rawText: ['', [Validators.required, Validators.minLength(10)]],
  });

  constructor(
    private reviewsService: ReviewsService,
    private catalogsService: CatalogsService,
    private router: Router,
    private banner: NotificationBannerService,
  ) {}

  ngOnInit(): void {
    this.catalogsService.getLocations().subscribe((l) => this.locations.set(l));
    this.catalogsService.getAreas().subscribe((a) => this.areas.set(a));
    this.catalogsService.getReviewPlatforms().subscribe((p) => this.platforms.set(p));

    this.form.get('locationId')?.valueChanges.subscribe((locationId) => {
      this.form.get('room')?.setValue('');
      const location = this.locations().find((l) => l.id === locationId);
      this.rooms.set(location ? generateRoomsForTower(location.name) : []);
    });
  }

  loadSubtypesForPending(): void {
    this.pendingSubtypeId = '';
    this.pendingSubtypes.set([]);
    if (!this.pendingAreaId) return;
    // Las reseñas pueden mencionar quejas o solicitudes; por ahora se
    // buscan solo entre los tipos de QUEJA, que es lo típico en una reseña.
    this.catalogsService.getSubtypes(this.pendingAreaId, 'QUEJA').subscribe((s) => this.pendingSubtypes.set(s));
  }

  addFinding(): void {
    if (!this.pendingSubtypeId || !this.pendingExcerpt.trim()) return;
    const area = this.areas().find((a) => a.id === this.pendingAreaId);
    const subtype = this.pendingSubtypes().find((s) => s.id === this.pendingSubtypeId);
    if (!area || !subtype) return;

    this.pendingFindings.update((list) => [
      ...list,
      { subtypeId: subtype.id, subtypeName: subtype.name, areaName: area.name, excerpt: this.pendingExcerpt.trim() },
    ]);
    this.pendingAreaId = '';
    this.pendingSubtypeId = '';
    this.pendingExcerpt = '';
    this.pendingSubtypes.set([]);
  }

  removeFinding(index: number): void {
    this.pendingFindings.update((list) => list.filter((_, i) => i !== index));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const raw = this.form.getRawValue();
    this.reviewsService
      .create({
        stayDate: `${raw.stayDate}T00:00:00.000Z`,
        locationId: raw.locationId!,
        guestName: raw.guestName!,
        platformId: raw.platformId!,
        rawText: raw.rawText!,
        ...(raw.room ? { room: raw.room } : {}),
        ...(this.pendingFindings().length
          ? { findings: this.pendingFindings().map((f) => ({ subtypeId: f.subtypeId, excerpt: f.excerpt })) }
          : {}),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.banner.showSuccess('Reseña guardada correctamente.');
          this.router.navigate(['/resenas']);
        },
        error: () => this.submitting.set(false),
      });
  }
}