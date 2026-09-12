import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CaseHistoryEntry, CaseItem, PaginatedResult } from '../models/domain.models';

export interface CaseFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  status?: string;
  priority?: string;
  areaId?: string;
  locationId?: string;
  responsibleId?: string;
  subtypeId?: string;
  room?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

// Único servicio para el concepto central "Case" (regla #42): las pantallas
// /quejas y /solicitudes de este mismo frontend reutilizan este servicio
// pasando `type` como filtro, en vez de duplicar un ComplaintService y un
// RequestService independientes.
@Injectable({ providedIn: 'root' })
export class CasesService {
  private base = `${environment.apiUrl}/cases`;

  constructor(private http: HttpClient) {}

  list(filters: CaseFilters): Observable<PaginatedResult<CaseItem>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<PaginatedResult<CaseItem>>(this.base, { params });
  }

  getById(id: string): Observable<CaseItem> {
    return this.http.get<CaseItem>(`${this.base}/${id}`);
  }

  getHistory(id: string): Observable<CaseHistoryEntry[]> {
    return this.http.get<CaseHistoryEntry[]>(`${this.base}/${id}/history`);
  }

  create(payload: {
    type: string;
    locationId: string;
    room?: string;
    description: string;
    areaId?: string;
    subtypeId?: string;
    responsibleId?: string;
    priority?: string;
  }): Observable<CaseItem> {
    return this.http.post<CaseItem>(this.base, payload);
  }

  assign(id: string, areaId: string, responsibleId: string): Observable<CaseItem> {
    return this.http.post<CaseItem>(`${this.base}/${id}/assign`, { areaId, responsibleId });
  }

  changeStatus(id: string, status: string, note?: string): Observable<CaseItem> {
    return this.http.post<CaseItem>(`${this.base}/${id}/status`, { status, note });
  }

  close(id: string, resolutionNote: string): Observable<CaseItem> {
    return this.http.post<CaseItem>(`${this.base}/${id}/close`, { resolutionNote });
  }

  reopen(id: string, reason: string): Observable<CaseItem> {
    return this.http.post<CaseItem>(`${this.base}/${id}/reopen`, { reason });
  }
}
