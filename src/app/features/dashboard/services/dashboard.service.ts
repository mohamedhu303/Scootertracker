import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DashboardStats, ScooterLocation, RecentRide } from '../models/dashboard.model';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiBaseUrl;

  // حسب الـ RSD - Section 7.5 Admin Endpoints
  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.apiUrl}/admin/dashboard/stats`);
  }

  getScooterLocations(): Observable<ScooterLocation[]> {
    return this.http.get<ScooterLocation[]>(`${this.apiUrl}/admin/scooters/locations`);
  }

  getRecentRides(limit: number = 10): Observable<RecentRide[]> {
    return this.http.get<RecentRide[]>(`${this.apiUrl}/admin/rides/recent?limit=${limit}`);
  }

  getActiveRides(): Observable<RecentRide[]> {
    return this.http.get<RecentRide[]>(`${this.apiUrl}/admin/rides?status=Active`);
  }
}