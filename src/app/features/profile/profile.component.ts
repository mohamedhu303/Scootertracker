import {
  Component, OnInit, OnDestroy,
  inject, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, forkJoin, of, catchError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { environment } from '../../../environments/environment';

interface ProfileCache {
  savedAt: number;
  profile: any;
  stats: any;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private http        = inject(HttpClient);
  private toast       = inject(ToastService);
  private dialog      = inject(DialogService);
  private cdr         = inject(ChangeDetectorRef);
  private ngZone      = inject(NgZone);
  private destroy$    = new Subject<void>();

  private readonly CACHE_KEY = 'admin_profile_cache_v1';
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 دقايق

  admin: any = null;
  profile: any = null;
  isLoading = false;

  stats = {
    totalScooters: 0,
    totalUsers: 0,
    activeRides: 0,
    pendingPhotos: 0
  };

  // Password
  showPasswordSection = false;
  passwordForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  passwordLoading = false;
  passwordError = '';

  recentActivity = [
    { icon: 'login', text: 'Logged in', time: new Date(), color: '#10b981' },
    { icon: 'electric_scooter', text: 'Added scooter SC-1006', time: new Date(Date.now() - 3600000), color: '#6366f1' },
    { icon: 'block', text: 'Suspended user Omar Hassan', time: new Date(Date.now() - 7200000), color: '#ef4444' },
    { icon: 'check_circle', text: 'Approved parking photo', time: new Date(Date.now() - 10800000), color: '#10b981' },
    { icon: 'payments', text: 'Adjusted wallet +50 EGP', time: new Date(Date.now() - 14400000), color: '#f59e0b' },
    { icon: 'map', text: 'Created zone "University Area"', time: new Date(Date.now() - 18000000), color: '#8b5cf6' }
  ];

  // ─── Lifecycle ──────────────────────────────────────────

  ngOnInit() {
    this.admin = this.authService.getAdmin();

    // 1. حاول تعرض من الكاش فوراً
    const cached = this.readCache();
    if (cached) {
      this.profile = cached.profile;
      this.stats = cached.stats;
      this.isLoading = false;
    } else {
      this.isLoading = true;
    }
    this.cdr.detectChanges();

    // 2. حدّث في الخلفية
    this.loadAllData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Helpers ────────────────────────────────────────────

  private runInZone(fn: () => void) {
    if (NgZone.isInAngularZone()) {
      fn();
      this.cdr.detectChanges();
    } else {
      this.ngZone.run(() => {
        fn();
        this.cdr.detectChanges();
      });
    }
  }

  private readCache(): ProfileCache | null {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(this.CACHE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as ProfileCache;
      if (!parsed?.savedAt) {
        sessionStorage.removeItem(this.CACHE_KEY);
        return null;
      }
      if (Date.now() - parsed.savedAt > this.CACHE_TTL) {
        sessionStorage.removeItem(this.CACHE_KEY);
        return null;
      }
      return parsed;
    } catch {
      sessionStorage.removeItem(this.CACHE_KEY);
      return null;
    }
  }

  private writeCache() {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(this.CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        profile: this.profile,
        stats: this.stats
      } as ProfileCache));
    } catch (e) {
      console.warn('Could not cache profile:', e);
    }
  }

  // ─── Load all data ──────────────────────────────────────

  private loadAllData() {
    forkJoin({
      profile: this.http.get<any>(`${environment.apiBaseUrl}/api/Auth/profile`)
        .pipe(catchError(() => of(null))),

      scooters: this.http.get<any>(`${environment.apiBaseUrl}/api/Scooter`, {
        params: { PageIndex: '1', PageSize: '1' }
      }).pipe(catchError(() => of({ totalCount: 0 }))),

      users: this.http.get<any>(`${environment.apiBaseUrl}/api/User`, {
        params: { PageIndex: '1', PageSize: '1' }
      }).pipe(catchError(() => of({ totalCount: 0 }))),

      pendingPhotos: this.http.get<any>(`${environment.apiBaseUrl}/api/Ride/parking-photos/pending`, {
        params: { PageIndex: '1', PageSize: '1' }
      }).pipe(catchError(() => of({ totalCount: 0 })))
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ profile, scooters, users, pendingPhotos }) => {
        this.runInZone(() => {
          // Profile (fallback to stored admin)
          this.profile = profile || {
            id: this.admin?.id || 'N/A',
            fullName: this.admin?.fullName || 'Admin',
            email: this.admin?.email || 'admin@scooter.com',
            phoneNumber: this.admin?.phoneNumber || '',
            accountStatus: this.admin?.accountStatus || 'Active',
            role: this.admin?.role || 'Administrator',
            createdAt: this.admin?.createdAt || new Date().toISOString()
          };

          // Stats
          this.stats = {
            totalScooters: scooters?.totalCount || 0,
            totalUsers: users?.totalCount || 0,
            activeRides: 0,
            pendingPhotos: pendingPhotos?.totalCount || 0
          };

          this.isLoading = false;
          this.writeCache();
        });
      },
      error: () => {
        this.runInZone(() => {
          this.isLoading = false;
          if (!this.profile) {
            this.toast.error('Error', 'Could not load profile');
          }
        });
      }
    });
  }

  // ─── Display getters ────────────────────────────────────

  get displayName(): string {
    return this.profile?.fullName || this.admin?.fullName || 'Admin';
  }

  get displayEmail(): string {
    return this.profile?.email || this.admin?.email || 'admin@scooter.com';
  }

  get displayPhone(): string {
    return this.profile?.phoneNumber || this.admin?.phoneNumber || '';
  }

  get displayId(): string {
    return this.profile?.id || this.admin?.id || 'N/A';
  }

  get displayStatus(): string {
    return this.profile?.accountStatus || this.admin?.accountStatus || 'Active';
  }

  // ─── Password ───────────────────────────────────────────

  togglePasswordSection() {
    this.showPasswordSection = !this.showPasswordSection;
    this.passwordError = '';
    this.passwordForm = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
    this.cdr.detectChanges();
  }

  get passwordStrength(): { label: string; color: string; width: number } {
    const pw = this.passwordForm.newPassword;
    if (!pw) return { label: '', color: '', width: 0 };
    if (pw.length < 6) return { label: 'Too short', color: '#ef4444', width: 20 };

    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 1) return { label: 'Weak', color: '#ef4444', width: 33 };
    if (score <= 2) return { label: 'Medium', color: '#f59e0b', width: 66 };
    return { label: 'Strong', color: '#10b981', width: 100 };
  }

  get passwordsMatch(): boolean {
    return this.passwordForm.newPassword === this.passwordForm.confirmPassword
      && this.passwordForm.confirmPassword.length > 0;
  }

  changePassword() {
    this.passwordError = '';

    if (!this.passwordForm.currentPassword) {
      this.passwordError = 'Current password is required';
      return;
    }
    if (!this.passwordForm.newPassword || this.passwordForm.newPassword.length < 6) {
      this.passwordError = 'New password must be at least 6 characters';
      return;
    }
    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      this.passwordError = 'Passwords do not match';
      return;
    }

    this.dialog.confirm(
      'Change Password',
      'Are you sure you want to change your password? You will need to use the new password next time you login.'
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe(result => {
      if (!result.confirmed) return;

      this.passwordLoading = true;
      this.cdr.detectChanges();

      this.http.post<any>(`${environment.apiBaseUrl}/api/Auth/change-password`, {
        currentPassword: this.passwordForm.currentPassword,
        newPassword: this.passwordForm.newPassword
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.runInZone(() => {
            this.toast.success(
              'Password changed',
              res?.message || 'Your password has been updated successfully'
            );
            this.passwordForm = {
              currentPassword: '',
              newPassword: '',
              confirmPassword: ''
            };
            this.showPasswordSection = false;
            this.passwordLoading = false;
          });
        },
        error: (err) => {
          this.runInZone(() => {
            this.passwordError = err?.error?.message || 'Failed to change password';
            this.passwordLoading = false;
          });
        }
      });
    });
  }

  // ─── Helpers ────────────────────────────────────────────

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return `${Math.floor(diffHours / 24)}d ago`;
  }

  getJoinDate(): string {
    const date = this.profile?.createdAt || this.admin?.createdAt;
    if (!date) return 'Recently joined';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}