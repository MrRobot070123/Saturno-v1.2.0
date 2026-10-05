import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Review } from '../models/domain.models';

export interface ReviewFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  locationId?: string;
  platformId?: string;
  from?: string;
  to?: string;
}

export interface CreateReviewPayload {
  stayDate: string;
  locationId: string;
  room?: string;
  guestName: string;
  platformId: string;
  rawText: string;
  findings?: { subtypeId: string; excerpt: string }[];
}

export interface ReviewListResponse {
  data: Review[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  findAll(filters: ReviewFilters): Observable<ReviewListResponse> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<ReviewListResponse>(`${this.base}/reviews`, { params });
  }

  findOne(id: string): Observable<Review> {
    return this.http.get<Review>(`${this.base}/reviews/${id}`);
  }

  create(payload: CreateReviewPayload): Observable<Review> {
    return this.http.post<Review>(`${this.base}/reviews`, payload);
  }

  addFinding(reviewId: string, subtypeId: string, excerpt: string): Observable<unknown> {
    return this.http.post(`${this.base}/reviews/${reviewId}/findings`, { subtypeId, excerpt });
  }
}