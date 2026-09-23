import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CaseFilters } from './cases.service';

// Todos los reportes reciben filtros (from/to obligatorios en el backend;
// areaId y responsibleId opcionales). Solo se envían los campos con valor,
// porque el backend rechaza parámetros no declarados (forbidNonWhitelisted).
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private base = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  private buildParams(filters: CaseFilters): HttpParams {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return params;
  }

  general(filters: CaseFilters): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/cases`, { params: this.buildParams(filters) });
  }

  pending(filters: CaseFilters): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/pending`, { params: this.buildParams(filters) });
  }

  byArea(filters: CaseFilters): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/by-area`, { params: this.buildParams(filters) });
  }

  byResponsible(filters: CaseFilters): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/by-responsible`, { params: this.buildParams(filters) });
  }

  resolutionTime(filters: CaseFilters): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/resolution-time`, {
      params: this.buildParams(filters),
    });
  }

  // La generación del archivo ocurre en el backend (regla #22); el frontend
  // solo dispara la descarga del blob resultante sin bloquear la UI.
  // Un único método sirve para los 5 reportes (regla #42, no duplicar
  // lógica): cada uno solo difiere en el path del endpoint.
  export(
    endpointPath: 'cases' | 'pending' | 'by-area' | 'by-responsible' | 'resolution-time',
    filters: CaseFilters,
    format: 'csv' | 'excel' | 'pdf',
  ): Observable<Blob> {
    const params = this.buildParams(filters).set('format', format);
    return this.http.get(`${this.base}/${endpointPath}/export`, { params, responseType: 'blob' });
  }
}
