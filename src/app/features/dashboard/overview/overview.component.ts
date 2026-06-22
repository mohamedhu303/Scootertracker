import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  DashboardService,
  DashboardStats,
  DashboardScooter,
  DashboardRide,
  DashboardData
} from '../../../core/services/dashboard';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss'
})
export class OverviewComponent implements OnInit, OnDestroy {
  private dashboardService = inject(DashboardService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  stats: DashboardStats | null = null;
  scooters: DashboardScooter[] = [];
  rides: DashboardRide[] = [];
  lastUpdated = new Date();
  isLoading = false;

  ngOnInit() {
    // Listen to state changes (for live sync updates)
    this.dashboardService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        if (!data) return;
        this.applyData(data);
        this.isLoading = false;
        this.cdr.detectChanges();
      });

    // Try cache first
    const cached = this.dashboardService.getCachedDashboard();
    if (cached) {
      this.applyData(cached);
      this.cdr.detectChanges();
    }

    // Load fresh data
    this.loadData(false);

    // Start live sync
    this.dashboardService.startOverviewLiveSync();
  }

  ngOnDestroy() {
    this.dashboardService.stopOverviewLiveSync();
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(forceRefresh: boolean = true) {
    if (!this.stats) {
      this.isLoading = true;
      this.cdr.detectChanges();
    }

    this.dashboardService
      .loadDashboard(forceRefresh)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.applyData(data);
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Dashboard load error:', err);
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  private applyData(data: DashboardData) {
    this.stats = data.stats;
    this.scooters = data.scooters;
    this.rides = data.rides;
    this.lastUpdated = new Date(data.updatedAt || Date.now());
  }

  private normalizeStatus(status: string): string {
    return (status || '').replace(/\s+/g, '').toLowerCase();
  }

  getStatusColor(status: string): string {
    const normalized = this.normalizeStatus(status);
    const colors: Record<string, string> = {
      available: 'var(--status-available-text)',
      inuse: 'var(--status-inride-text)',
      inride: 'var(--status-inride-text)',
      charging: 'var(--status-charging-text)',
      maintenance: 'var(--status-maintenance-text)',
      offline: 'var(--status-offline-text)'
    };
    return colors[normalized] || 'var(--status-offline-text)';
  }

  getStatusBg(status: string): string {
    const normalized = this.normalizeStatus(status);
    const colors: Record<string, string> = {
      available: 'var(--status-available-bg)',
      inuse: 'var(--status-inride-bg)',
      inride: 'var(--status-inride-bg)',
      charging: 'var(--status-charging-bg)',
      maintenance: 'var(--status-maintenance-bg)',
      offline: 'var(--status-offline-bg)'
    };
    return colors[normalized] || 'var(--status-offline-bg)';
  }

  getBatteryIcon(level: number): string {
    if (level >= 75) return 'battery_full';
    if (level >= 50) return 'battery_3_bar';
    if (level >= 25) return 'battery_2_bar';
    return 'battery_1_bar';
  }

  getBatteryColor(level: number): string {
    if (level >= 50) return 'var(--battery-high)';
    if (level >= 25) return 'var(--battery-medium)';
    return 'var(--battery-low)';
  }
}