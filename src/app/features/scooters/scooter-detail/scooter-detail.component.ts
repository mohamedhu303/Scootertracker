import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ScooterService, ScooterDto } from '../../../core/services/scooter';
import { ToastService } from '../../../shared/services/toast.service';
import { DialogService } from '../../../shared/services/dialog.service';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-scooter-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, SkeletonComponent],
  templateUrl: './scooter-detail.component.html',
  styleUrl: './scooter-detail.component.scss'
})
export class ScooterDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private scooterService = inject(ScooterService);
  private toast = inject(ToastService);
  private dialog = inject(DialogService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  scooter: ScooterDto | null = null;
  isLoading = true;
  actionLoading: string | null = null;
  scooterId = '';

  ngOnInit() {
    this.scooterId = this.route.snapshot.paramMap.get('id') || '';
    if (this.scooterId) {
      this.bindScooter();
    }
  }

  private bindScooter() {
    // Try cache instantly first
    const cached = this.scooterService['getValidItemCache']
      ? (this.scooterService as any).getValidItemCache(this.scooterId)
      : null;

    if (cached) {
      this.scooter = cached;
      this.isLoading = false;
      this.cdr.detectChanges();
    }

    this.scooterService
      .watchScooterById(this.scooterId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (scooter) => {
          this.scooter = scooter;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading scooter:', err);
          this.toast.error('Error', 'Could not load scooter details');
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  performAction(action: string, label: string) {
    this.dialog.confirm(
      `${label} Scooter`,
      `Are you sure you want to ${label.toLowerCase()} scooter ${this.scooter?.serialNumber}?`
    ).subscribe(result => {
      if (!result.confirmed) return;

      this.actionLoading = action;
      this.cdr.detectChanges();

      let request$;
      switch (action) {
        case 'unlock':
          request$ = this.scooterService.unlockScooter(this.scooterId);
          break;
        case 'lock':
          request$ = this.scooterService.lockScooter(this.scooterId);
          break;
        case 'maintenance':
          request$ = this.scooterService.setMaintenance(this.scooterId);
          break;
        case 'ping':
          request$ = this.scooterService.pingScooter(this.scooterId);
          break;
        case 'retire':
          request$ = this.scooterService.retireScooter(this.scooterId);
          break;
        default:
          this.actionLoading = null;
          return;
      }

      request$.subscribe({
        next: () => {
          this.toast.success(
            `${label} successful`,
            `Scooter ${this.scooter?.serialNumber} has been ${label.toLowerCase()}ed`
          );
          this.actionLoading = null;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toast.error(
            `${label} failed`,
            err?.error?.message || 'Action could not be completed'
          );
          this.actionLoading = null;
          this.cdr.detectChanges();
        }
      });
    });
  }

  retireScooter() {
    this.dialog.danger(
      'Retire Scooter',
      `This will permanently retire scooter ${this.scooter?.serialNumber}. This action cannot be undone.`,
      'Retire Scooter'
    ).subscribe(result => {
      if (!result.confirmed) return;

      this.actionLoading = 'retire';
      this.cdr.detectChanges();

      this.scooterService.retireScooter(this.scooterId).subscribe({
        next: () => {
          this.toast.success('Scooter retired', `${this.scooter?.serialNumber} has been retired`);
          this.router.navigate(['/app/scooters']);
        },
        error: (err) => {
          this.toast.error('Retire failed', err?.error?.message || 'Could not retire scooter');
          this.actionLoading = null;
          this.cdr.detectChanges();
        }
      });
    });
  }

  goBack() {
    this.router.navigate(['/app/scooters']);
  }

  private normalizeStatus(status: string): string {
    return (status || '').replace(/\s+/g, '').toLowerCase();
  }

  getStatusColor(status: string): string {
    const n = this.normalizeStatus(status);
    const map: Record<string, string> = {
      available: 'var(--status-available-text)',
      inuse: 'var(--status-inride-text)',
      inride: 'var(--status-inride-text)',
      charging: 'var(--status-charging-text)',
      maintenance: 'var(--status-maintenance-text)',
      offline: 'var(--status-offline-text)',
      retired: 'var(--status-retired-text)'
    };
    return map[n] || 'var(--status-offline-text)';
  }

  getStatusBg(status: string): string {
    const n = this.normalizeStatus(status);
    const map: Record<string, string> = {
      available: 'var(--status-available-bg)',
      inuse: 'var(--status-inride-bg)',
      inride: 'var(--status-inride-bg)',
      charging: 'var(--status-charging-bg)',
      maintenance: 'var(--status-maintenance-bg)',
      offline: 'var(--status-offline-bg)',
      retired: 'var(--status-retired-bg)'
    };
    return map[n] || 'var(--status-offline-bg)';
  }

  getBatteryColor(level: number): string {
    if (level >= 50) return 'var(--battery-high)';
    if (level >= 25) return 'var(--battery-medium)';
    return 'var(--battery-low)';
  }

  getBatteryIcon(level: number): string {
    if (level >= 75) return 'battery_full';
    if (level >= 50) return 'battery_3_bar';
    if (level >= 25) return 'battery_2_bar';
    return 'battery_1_bar';
  }
}