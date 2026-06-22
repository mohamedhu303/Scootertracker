import {
  Component, OnDestroy,
  inject, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AdminService, CreateAdminDto } from '../../core/services/admin.service';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-create-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-admin.component.html',
  styleUrl: './create-admin.component.scss'
})
export class CreateAdminComponent implements OnDestroy {
  private adminService = inject(AdminService);
  private cdr          = inject(ChangeDetectorRef);
  private ngZone       = inject(NgZone);
  private toast        = inject(ToastService);
  private destroy$     = new Subject<void>();

  formData: CreateAdminDto = {
    email: '',
    password: '',
    name: ''
  };

  showPassword = false;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  createdAdmin: any = null;

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Helper ─────────────────────────────────────────────

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

  // ─── Validation ─────────────────────────────────────────

  private validate(): string | null {
    if (!this.formData.name.trim()) {
      return 'Admin name is required';
    }
    if (this.formData.name.trim().length < 2) {
      return 'Name must be at least 2 characters';
    }
    if (!this.formData.email.trim()) {
      return 'Email is required';
    }
    if (!this.isValidEmail(this.formData.email)) {
      return 'Please enter a valid email address';
    }
    if (!this.formData.password || this.formData.password.length < 6) {
      return 'Password must be at least 6 characters';
    }
    return null;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ─── Password Strength ──────────────────────────────────

  get passwordStrength(): { label: string; color: string; width: number } {
    const pw = this.formData.password;
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

  // ─── Create Admin ───────────────────────────────────────

  createAdmin() {
    this.errorMessage = '';
    this.successMessage = '';
    this.createdAdmin = null;

    const validationError = this.validate();
    if (validationError) {
      this.errorMessage = validationError;
      this.toast.warning('Validation Error', validationError);
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.adminService
      .createAdmin(this.formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.runInZone(() => {
            this.createdAdmin = result.admin;
            this.successMessage = `Admin "${result.admin.fullName}" created successfully!`;
            this.toast.success(
              'Admin Created',
              `${result.admin.fullName} has been added to the system`
            );
            this.resetForm();
            this.isLoading = false;
          });
        },
        error: (err) => {
          this.runInZone(() => {
            let msg = 'Failed to create admin';

            if (err?.status === 401 || err?.status === 403) {
              msg = 'Unauthorized — invalid admin secret';
            } else if (err?.status === 409) {
              msg = 'Email already exists';
            } else if (err?.error?.message) {
              msg = err.error.message;
            } else if (err?.error?.errors?.[0]) {
              msg = err.error.errors[0];
            }

            this.errorMessage = msg;
            this.toast.error('Creation Failed', msg);
            this.isLoading = false;
          });
        }
      });
  }

  private resetForm() {
    this.formData = { email: '', password: '', name: '' };
    this.showPassword = false;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }
}