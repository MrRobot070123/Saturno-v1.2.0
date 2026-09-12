import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppNotification, PaginatedResult, RoleName } from '../models/domain.models';

export interface UserItem {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  area: { id: string; name: string } | null;
  roles: { role: { name: RoleName } }[];
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private base = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  list(page = 1, pageSize = 20, search?: string): Observable<PaginatedResult<UserItem>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) params = params.set('search', search);
    return this.http.get<PaginatedResult<UserItem>>(this.base, { params });
  }

  create(dto: {
    fullName: string;
    email: string;
    password: string;
    roles: RoleName[];
    areaId?: string;
  }): Observable<UserItem> {
    return this.http.post<UserItem>(this.base, dto);
  }

  update(
    id: string,
    dto: { fullName?: string; email?: string; roles?: RoleName[]; areaId?: string; isActive?: boolean },
  ): Observable<UserItem> {
    return this.http.patch<UserItem>(`${this.base}/${id}`, dto);
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationsHttpService {
  private base = `${environment.apiUrl}/notifications`;

  constructor(private http: HttpClient) {}

  list(onlyUnread = false): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(this.base, { params: { onlyUnread: String(onlyUnread) } });
  }

  markRead(id: string): Observable<unknown> {
    return this.http.patch(`${this.base}/${id}/read`, {});
  }

  markAllRead(): Observable<unknown> {
    return this.http.patch(`${this.base}/read-all`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class AuditHttpService {
  private base = `${environment.apiUrl}/audit`;

  constructor(private http: HttpClient) {}

  list(page = 1, pageSize = 25, filters: Record<string, string | undefined> = {}): Observable<any> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params = params.set(k, v);
    });
    return this.http.get(this.base, { params });
  }
}
