import { Component, OnInit, inject, DestroyRef, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { UserService, UserDto } from '../../../core/services/user';
import { ToastService } from '../../../shared/services/toast.service';
import { DialogService } from '../../../shared/services/dialog.service';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ExportMenuComponent, ExportConfig } from '../../../shared/components/export-menu/export-menu.component';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent, ExportMenuComponent],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss'
})
export class UserListComponent implements OnInit {
  private userService = inject(UserService);
  private dialogService = inject(DialogService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  users: UserDto[] = [];
  allUsers: UserDto[] = [];
  isLoading = true;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;

  // Filters
  searchTerm = '';
  selectedStatus = 'All';
  selectedVerification = 'All';

  statuses = ['All', 'Active', 'Suspended'];
  verifications = ['All', 'Approved', 'Pending', 'Rejected'];

  // Stats
  allUsersCount = 0;
  activeUsersCount = 0;

  ngOnInit() {
    this.bindUsers();
  }

  private bindUsers(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.userService.watchUsers(1, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.zone.run(() => {
            this.allUsers = result.data || [];
            this.allUsersCount = result.totalCount || this.allUsers.length;
            this.activeUsersCount = this.allUsers.filter(u => u.accountStatus === 'Active').length;
            this.applyFiltersAndPagination();
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        },
        error: () => {
          this.zone.run(() => {
            this.toast.error('Error', 'Could not load users');
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        }
      });
  }

  private applyFiltersAndPagination(): void {
    let data = [...this.allUsers];

    if (this.selectedStatus !== 'All') {
      data = data.filter(u => u.accountStatus === this.selectedStatus);
    }

    if (this.selectedVerification !== 'All') {
      data = data.filter(u => u.idVerificationStatus === this.selectedVerification);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      data = data.filter(u =>
        u.fullName.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.phoneNumber.includes(this.searchTerm)
      );
    }

    this.totalItems = data.length;
    const maxPage = Math.max(1, Math.ceil(this.totalItems / this.pageSize));
    if (this.currentPage > maxPage) this.currentPage = maxPage;

    const start = (this.currentPage - 1) * this.pageSize;
    this.users = data.slice(start, start + this.pageSize);

    this.cdr.detectChanges();
  }

  // Pagination
  onPageChange(page: number) {
    this.currentPage = page;
    this.applyFiltersAndPagination();
  }

  onPageSizeChange(size: number) {
    this.pageSize = size;
    this.currentPage = 1;
    this.applyFiltersAndPagination();
  }

  // Filters
  onSearch() {
    this.currentPage = 1;
    this.applyFiltersAndPagination();
  }

  onStatusFilter(status: string) {
    this.selectedStatus = status;
    this.currentPage = 1;
    this.applyFiltersAndPagination();
  }

  onVerificationFilter(verification: string) {
    this.selectedVerification = verification;
    this.currentPage = 1;
    this.applyFiltersAndPagination();
  }

  viewUser(user: UserDto) {
    this.router.navigate(['/app/users', user.id]);
  }

  toggleUserStatus(user: UserDto) {
    const isSuspending = user.accountStatus === 'Active';
    const action = isSuspending ? 'Suspend' : 'Activate';

    this.dialogService.open({
      title: `${action} User`,
      message: `Are you sure you want to ${action.toLowerCase()} ${user.fullName}?`,
      type: isSuspending ? 'danger' : 'confirm',
      confirmText: action
    }).subscribe(result => {
      if (!result.confirmed) return;

      const req$ = isSuspending
        ? this.userService.suspendUser(user.id)
        : this.userService.activateUser(user.id);

      req$.subscribe({
        next: () => {
          this.toast.success(
            `User ${action.toLowerCase()}d`,
            `${user.fullName} has been ${action.toLowerCase()}d`
          );
        },
        error: (err) => this.toast.error(`${action} failed`, err?.error?.message || `${action} failed`)
      });
    });
  }

  // Export
  get exportConfig(): ExportConfig {
    return {
      data: this.users,
      filename: `users_page${this.currentPage}_${new Date().toISOString().split('T')[0]}`,
      title: 'Users Report',
      headers: [
        { key: 'fullName', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phoneNumber', label: 'Phone' },
        { key: 'accountStatus', label: 'Status' },
        { key: 'idVerificationStatus', label: 'Verification' },
        { key: 'walletBalance', label: 'Wallet (EGP)' }
      ]
    };
  }

  // Helpers
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

  getVerificationIcon(status: string): string {
    const icons: Record<string, string> = {
      'Approved': 'verified',
      'Pending': 'pending',
      'Rejected': 'cancel'
    };
    return icons[status] || 'help';
  }
}