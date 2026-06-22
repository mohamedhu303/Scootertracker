import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

export interface LoginRequest {
  email?: string;
  phoneNumber?: string;
  password: string;
}

export interface TokenDto {
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
  refreshTokenExpiration: string;
}

export interface AdminDto {
  id: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  accountStatus?: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginResponse {
  admin?: AdminDto;
  user?: any;
  token: TokenDto;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly TOKEN_KEY = 'dashboard_token';
  private readonly REFRESH_TOKEN_KEY = 'dashboard_refresh_token';
  private readonly ADMIN_KEY = 'dashboard_admin';

  private isLoggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
  isLoggedIn$ = this.isLoggedInSubject.asObservable();

  login(request: LoginRequest): Observable<LoginResponse> {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    });

    const adminLoginSecret = environment.adminLoginSecret?.trim();

    if (adminLoginSecret) {
      headers = headers.set('Authorization', `Bearer ${adminLoginSecret}`);
    }

    return this.http.post<LoginResponse>(
      `${environment.apiBaseUrl}/api/Auth/Login-admin`,
      {
        email: request.email,
        password: request.password
      },
      { headers }
    ).pipe(
      tap(response => {
        const accessToken = response?.token?.accessToken;
        const refreshToken = response?.token?.refreshToken;
        const adminData = response?.admin ?? response?.user ?? null;

        if (!accessToken) {
          throw new Error('No access token in response');
        }

        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem(this.TOKEN_KEY, accessToken);

          if (refreshToken) {
            localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
          }

          if (adminData) {
            localStorage.setItem(this.ADMIN_KEY, JSON.stringify(adminData));
          }
        }

        this.isLoggedInSubject.next(true);
      })
    );
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      localStorage.removeItem(this.ADMIN_KEY);
    }

    this.isLoggedInSubject.next(false);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(this.TOKEN_KEY);
    }
    return null;
  }

  getRefreshToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    }
    return null;
  }

  getAdmin(): AdminDto | null {
    if (isPlatformBrowser(this.platformId)) {
      const admin = localStorage.getItem(this.ADMIN_KEY);
      return admin ? JSON.parse(admin) : null;
    }
    return null;
  }

  hasToken(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      return !!localStorage.getItem(this.TOKEN_KEY);
    }
    return false;
  }

  isAuthenticated(): boolean {
    return this.hasToken();
  }
}