import { Component, OnInit, inject, ChangeDetectorRef, NgZone, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { RideService, RideDto } from '../../../core/services/ride';
import {
  ExportMenuComponent,
  ExportConfig
} from '../../../shared/components/export-menu/export-menu.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-ride-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent, ExportMenuComponent],
  templateUrl: './ride-list.component.html',
  styleUrl: './ride-list.component.scss',
})
export class RideListComponent implements OnInit {
  private rideService = inject(RideService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  allRides: RideDto[] = [];
  filteredRides: RideDto[] = [];
  rides: RideDto[] = [];
  isLoading = true;

  searchTerm = '';
  selectedStatus = 'All';

  currentPage = 1;
  pageSize = 10;
  totalItems = 0;

  statuses = ['All', 'Active', 'Completed', 'Cancelled'];

  stats = {
    total: 0,
    active: 0,
    completed: 0,
    totalRevenue: 0,
  };

  ngOnInit() {
    this.bindRides();
  }

  private bindRides() {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.rideService
      .watchRides(1, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.zone.run(() => {
            this.allRides = result.data || [];
            this.calculateStats();
            this.applyFiltersAndPagination();
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        },
        error: () => {
          this.zone.run(() => {
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        }
      });
  }

  private calculateStats() {
    this.stats = {
      total: this.allRides.length,
      active: this.allRides.filter((r) => r.status === 'Active').length,
      completed: this.allRides.filter((r) => r.status === 'Completed').length,
      totalRevenue: this.allRides
        .filter((r) => r.totalCost)
        .reduce((sum, r) => sum + (r.totalCost || 0), 0),
    };
  }

  private applyFiltersAndPagination() {
    let data = [...this.allRides];

    if (this.selectedStatus !== 'All') {
      data = data.filter((r) => r.status === this.selectedStatus);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      data = data.filter((r) =>
        (r.userName || '').toLowerCase().includes(term) ||
        r.scooterSerialNumber.toLowerCase().includes(term) ||
        r.id.toLowerCase().includes(term) ||
        r.userPhoneNumber.includes(this.searchTerm)
      );
    }

    this.filteredRides = data;
    this.totalItems = data.length;

    const maxPage = Math.max(1, Math.ceil(this.totalItems / this.pageSize));
    if (this.currentPage > maxPage) this.currentPage = maxPage;

    const start = (this.currentPage - 1) * this.pageSize;
    this.rides = data.slice(start, start + this.pageSize);

    this.cdr.detectChanges();
  }

  onSearch() {
    this.currentPage = 1;
    this.applyFiltersAndPagination();
  }

  onStatusFilter(status: string) {
    this.selectedStatus = status;
    this.currentPage = 1;
    this.applyFiltersAndPagination();
  }

  onPageChange(page: number) {
    this.currentPage = page;
    this.applyFiltersAndPagination();
  }

  onPageSizeChange(size: number) {
    this.pageSize = size;
    this.currentPage = 1;
    this.applyFiltersAndPagination();
  }

  get exportConfig(): ExportConfig {
    return {
      data: this.rides,
      filename: `rides_${new Date().toISOString().split('T')[0]}`,
      title: 'Rides Report',
      headers: [
        { key: 'id', label: 'Ride ID' },
        { key: 'scooterSerialNumber', label: 'Scooter' },
        { key: 'userPhoneNumber', label: 'User Phone' },
        { key: 'startTime', label: 'Start Time' },
        { key: 'durationInMinutes', label: 'Duration (min)' },
        { key: 'totalCost', label: 'Cost (EGP)' },
        { key: 'status', label: 'Status' }
      ]
    };
  }

  private normalizeStatus(status: string): string {
    return (status || '').replace(/\s+/g, '').toLowerCase();
  }

  getStatusColor(status: string): string {
    const n = this.normalizeStatus(status);
    const map: Record<string, string> = {
      active: 'var(--status-active-text)',
      completed: 'var(--status-completed-text)',
      cancelled: 'var(--status-cancelled-text)'
    };
    return map[n] || 'var(--status-offline-text)';
  }

  getStatusBg(status: string): string {
    const n = this.normalizeStatus(status);
    const map: Record<string, string> = {
      active: 'var(--status-active-bg)',
      completed: 'var(--status-completed-bg)',
      cancelled: 'var(--status-cancelled-bg)'
    };
    return map[n] || 'var(--status-offline-bg)';
  }
}