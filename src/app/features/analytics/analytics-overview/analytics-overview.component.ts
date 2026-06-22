import {
  Component, OnInit, OnDestroy,
  inject, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { Subject, takeUntil, fromEvent, merge } from 'rxjs';
import { AnalyticsService, AnalyticsData } from '../../../core/services/analytics.service';
import { ToastService } from '../../../shared/services/toast.service';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, SkeletonComponent],
  templateUrl: './analytics-overview.component.html',
  styleUrl: './analytics-overview.component.scss'
})
export class AnalyticsOverviewComponent implements OnInit, OnDestroy {
  private analyticsService = inject(AnalyticsService);
  private toast            = inject(ToastService);
  private cdr              = inject(ChangeDetectorRef);
  private ngZone           = inject(NgZone);
  private destroy$         = new Subject<void>();

  isLoading = false;
  selectedPeriod: '7days' | '30days' = '7days';

  overview: any = null;
  topScooters: any[] = [];
  topUsers: any[] = [];

  private revenue7Days: any = null;
  private revenue30Days: any = null;
  private lastData: AnalyticsData | null = null;

  // ─── Chart Data ─────────────────────────────────────────

  revenueChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [{
      data: [],
      label: 'Revenue (EGP)',
      fill: true,
      tension: 0.4,
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      pointBackgroundColor: '#6366f1',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7
    }]
  };

  revenueChartOptions!: ChartConfiguration<'line'>['options'];

  ridesStatusChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: ['Active', 'Completed', 'Cancelled'],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: ['#10b981', '#6366f1', '#ef4444'],
      borderWidth: 0,
      hoverOffset: 8
    }]
  };

  ridesStatusOptions!: ChartConfiguration<'doughnut'>['options'];

  scootersStatusChartData: ChartConfiguration<'bar'>['data'] = {
    labels: ['Available', 'In Use', 'Charging', 'Maintenance', 'Offline'],
    datasets: [{
      data: [0, 0, 0, 0, 0],
      backgroundColor: ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#94a3b8'],
      borderRadius: 8,
      barThickness: 30
    }]
  };

  scootersStatusOptions!: ChartConfiguration<'bar'>['options'];

  peakHoursChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [{
      data: [],
      label: 'Rides',
      backgroundColor: '#8b5cf6',
      borderRadius: 4,
      barThickness: 12
    }]
  };

  peakHoursOptions!: ChartConfiguration<'bar'>['options'];

  // ─── Theme observer ─────────────────────────────────────

  private themeObserver?: MutationObserver;

  // ─── Lifecycle ──────────────────────────────────────────

  ngOnInit() {
    // Build chart options based on current theme
    this.applyChartTheme();

    // Watch for theme changes
    this.setupThemeWatcher();

    // 1. Subscribe to live state
    this.analyticsService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        if (!data) return;
        this.runInZone(() => {
          this.applyData(data);
          this.isLoading = false;
        });
      });

    // 2. Cache check - عرض فوري
    const cached = this.analyticsService.getCached();
    if (cached) {
      this.applyData(cached);
      this.isLoading = false;
    } else if (!this.analyticsService.hasAnyData()) {
      this.isLoading = true;
    }
    this.cdr.detectChanges();

    // 3. Fresh fetch
    this.analyticsService
      .getAnalyticsData(false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.runInZone(() => {
            this.applyData(data);
            this.isLoading = false;
          });
        },
        error: () => {
          this.runInZone(() => {
            if (!this.overview) {
              this.toast.error('Error', 'Could not load analytics data');
            }
            this.isLoading = false;
          });
        }
      });

    // 4. Live sync
    this.analyticsService.startLiveSync();
  }

  ngOnDestroy() {
    this.analyticsService.stopLiveSync();
    this.themeObserver?.disconnect();
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

  private isDarkMode(): boolean {
    if (typeof document === 'undefined') return false;
    return (
      document.body.classList.contains('dark-mode') ||
      document.documentElement.classList.contains('dark-mode') ||
      document.body.getAttribute('data-theme') === 'dark' ||
      document.documentElement.getAttribute('data-theme') === 'dark'
    );
  }

  private setupThemeWatcher() {
    if (typeof MutationObserver === 'undefined') return;

    this.themeObserver = new MutationObserver(() => {
      this.runInZone(() => {
        this.applyChartTheme();
        this.refreshAllCharts();
      });
    });

    this.themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });
  }

  private applyChartTheme() {
    const dark = this.isDarkMode();

    const gridColor   = dark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9';
    const tickColor   = dark ? '#94a3b8' : '#94a3b8';
    const tooltipBg   = dark ? '#1f2937'  : '#1e293b';
    const legendColor = dark ? '#cbd5e1'  : '#475569';

    // Revenue (line)
    this.revenueChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          padding: 12,
          cornerRadius: 8,
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            label: (ctx: any) => `${ctx.parsed.y} EGP`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: tickColor }
        },
        x: {
          grid: { display: false },
          ticks: { color: tickColor }
        }
      }
    };

    // Doughnut
    this.ridesStatusOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            usePointStyle: true,
            font: { size: 12 },
            color: legendColor
          }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          padding: 12,
          cornerRadius: 8,
          titleColor: '#fff',
          bodyColor: '#fff'
        }
      }
    };

    // Bar (scooters)
    this.scootersStatusOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          padding: 12,
          cornerRadius: 8,
          titleColor: '#fff',
          bodyColor: '#fff'
        }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor } },
        x: { grid: { display: false }, ticks: { color: tickColor } }
      }
    };

    // Bar (peak hours)
    this.peakHoursOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          padding: 12,
          cornerRadius: 8,
          titleColor: '#fff',
          bodyColor: '#fff'
        }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor } },
        x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10 } } }
      }
    };
  }

  private refreshAllCharts() {
    // إعادة بناء البيانات لتطبيق الـ theme الجديد على الـ canvas
    if (!this.lastData) return;
    this.applyData(this.lastData);
  }

  // ─── Data application ──────────────────────────────────

  private applyData(data: AnalyticsData) {
    this.lastData     = data;
    this.overview     = data.overview;
    this.revenue7Days = data.revenue7Days;
    this.revenue30Days = data.revenue30Days;
    this.topScooters  = data.topScooters;
    this.topUsers     = data.topUsers;

    this.updateRevenueChart();

    this.ridesStatusChartData = {
      ...this.ridesStatusChartData,
      datasets: [{
        ...this.ridesStatusChartData.datasets[0],
        data: [
          data.ridesByStatus.active,
          data.ridesByStatus.completed,
          data.ridesByStatus.cancelled
        ]
      }]
    };

    this.scootersStatusChartData = {
      ...this.scootersStatusChartData,
      datasets: [{
        ...this.scootersStatusChartData.datasets[0],
        data: [
          data.scootersByStatus.available,
          data.scootersByStatus.inUse,
          data.scootersByStatus.charging,
          data.scootersByStatus.maintenance,
          data.scootersByStatus.offline
        ]
      }]
    };

    this.peakHoursChartData = {
      ...this.peakHoursChartData,
      labels: data.peakHours.map(h => h.hour),
      datasets: [{
        ...this.peakHoursChartData.datasets[0],
        data: data.peakHours.map(h => h.rides)
      }]
    };
  }

  switchPeriod(period: '7days' | '30days') {
    this.selectedPeriod = period;
    this.updateRevenueChart();
    this.cdr.detectChanges();
  }

  private updateRevenueChart() {
    const source = this.selectedPeriod === '7days' ? this.revenue7Days : this.revenue30Days;
    if (!source) return;

    this.revenueChartData = {
      ...this.revenueChartData,
      labels: source.labels,
      datasets: [{
        ...this.revenueChartData.datasets[0],
        data: source.data
      }]
    };
  }

  refresh() {
    this.toast.info('Refreshing', 'Loading latest analytics...');
    this.isLoading = true;
    this.cdr.detectChanges();

    this.analyticsService
      .getAnalyticsData(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.runInZone(() => {
            this.applyData(data);
            this.isLoading = false;
            this.toast.success('Updated', 'Analytics refreshed');
          });
        },
        error: () => {
          this.runInZone(() => {
            this.toast.error('Error', 'Could not refresh analytics');
            this.isLoading = false;
          });
        }
      });
  }
}