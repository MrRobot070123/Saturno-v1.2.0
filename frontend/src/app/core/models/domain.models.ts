export type CaseType = 'QUEJA' | 'SOLICITUD';
export type CasePriority = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
export type CaseStatus = 'SIN_RESOLVER' | 'EN_PROCESO' | 'RESUELTO' | 'REABIERTO' | 'ANULADO';
export type RoleName = 'ADMINISTRADOR' | 'SUPERVISOR' | 'OPERATIVO';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  hotelId: string;
  roles: RoleName[];
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface Location {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Area {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Responsible {
  id: string;
  fullName: string;
  areaId: string;
  isActive: boolean;
}

export interface CaseSubtype {
  id: string;
  areaId: string;
  type: CaseType;
  name: string;
  isActive: boolean;
  area?: { id: string; name: string };
}

export interface CaseHistoryEntry {
  id: string;
  action: string;
  fromStatus: CaseStatus | null;
  toStatus: CaseStatus | null;
  note: string | null;
  createdAt: string;
  user: { fullName: string };
}

export interface CaseItem {
  id: string;
  caseNumber: string;
  type: CaseType;
  description: string;
  priority: CasePriority;
  status: CaseStatus;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  location: Location;
  room: string | null;
  area: Area | null;
  subtype: CaseSubtype | null;
  responsible: Responsible | null;
  createdBy: { id: string; fullName: string; email: string };
  closedBy: { id: string; fullName: string; email: string } | null;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  caseId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardSummary {
  totalCasos: number;
  totalQuejas: number;
  totalSolicitudes: number;
  sinResolver: number;
  enProceso: number;
  resueltos: number;
  pendientes: number;
  criticos: number;
  delDia: number;
  delaSemana: number;
  delMes: number;
  porcentajeResolucion: number;
  tiempoPromedioResolucionHoras: number | null;
}

export interface ChartSeriesPoint {
  label: string;
  value: number;
  id?: string;
}

export interface DashboardCharts {
  casosPorEstado: ChartSeriesPoint[];
  quejasVsSolicitudes: ChartSeriesPoint[];
  casosPorArea: ChartSeriesPoint[];
  casosPorUbicacion: ChartSeriesPoint[];
  evolucionCasos: ChartSeriesPoint[];
  tiempoPromedioResolucionPorArea: ChartSeriesPoint[];
  casosPorHabitacion: ChartSeriesPoint[];
  casosPorTipoQueja: ChartSeriesPoint[];
}
