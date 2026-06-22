import {
  Component, OnDestroy,
  inject, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder, FormGroup, Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, LoginRequest } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnDestroy {
  private fb          = inject(FormBuilder);
  private authService = inject(AuthService);
  private router      = inject(Router);
  private toast       = inject(ToastService);
  private cdr         = inject(ChangeDetectorRef);
  private ngZone      = inject(NgZone);
  private destroy$    = new Subject<void>();

  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  showPassword = false;

  constructor() {
    this.loginForm = this.fb.group({
      identifier: ['', [Validators.required]],
      password:   ['', [Validators.required, Validators.minLength(6)]],
    });
  }

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

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  // ─── Submit ─────────────────────────────────────────────

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    const identifier = this.loginForm.value.identifier?.trim() || '';
    const password   = this.loginForm.value.password || '';

    // شوف لو email ولا phone
    const isEmail = identifier.includes('@');

    const request: LoginRequest = isEmail
      ? { email: identifier, password }
      : { phoneNumber: identifier, password };

    this.authService
      .login(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.runInZone(() => {
            this.isLoading = false;
            this.toast.success(
              'Welcome Back',
              `Logged in as ${response?.admin?.fullName || 'Admin'}`
            );
            this.router.navigateByUrl('/');
          });
        },
        error: (error) => {
          this.runInZone(() => {
            this.isLoading = false;

            let msg = 'Login failed';
            if (error?.status === 401) {
              msg = 'Invalid credentials. Please try again.';
            } else if (error?.status === 403) {
              msg = 'Your account is suspended or inactive.';
            } else if (error?.status === 0) {
              msg = 'Cannot connect to server. Check your internet.';
            } else if (error?.error?.errorMessage) {
              msg = error.error.errorMessage;
            } else if (error?.error?.message) {
              msg = error.error.message;
            }

            this.errorMessage = msg;
            this.toast.error('Login Failed', msg);
          });
        },
      });
  }

  get identifierControl() {
    return this.loginForm.get('identifier');
  }

  get passwordControl() {
    return this.loginForm.get('password');
  }
}