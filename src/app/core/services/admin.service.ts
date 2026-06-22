import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CreateAdminDto {
  email: string;
  password: string;
  name: string;
}

export interface AdminResultDto {
  admin: {
    id: string;
    fullName: string;
    email: string;
    accountStatus: string;
    createdAt?: string;
  };
  token: {
    accessToken: string;
    expiresAt: string;
    refreshToken: string;
    refreshTokenExpiration: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  /**
   * بيبعت الـ Admin Secret تلقائياً من environment.
   * المستخدم مش محتاج يدخله — الـ secret محفوظ في الـ frontend
   * عشان يمنع أي محاولة لإنشاء أدمن من خارج التطبيق (زي Postman).
   */
  createAdmin(data: CreateAdminDto): Observable<AdminResultDto> {
    const headers = new HttpHeaders().set(
      'X-Admin-Secret',
      environment.adminSecret
    );

    return this.http.post<AdminResultDto>(
      `${this.baseUrl}/api/Auth/create-admin`,
      data,
      { headers }
    );
  }
}