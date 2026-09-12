import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Area, CaseSubtype, CaseType, Location, Responsible } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class CatalogsService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getLocations(onlyActive = true): Observable<Location[]> {
    return this.http.get<Location[]>(`${this.base}/locations`, {
      params: { onlyActive: String(onlyActive) },
    });
  }

  getAreas(onlyActive = true): Observable<Area[]> {
    return this.http.get<Area[]>(`${this.base}/areas`, {
      params: { onlyActive: String(onlyActive) },
    });
  }

  // Responsables disponibles para un área específica: el formulario de casos
  // vuelve a llamar este endpoint cada vez que el usuario cambia el área
  // seleccionada (regla #7: "la lista debe actualizarse dinámicamente").
  getResponsiblesByArea(areaId: string): Observable<Responsible[]> {
    return this.http.get<Responsible[]>(`${this.base}/areas/${areaId}/responsibles`);
  }

  createLocation(name: string): Observable<Location> {
    return this.http.post<Location>(`${this.base}/locations`, { name });
  }

  updateLocation(id: string, data: { name?: string; isActive?: boolean }): Observable<Location> {
    return this.http.patch<Location>(`${this.base}/locations/${id}`, data);
  }

  createArea(name: string): Observable<Area> {
    return this.http.post<Area>(`${this.base}/areas`, { name });
  }

  updateArea(id: string, data: { name?: string; isActive?: boolean }): Observable<Area> {
    return this.http.patch<Area>(`${this.base}/areas/${id}`, data);
  }

  createResponsible(areaId: string, fullName: string): Observable<Responsible> {
    return this.http.post<Responsible>(`${this.base}/responsibles`, { areaId, fullName });
  }

  updateResponsible(
    id: string,
    data: { fullName?: string; isActive?: boolean },
  ): Observable<Responsible> {
    return this.http.patch<Responsible>(`${this.base}/responsibles/${id}`, data);
  }

  // ---------- Tipos de queja/solicitud (dependen de área + tipo de caso) ----------

  // Usado por el formulario de casos: se recarga cada vez que cambian el
  // área o el tipo (queja/solicitud) seleccionados.
  getSubtypes(areaId: string, type: CaseType, onlyActive = true): Observable<CaseSubtype[]> {
    return this.http.get<CaseSubtype[]>(`${this.base}/case-subtypes`, {
      params: { areaId, type, onlyActive: String(onlyActive) },
    });
  }

  // Usado por la pantalla de administración (todas las combinaciones).
  getAllSubtypes(): Observable<CaseSubtype[]> {
    return this.http.get<CaseSubtype[]>(`${this.base}/case-subtypes/all`);
  }

  createSubtype(areaId: string, type: CaseType, name: string): Observable<CaseSubtype> {
    return this.http.post<CaseSubtype>(`${this.base}/case-subtypes`, { areaId, type, name });
  }

  updateSubtype(id: string, data: { name?: string; isActive?: boolean }): Observable<CaseSubtype> {
    return this.http.patch<CaseSubtype>(`${this.base}/case-subtypes/${id}`, data);
  }
}
