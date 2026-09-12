import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsersService, UserItem } from '../../core/services/admin.services';
import { NotificationBannerService } from '../../core/services/notification-banner.service';
import { RoleName } from '../../core/models/domain.models';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <h2>Usuarios</h2>

    <div class="card" style="margin-bottom:16px">
      <h4>Crear usuario</h4>
      <form [formGroup]="form" (ngSubmit)="submit()" class="form-row">
        <div class="form-field">
          <label>Nombre completo</label>
          <input formControlName="fullName" [class.field-invalid]="isInvalid(form, 'fullName')" />
          <small class="field-error" *ngIf="isInvalid(form, 'fullName')">
            El nombre es obligatorio (mínimo 3 caracteres).
          </small>
        </div>
        <div class="form-field">
          <label>Correo</label>
          <input formControlName="email" type="email" [class.field-invalid]="isInvalid(form, 'email')" />
          <small class="field-error" *ngIf="isInvalid(form, 'email')">
            Ingresa un correo válido.
          </small>
        </div>
        <div class="form-field">
          <label>Contraseña temporal</label>
          <input formControlName="password" type="password" [class.field-invalid]="isInvalid(form, 'password')" />
          <small class="field-error" *ngIf="isInvalid(form, 'password')">
            Mínimo 8 caracteres.
          </small>
        </div>
        <div class="form-field">
          <label>Rol</label>
          <select formControlName="role">
            <option value="ADMINISTRADOR">Administrador</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="OPERATIVO">Operativo</option>
          </select>
        </div>
        <button class="btn btn-primary" type="submit" [disabled]="submitting()">
          {{ submitting() ? 'Creando...' : 'Crear usuario' }}
        </button>
      </form>
      <p class="form-hint" *ngIf="form.invalid && form.touched">
        Revisa los campos marcados en rojo: el usuario no se puede crear hasta que todos sean válidos.
      </p>
    </div>

    <div class="card" style="padding:0; overflow-x:auto">
      <table class="data-table" *ngIf="!loading() && items().length > 0">
        <thead>
          <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Área</th><th>Activo</th><th>Último acceso</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let u of items()">
            <ng-container *ngIf="editingId() === u.id; else viewRow">
              <td><input [formControl]="editForm.controls.fullName" class="inline-input" /></td>
              <td><input [formControl]="editForm.controls.email" type="email" class="inline-input" /></td>
              <td>
                <select [formControl]="editForm.controls.role" class="inline-input">
                  <option value="ADMINISTRADOR">Administrador</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="OPERATIVO">Operativo</option>
                </select>
              </td>
              <td>{{ u.area?.name ?? '—' }}</td>
              <td>{{ u.isActive ? 'Sí' : 'No' }}</td>
              <td>{{ u.lastLoginAt ? (u.lastLoginAt | date: 'short') : 'Nunca' }}</td>
              <td class="actions-cell">
                <button class="btn btn-primary btn-sm" (click)="saveEdit(u)" [disabled]="editForm.invalid || savingEdit()">
                  {{ savingEdit() ? 'Guardando...' : 'Guardar' }}
                </button>
                <button class="btn btn-outline btn-sm" (click)="cancelEdit()">Cancelar</button>
              </td>
            </ng-container>
            <ng-template #viewRow>
              <td>{{ u.fullName }}</td>
              <td>{{ u.email }}</td>
              <td>{{ u.roles[0]?.role?.name }}</td>
              <td>{{ u.area?.name ?? '—' }}</td>
              <td>{{ u.isActive ? 'Sí' : 'No' }}</td>
              <td>{{ u.lastLoginAt ? (u.lastLoginAt | date: 'short') : 'Nunca' }}</td>
              <td class="actions-cell">
                <button class="btn btn-outline btn-sm" (click)="startEdit(u)">Editar</button>
                <button class="btn btn-outline btn-sm" (click)="toggleActive(u)">
                  {{ u.isActive ? 'Desactivar' : 'Activar' }}
                </button>
              </td>
            </ng-template>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" *ngIf="!loading() && items().length === 0">No hay usuarios registrados.</div>
    </div>
  `,
  styles: [`
    .form-row { display:flex; gap:12px; flex-wrap:wrap; align-items:flex-start }
    .form-field { display:flex; flex-direction:column; gap:4px; min-width:180px; }
    .field-invalid { border-color: var(--color-status-sin-resolver) !important; }
    .field-error { color: var(--color-status-sin-resolver); font-size:12px; }
    .form-hint { color: var(--color-status-sin-resolver); font-size:13px; margin-top:10px; margin-bottom:0; }
    .inline-input { width:100%; padding:6px 8px; border:1px solid var(--color-border); border-radius:6px; }
    .actions-cell { display:flex; gap:6px; flex-wrap:wrap; }
  `],
})
export class UsersComponent {
  private fb = inject(FormBuilder);

  loading = signal(true);
  submitting = signal(false);
  savingEdit = signal(false);
  items = signal<UserItem[]>([]);
  editingId = signal<string | null>(null);

  form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['OPERATIVO' as RoleName, Validators.required],
  });

  editForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['OPERATIVO' as RoleName, Validators.required],
  });

  constructor(
    private usersService: UsersService,
    private banner: NotificationBannerService,
  ) {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.usersService.list().subscribe((res) => {
      this.items.set(res.items);
      this.loading.set(false);
    });
  }

  isInvalid(form: typeof this.form, field: string): boolean {
    const control = form.get(field);
    return !!control && control.invalid && (control.touched || form.touched);
  }

  submit(): void {
    if (this.form.invalid) {
      // Antes esto fallaba en silencio: no se veía ningún mensaje ni error.
      // Ahora se marcan los campos como "touched" para que aparezcan los
      // mensajes de validación en rojo bajo cada campo inválido.
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const raw = this.form.getRawValue();
    this.usersService
      .create({ fullName: raw.fullName!, email: raw.email!, password: raw.password!, roles: [raw.role!] })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.banner.showSuccess('Usuario creado correctamente.');
          this.form.reset({ role: 'OPERATIVO' });
          this.load();
        },
        error: () => this.submitting.set(false),
      });
  }

  toggleActive(user: UserItem): void {
    this.usersService.update(user.id, { isActive: !user.isActive }).subscribe(() => this.load());
  }

  startEdit(user: UserItem): void {
    this.editingId.set(user.id);
    this.editForm.setValue({
      fullName: user.fullName,
      email: user.email,
      role: user.roles[0]?.role?.name ?? 'OPERATIVO',
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(user: UserItem): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    this.savingEdit.set(true);
    const raw = this.editForm.getRawValue();
    this.usersService
      .update(user.id, { fullName: raw.fullName, email: raw.email, roles: [raw.role] })
      .subscribe({
        next: () => {
          this.savingEdit.set(false);
          this.editingId.set(null);
          this.banner.showSuccess('Usuario actualizado correctamente.');
          this.load();
        },
        error: () => this.savingEdit.set(false),
      });
  }
}
