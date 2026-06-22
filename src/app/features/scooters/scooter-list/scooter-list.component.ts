import {
  Component, OnInit, OnDestroy,
  inject, DestroyRef, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';

import { ScooterService, ScooterDto } from '../../../core/services/scooter';
import { ToastService } from '../../../shared/services/toast.service';
import { DialogService } from '../../../shared/services/dialog.service';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import {
  ExportMenuComponent, ExportConfig
} from '../../../shared/components/export-menu/export-menu.component';

@Component({
  selector: 'app-scooter-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SkeletonComponent,
    PaginationComponent,
    ExportMenuComponent
  ],
  templateUrl: './scooter-list.component.html',
  styleUrl: './scooter-list.component.scss'
})
export class ScooterListComponent implements OnInit, OnDestroy {
  private scooterService = inject(ScooterService);
  private toast          = inject(ToastService);
  private dialogService  = inject(DialogService);
  private router         = inject(Router);
  private destroyRef     = inject(DestroyRef);
  private cdr            = inject(ChangeDetectorRef);
  private zone           = inject(NgZone);

  scooters: ScooterDto[] = [];
  allScooters: ScooterDto[] = [];
  isLoading = false;
  isRefreshing = false;

  currentPage = 1;
  pageSize = 10;
  totalItems = 0;

  searchTerm = '';
  selectedStatus = 'All';
  statuses = ['All', 'Available', 'InUse', 'Charging', 'Maintenance'];

  stats = {
    total: 0,
    available: 0,
    inRide: 0,
    charging: 0,
    maintenance: 0
  };

  showAddDialog = false;
  addLoading = false;
  addError = '';
  newScooter = { serialNumber: '', modelId: '' };

  scooterModels = [
    { id: 'model-1', name: 'Xiaomi Pro 2' },
    { id: 'model-2', name: 'Xiaomi Essential' },
    { id: 'model-3', name: 'Segway Ninebot' },
    { id: 'model-4', name: 'Segway Max' },
    { id: 'model-5', name: 'Segway Air T15' }
  ];

  private searchInput$ = new Subject<string>();

  // ─── Lifecycle ──────────────────────────────────────────

