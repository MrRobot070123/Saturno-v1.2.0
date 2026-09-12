import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CasesService } from '../../../core/services/cases.service';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { Area, CaseSubtype, Location } from '../../../core/models/domain.models';
import { NotificationBannerService } from '../../../core/services/notification-banner.service';
import { generateRoomsForTower } from '../../../core/utils/rooms.util';
import { SentenceCaseDirective } from '../../../core/directives/sentence-case.directive';

// El responsable específico (personal en turno) ya NO se elige al crear el
// caso: el proceso es crear -> asignar (con el panel "Asignar responsable"
// del detalle del caso), y esa misma pantalla permite reasignar más
// adelante, incluyendo cuando el caso se reabre.
@Component({
  selector: 'app-case-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SentenceCaseDirective],
  templateUrl: './case-form.component.html',
  styleUrl: './case-form.component.scss',
})
export class CaseFormComponent implements OnInit {
  private fb = inject(FormBuilder);

  submitting = signal(false);
  locations = signal<Location[]>([]);
  areas = signal<Area[]>([]);
  subtypes = signal<CaseSubtype[]>([]);
  rooms = signal<string[]>([]);

  form = this.fb.group({
    type: ['QUEJA', Validators.required],
    locationId: ['', Validators.required],
    room: [''],
    areaId: [''],
    subtypeId: [''],
    priority: ['MEDIA', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10)]],
  });

  constructor(
    private casesService: CasesService,
    private catalogsService: CatalogsService,
    private router: Router,
    private banner: NotificationBannerService,
  ) {}

  ngOnInit(): void {
    this.catalogsService.getLocations().subscribe((l) => this.locations.set(l));
    this.catalogsService.getAreas().subscribe((a) => this.areas.set(a));

    // El "tipo de queja/solicitud" depende del ÁREA elegida (ej. Sistemas +
    // Queja -> "Conexión a internet"; Sistemas + Solicitud -> "Clave wifi"):
    // se recarga también cuando cambia el tipo de caso o el área.
    this.form.get('areaId')?.valueChanges.subscribe(() => this.reloadSubtypes());
    this.form.get('type')?.valueChanges.subscribe(() => this.reloadSubtypes());

    // La "habitación" solo aplica a ubicaciones tipo torre (Caimán/Cayena);
    // se recalcula la lista disponible cada vez que cambia la ubicación.
    this.form.get('locationId')?.valueChanges.subscribe((locationId) => {
      this.form.get('room')?.setValue('');
      const location = this.locations().find((l) => l.id === locationId);
      this.rooms.set(location ? generateRoomsForTower(location.name) : []);
    });
  }

  private reloadSubtypes(): void {
    const areaId = this.form.get('areaId')?.value;
    const type = this.form.get('type')?.value;
    this.form.get('subtypeId')?.setValue('');
    this.subtypes.set([]);
    if (areaId && type) {
      this.catalogsService.getSubtypes(areaId, type as any).subscribe((s) => this.subtypes.set(s));
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const raw = this.form.getRawValue();
    const payload = {
      type: raw.type!,
      locationId: raw.locationId!,
      description: raw.description!,
      priority: raw.priority!,
      ...(raw.room ? { room: raw.room } : {}),
      ...(raw.areaId ? { areaId: raw.areaId } : {}),
      ...(raw.subtypeId ? { subtypeId: raw.subtypeId } : {}),
    };

    this.casesService.create(payload).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.banner.showSuccess(
          `Caso ${created.caseNumber} creado correctamente. Ahora puedes asignarlo a un responsable.`,
        );
        this.router.navigate(['/casos', created.id]);
      },
      error: () => this.submitting.set(false),
    });
  }
}
