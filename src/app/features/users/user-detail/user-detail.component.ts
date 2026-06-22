import { Component, OnInit, inject, ChangeDetectorRef, NgZone, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { UserService, UserDto } from '../../../core/services/user';
import { ToastService } from '../../../shared/services/toast.service';
import { DialogService } from '../../../shared/services/dialog.service';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { environment } from '../../../../environments/environment';

interface WalletTransaction {
  id: string;
  amount: number;
  type: string;
  referenceId: string | null;
  description: string | null;
  timestamp: string;
}

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SkeletonComponent],
  templateUrl: './user-detail.component.html',
  styleUrl: './user-detail.component.scss'
})
export class UserDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private userService = inject(UserService);
  private toast = inject(ToastService);
  private dialog = inject(DialogService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  user: UserDto | null = null;
  transactions: WalletTransaction[] = [];
  isLoading = true;
  actionLoading = false;
  userId = '';

  showAdjustDialog = false;
  adjustAmount = 0;
  adjustReason = '';
  adjustLoading = false;

  activeTab: 'info' | 'wallet' = 'info';

  ngOnInit() {
    this.userId = this.route.snapshot.paramMap.get('id') || '';
    if (this.userId) {
      this.bindUser();
    }
  }

  private bindUser() {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.userService
      .watchUserById(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.zone.run(() => {
            this.user = user;
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        },
        error: () => {
          this.zone.run(() => {
            this.toast.error('Error', 'Could not load user details');
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        }
      });
  }

  loadTransactions() {
    this.http.get<any>(`${environment.apiBaseUrl}/api/Wallet/transactions`, {
      params: { PageIndex: '1', PageSize: '20' }
    }).subscribe({
      next: (result) => {
        this.zone.run(() => {
          this.transactions = result.data || [];
          this.cdr.detectChanges();
        });
      },
      error: () => {}
    });
  }

  switchTab(tab: 'info' | 'wallet') {
    this.activeTab = tab;
    if (tab === 'wallet' && this.transactions.length === 0) {
      this.loadTransactions();
    }
    this.cdr.detectChanges();
  }

  toggleUserStatus() {
    if (!this.user) return;

    const isSuspending = this.user.accountStatus === 'Active';
    const action = isSuspending ? 'Suspend' : 'Activate';

    this.dialog.open({
      title: `${action} User`,
      message: `Are you sure you want to ${action.toLowerCase()} ${this.user.fullName}?`,
      type: isSuspending ? 'danger' : 'confirm',
      confirmText: action
    }).subscribe(result => {
      if (!result.confirmed || !this.user) return;

      this.actionLoading = true;
      this.cdr.detectChanges();

      const request$ = isSuspending
        ? this.userService.suspendUser(this.userId)
        : this.userService.activateUser(this.userId);

      request$.subscribe({
        next: () => {
          this.toast.success(`User ${action.toLowerCase()}d`, `${this.user!.fullName} has been ${action.toLowerCase()}d`);
          this.actionLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toast.error(`${action} failed`, err?.error?.message || 'Action failed');
          this.actionLoading = false;
          this.cdr.detectChanges();
        }
      });
    });
  }

  openAdjustDialog() {
    this.adjustAmount = 0;
    this.adjustReason = '';
    this.showAdjustDialog = true;
    this.cdr.detectChanges();
  }

  closeAdjustDialog() {
    this.showAdjustDialog = false;
    this.cdr.detectChanges();
  }

  submitAdjustment() {
    if (!this.adjustAmount || !this.adjustReason.trim()) {
      this.toast.warning('Missing info', 'Please enter amount and reason');
      return;
    }

    this.adjustLoading = true;
    this.cdr.detectChanges();

    this.http.post<any>(`${environment.apiBaseUrl}/api/Wallet/adjust`, {
      userId: this.userId,
      amount: this.adjustAmount,
      reason: this.adjustReason.trim()
    }).subscribe({
      next: () => {
        this.zone.run(() => {
          if (this.user) {
            this.user.walletBalance += this.adjustAmount;
          }
          this.toast.success('Wallet adjusted', `${this.adjustAmount > 0 ? '+' : ''}${this.adjustAmount} EGP applied`);
          this.adjustLoading = false;
          this.closeAdjustDialog();
          this.loadTransactions();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.toast.error('Adjustment failed', err?.error?.message || 'Could not adjust wallet');
          this.adjustLoading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  goBack() {
    this.router.navigate(['/app/users']);
  }

  private normalizeStatus(status: string): string {
    return (status || '').replace(/\s+/g, '').toLowerCase();
  }

  getVerificationColor(status: string): string {
    const n = this.normalizeStatus(status);
    const map: Record<string, string> = {
      approved: 'var(--status-approved-text)',
      pending: 'var(--status-pending-text)',
      rejected: 'var(--status-rejected-text)'
    };
    return map[n] || 'var(--status-offline-text)';
  }

  getVerificationBg(status: string): string {
    const n = this.normalizeStatus(status);
    const map: Record<string, string> = {
      approved: 'var(--status-approved-bg)',
      pending: 'var(--status-pending-bg)',
      rejected: 'var(--status-rejected-bg)'
    };
    return map[n] || 'var(--status-offline-bg)';
  }

  getTransactionColor(type: string): string {
    const colors: Record<string, string> = {
      'TopUp': 'var(--tx-topup)',
      'RidePayment': 'var(--tx-payment)',
      'Penalty': 'var(--tx-penalty)',
      'Refund': 'var(--tx-refund)',
      'AdminAdjustment': 'var(--tx-admin)'
    };
    return colors[type] || 'var(--ud-text-muted)';
  }
}