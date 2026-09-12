import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layout/layout.component').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'casos',
        loadComponent: () =>
          import('./features/cases/cases-list/cases-list.component').then((m) => m.CasesListComponent),
      },
      {
        path: 'casos/nuevo',
        loadComponent: () =>
          import('./features/cases/case-form/case-form.component').then((m) => m.CaseFormComponent),
      },
      {
        path: 'casos/:id',
        loadComponent: () =>
          import('./features/cases/case-detail/case-detail.component').then(
            (m) => m.CaseDetailComponent,
          ),
      },
      // /quejas y /solicitudes reutilizan el MISMO listado de casos,
      // preseleccionando el filtro "type" (regla #14/#42): no hay
      // componentes ni lógica duplicada.
      {
        path: 'quejas',
        loadComponent: () =>
          import('./features/cases/cases-list/cases-list.component').then((m) => m.CasesListComponent),
        data: { fixedType: 'QUEJA' },
      },
      {
        path: 'solicitudes',
        loadComponent: () =>
          import('./features/cases/cases-list/cases-list.component').then((m) => m.CasesListComponent),
        data: { fixedType: 'SOLICITUD' },
      },
      {
        path: 'reportes',
        loadComponent: () =>
          import('./features/reports/reports.component').then((m) => m.ReportsComponent),
        canActivate: [permissionGuard('report:view')],
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./features/users/users.component').then((m) => m.UsersComponent),
        canActivate: [permissionGuard('user:manage')],
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
        canActivate: [permissionGuard('catalog:manage')],
      },
      {
        path: 'auditoria',
        loadComponent: () =>
          import('./features/audit/audit.component').then((m) => m.AuditComponent),
        canActivate: [permissionGuard('audit:view')],
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
