import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CasesService } from '../../../core/services/cases.service';
import { CatalogsService } from '../../../core/services/catalogs.service';
import { AuthService } from '../../../core/services/auth.service';
import { SentenceCaseDirective } from '../../../core/directives/sentence-case.directive';
import { NotificationBannerService } from '../../../core/services/notification-banner.service';
import { Area, CaseHistoryEntry, CaseItem, Responsible } from '../../../core/models/domain.models';

@Component({
  selector: 'app-case-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, SentenceCaseDirective],
  templateUrl: './case-detail.component.html',
  styleUrl: './case-detail.component.scss',
})
export class CaseDetailComponent implements OnInit {
  loading = signal(true);
  caseItem = signal<CaseItem | null>(null);
  history = signal<CaseHistoryEntry[]>([]);
  areas = signal<Area[]>([]);
  responsibles = signal<Responsible[]>([]);

  assignAreaId = '';
  assignResponsibleId = '';
  resolutionNote = '';
  reopenReason = '';
  actionLoading = signal(false);

  private caseId!: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private casesService: CasesService,
    private catalogsService: CatalogsService,
    public auth: AuthService,
    private banner: NotificationBannerService,
  ) {}

  ngOnInit(): void {
    this.caseId = this.route.snapshot.paramMap.get('id')!;
    this.catalogsService.getAreas().subscribe((a) => this.areas.set(a));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.casesService.getById(this.caseId).subscribe({
      next: (c) => {
        this.caseItem.set(c);
        this.assignAreaId = c.area?.id ?? '';
        if (this.assignAreaId) this.loadResponsibles(this.assignAreaId);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.casesService.getHistory(this.caseId).subscribe((h) => this.history.set(h));
  }

  loadResponsibles(areaId: string): void {
    this.catalogsService.getResponsiblesByArea(areaId).subscribe((r) => this.responsibles.set(r));
  }

  onAssignAreaChange(): void {
    this.assignResponsibleId = '';
    if (this.assignAreaId) this.loadResponsibles(this.assignAreaId);
  }

  assign(): void {
    if (!this.assignAreaId || !this.assignResponsibleId) return;
    this.actionLoading.set(true);
    this.casesService.assign(this.caseId, this.assignAreaId, this.assignResponsibleId).subscribe({
      next: () => {
        this.banner.showSuccess('Caso asignado correctamente.');
        this.actionLoading.set(false);
        this.load();
      },
      error: () => this.actionLoading.set(false),
    });
  }

  moveToInProgress(): void {
    this.actionLoading.set(true);
    this.casesService.changeStatus(this.caseId, 'EN_PROCESO').subscribe({
      next: () => {
        this.banner.showSuccess('Caso marcado como En proceso.');
        this.actionLoading.set(false);
        this.load();
      },
      error: () => this.actionLoading.set(false),
    });
  }

  close(): void {
    if (!this.resolutionNote || this.resolutionNote.trim().length < 5) {
      this.banner.showError('Debes indicar la observación de solución.');
      return;
    }
    this.actionLoading.set(true);
    this.casesService.close(this.caseId, this.resolutionNote).subscribe({
      next: () => {
        this.banner.showSuccess('Caso resuelto correctamente.');
        this.actionLoading.set(false);
        this.resolutionNote = '';
        this.load();
      },
      error: () => this.actionLoading.set(false),
    });
  }

  reopen(): void {
    if (!this.reopenReason || this.reopenReason.trim().length < 5) {
      this.banner.showError('Debes indicar el motivo de la reapertura.');
      return;
    }
    this.actionLoading.set(true);
    this.casesService.reopen(this.caseId, this.reopenReason).subscribe({
      next: () => {
        this.banner.showSuccess('Caso reabierto correctamente.');
        this.actionLoading.set(false);
        this.reopenReason = '';
        this.load();
      },
      error: () => this.actionLoading.set(false),
    });
  }

  goBack(): void {
    this.router.navigate(['/casos']);
  }
}
