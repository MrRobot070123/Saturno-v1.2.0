import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardCharts, DashboardSummary } from '../models/domain.models';

export interface DashboardFilters {
  range?: string;
  from?: string;
  to?: string;
  type?: string;
  status?: string;
  priority?: string;
  areaId?: string;
  responsibleId?: string;
  locationId?: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private base = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) {}

  private buildParams(filters: DashboardFilters): HttpParams {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params = params.set(key, value);
    });
    return params;
  }

  getSummary(filters: DashboardFilters): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.base}/summary`, {
      params: this.buildParams(filters),
    });
  }

  getCharts(filters: DashboardFilters): Observable<DashboardCharts> {
    return this.http.get<DashboardCharts>(`${this.base}/charts`, {
      params: this.buildParams(filters),
    });
  }
}