  ngOnInit(): void {
    // Cache check - عرض فوري لو في data
    const hasCache = this.tryShowCachedData();
    if (!hasCache) {
      this.isLoading = true;
    }
    this.cdr.detectChanges();

    // Subscribe للـ stream (هيشتغل automatic كل ما الـ cache يتحدث)
    this.bindScooters();

    // Search debounce
    this.searchInput$
      .pipe(
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.currentPage = 1;
        this.applyFiltersAndPagination();
      });
  }

  ngOnDestroy(): void {
    // takeUntilDestroyed بيعمل cleanup automatic
  }

  // ─── Helpers ────────────────────────────────────────────

  private runInZone(fn: () => void) {
    if (NgZone.isInAngularZone()) {
      fn();
      this.cdr.detectChanges();
    } else {
      this.zone.run(() => {
        fn();
        this.cdr.detectChanges();
      });
    }
  }

  /**
   * يحاول يعرض data من الكاش فوراً (بدون loading spinner)
   */
  private tryShowCachedData(): boolean {
    // نستخدم getScooters بدل watchScooters عشان نشوف لو في cache valid
    let hasData = false;
    this.scooterService.getScooters(1, 1000, false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (result?.data?.length) {
            hasData = true;
            this.runInZone(() => {
              this.allScooters = result.data;
              this.updateStats();
              this.applyFiltersAndPagination();
              this.isLoading = false;
            });
          }
        }
      });
    return hasData;
  }

  // ─── Data binding ───────────────────────────────────────

  private bindScooters(): void {
    this.scooterService.watchScooters(1, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.runInZone(() => {
            this.allScooters = result.data || [];
            this.updateStats();
            this.applyFiltersAndPagination();
            this.isLoading = false;
            this.isRefreshing = false;
          });
        },
        error: () => {
          this.runInZone(() => {
            if (!this.allScooters.length) {
              this.toast.error('Error', 'Could not load scooters');
            }
            this.isLoading = false;
            this.isRefreshing = false;
          });
        }
      });
  }

  private updateStats(): void {
    const all = this.allScooters;
    this.stats = {
      total: all.length,
      available:   all.filter(s => s.status === 'Available').length,
      inRide:      all.filter(s => s.status === 'InUse').length,
      charging:    all.filter(s => s.status === 'Charging').length,
      maintenance: all.filter(s => s.status === 'Maintenance').length
    };
  }

  private applyFiltersAndPagination(): void {
    let data = [...this.allScooters];

    if (this.selectedStatus !== 'All') {
      data = data.filter(s => s.status === this.selectedStatus);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      data = data.filter(s =>
        s.serialNumber.toLowerCase().includes(term) ||
        s.modelName.toLowerCase().includes(term)
      );
    }

    this.totalItems = data.length;
    const maxPage = Math.max(1, Math.ceil(this.totalItems / this.pageSize));
    if (this.currentPage > maxPage) this.currentPage = maxPage;

    const start = (this.currentPage - 1) * this.pageSize;
    this.scooters = data.slice(start, start + this.pageSize);

    this.cdr.detectChanges();
  }

  // ─── Refresh ────────────────────────────────────────────

  refresh(): void {
    if (this.isRefreshing) return;

    this.isRefreshing = true;
    this.cdr.detectChanges();

    this.scooterService.refreshScooters(1, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.runInZone(() => {
            this.isRefreshing = false;
            this.toast.success('Updated', 'Scooters refreshed');
          });
        },
        error: () => {
          this.runInZone(() => {
            this.isRefreshing = false;
            this.toast.error('Error', 'Could not refresh scooters');
          });
        }
      });
  }

  // ─── Pagination & Filters ───────────────────────────────

  onPageChange(page: number): void {
    this.currentPage = page;
    this.applyFiltersAndPagination();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.applyFiltersAndPagination();
  }

  onSearch(): void {
    this.searchInput$.next(this.searchTerm);
  }

  onStatusFilter(status: string): void {
    this.selectedStatus = status;
    this.currentPage = 1;
    this.applyFiltersAndPagination();
  }

  // ─── Actions ────────────────────────────────────────────

  viewScooter(scooter: ScooterDto): void {
    this.router.navigate(['/app/scooters', scooter.id]);
  }

  lockScooter(scooter: ScooterDto): void {
    this.dialogService.confirm(
      'Lock Scooter',
      `Are you sure you want to lock scooter ${scooter.serialNumber}?`
    )
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(result => {
      if (!result.confirmed) return;

      this.scooterService.lockScooter(scooter.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.runInZone(() => {
              this.toast.success(
                'Scooter locked',
                `${scooter.serialNumber} has been locked`
              );
              // الـ service بيعمل invalidate ويـ trigger fetch جديد automatic
              // من خلال الـ watchScooters stream
            });
          },
          error: (err) => {
            this.runInZone(() => {
              this.toast.error(
                'Lock failed',
                err?.error?.message || 'Lock failed'
              );
            });
          }
        });
    });
  }

  deleteScooter(scooter: ScooterDto): void {
    this.dialogService.danger(
      'Delete Scooter',
      `Are you sure you want to delete scooter ${scooter.serialNumber}? This action cannot be undone.`,
      'Delete'
    )
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(result => {
      if (!result.confirmed) return;

      this.scooterService.deleteScooter(scooter.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.runInZone(() => {
              this.toast.success(
                'Scooter deleted',
                `${scooter.serialNumber} has been removed`
              );
              // removeScooterFromCaches في الـ service بيعمل push للـ stream
              // فالـ watchScooters هيتحدث automatic
            });
          },
          error: (err) => {
            this.runInZone(() => {
              this.toast.error(
                'Delete failed',
                err?.error?.message || 'Delete failed'
              );
            });
          }
        });
    });
  }

  // ─── Add Dialog ─────────────────────────────────────────

  openAddDialog(): void {
    this.newScooter = { serialNumber: '', modelId: '' };
    this.addError = '';
    this.showAddDialog = true;
    this.cdr.detectChanges();
  }

  closeAddDialog(): void {
    this.showAddDialog = false;
    this.addError = '';
    this.cdr.detectChanges();
  }

  getModelName(modelId: string): string {
    if (!modelId) return 'Default Model';
    return this.scooterModels.find(m => m.id === modelId)?.name || 'Default Model';
  }

  addScooter(): void {
    this.addError = '';
    const serial = this.newScooter.serialNumber.trim();
    if (!serial) {
      this.addError = 'Serial number is required';
      return;
    }

    this.addLoading = true;
    this.cdr.detectChanges();

    this.scooterService.createScooter({
      serialNumber: serial,
      modelId: this.newScooter.modelId || 'default-model-id'
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (created) => {
        this.runInZone(() => {
          this.addLoading = false;
          this.closeAddDialog();
          this.toast.success(
            'Scooter added',
            `${created.serialNumber} has been added to the fleet`
          );
          // الـ service بيضيف الـ scooter للـ caches ويـ push للـ stream
        });
      },
      error: (err) => {
        this.runInZone(() => {
          this.addError = err?.error?.message || 'Could not add scooter';
          this.addLoading = false;
        });
      }
    });
  }

  // ─── Export ─────────────────────────────────────────────

  get exportConfig(): ExportConfig {
    return {
      data: this.scooters,
      filename: `scooters_${new Date().toISOString().split('T')[0]}`,
      title: 'Scooters Report',
      headers: [
        { key: 'serialNumber', label: 'Serial Number' },
        { key: 'modelName', label: 'Model' },
        { key: 'status', label: 'Status' },
        { key: 'batteryLevel', label: 'Battery (%)' }
      ]
    };
  }

  // ─── Styling helpers ────────────────────────────────────

private normalizeStatus(status: string): string {
  return (status || '').replace(/\s+/g, '').toLowerCase();
}

getStatusColor(status: string): string {
  const n = this.normalizeStatus(status);
  const map: Record<string, string> = {
    available:   'var(--status-available-text)',
    inuse:       'var(--status-inride-text)',
    inride:      'var(--status-inride-text)',
    charging:    'var(--status-charging-text)',
    maintenance: 'var(--status-maintenance-text)',
    offline:     'var(--status-offline-text)'
  };
  return map[n] || 'var(--status-offline-text)';
}

getStatusBg(status: string): string {
  const n = this.normalizeStatus(status);
  const map: Record<string, string> = {
    available:   'var(--status-available-bg)',
    inuse:       'var(--status-inride-bg)',
    inride:      'var(--status-inride-bg)',
    charging:    'var(--status-charging-bg)',
    maintenance: 'var(--status-maintenance-bg)',
    offline:     'var(--status-offline-bg)'
  };
  return map[n] || 'var(--status-offline-bg)';
}

getBatteryColor(level: number): string {
  if (level >= 50) {
    return 'linear-gradient(90deg, var(--battery-high), var(--battery-high-light))';
  }
  if (level >= 25) {
    return 'linear-gradient(90deg, var(--battery-medium), var(--battery-medium-light))';
  }
  return 'linear-gradient(90deg, var(--battery-low), var(--battery-low-light))';
}

getBatteryTextColor(level: number): string {
  if (level >= 50) return 'var(--battery-high)';
  if (level >= 25) return 'var(--battery-medium)';
  return 'var(--battery-low)';
}
}