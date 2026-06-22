import {
  Component, OnInit, OnDestroy,
  inject, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import {
  TariffService, TariffDto, TariffForCreationDto
} from '../../core/services/tariff.service';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';

@Component({
  selector: 'app-tariffs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tariffs.component.html',
  styleUrl: './tariffs.component.scss',
})
export class TariffsComponent implements OnInit, OnDestroy {
  private tariffService = inject(TariffService);
  private cdr           = inject(ChangeDetectorRef);
  private ngZone        = inject(NgZone);        // ← جديد
  private toast         = inject(ToastService);
  private dialog        = inject(DialogService);
  private destroy$      = new Subject<void>();

  tariffs: TariffDto[] = [];
  isLoading = false;

  showAddDialog = false;
  addLoading = false;
  formData: TariffForCreationDto = {
    name: '',
    unlockFee: 0,
    perMinuteRate: 0,
  };

  actionLoading: string | null = null;

  successMessage = '';
  errorMessage = '';

  // ─── Helper: يضمن إن التحديث جوا Angular zone ───────────

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

  // ─── Lifecycle ──────────────────────────────────────────

  ngOnInit() {
    // 1. Subscribe to live state
    this.tariffService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        if (!data) return;
        this.runInZone(() => {
          this.tariffs = data.tariffs;
          this.isLoading = false;
        });
      });

    // 2. Cache check - عرض فوري لو في كاش
    const cached = this.tariffService.getCached();
    if (cached) {
      this.tariffs = cached.tariffs;
      this.isLoading = false;
    } else if (!this.tariffService.hasAnyData()) {
      this.isLoading = true;
    }
    this.cdr.detectChanges();

    // 3. Fresh fetch
    this.tariffService
      .getTariffsData(false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.runInZone(() => {
            this.tariffs = data.tariffs;
            this.isLoading = false;
          });
        },
        error: () => {
          this.runInZone(() => {
            if (!this.tariffs.length) {
              this.toast.error('Error', 'Could not load tariffs');
            }
            this.isLoading = false;
          });
        },
      });

    // 4. Live sync
    this.tariffService.startLiveSync();
  }

  ngOnDestroy() {
    this.tariffService.stopLiveSync();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Add ────────────────────────────────────────────────

  openAddDialog() {
    this.formData = { name: '', unlockFee: 0, perMinuteRate: 0 };
    this.errorMessage = '';
    this.showAddDialog = true;
    this.cdr.detectChanges();
  }

  closeAddDialog() {
    this.showAddDialog = false;
    this.errorMessage = '';
    this.cdr.detectChanges();
  }

  createTariff() {
    if (!this.formData.name.trim()) {
      this.errorMessage = 'Tariff name is required';
      return;
    }
    if (this.formData.unlockFee < 0 || this.formData.perMinuteRate < 0) {
      this.errorMessage = 'Fees cannot be negative';
      return;
    }

    this.addLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.tariffService
      .createTariff(this.formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (created) => {
          this.runInZone(() => {
            this.tariffs.unshift(created);
            this.addLoading = false;
            this.showAddDialog = false;
            this.errorMessage = '';
            this.tariffService.invalidateCache();
            this.toast.success('Tariff created', `"${created.name}" added`);
          });
        },
        error: (err) => {
          this.runInZone(() => {
            this.errorMessage = err?.error?.message || 'Failed to create tariff';
            this.addLoading = false;
          });
        },
      });
  }

  // ─── Activate ───────────────────────────────────────────

  activateTariff(tariff: TariffDto) {
    if (tariff.isActive) return;

    this.actionLoading = tariff.id;
    this.cdr.detectChanges();

    this.tariffService
      .activateTariff(tariff.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.runInZone(() => {
            this.tariffs.forEach((t) => (t.isActive = false));
            tariff.isActive = true;
            this.actionLoading = null;
            this.tariffService.invalidateCache();
            this.toast.success(
              'Activated',
              `"${tariff.name}" is now the active tariff`
            );
          });
        },
        error: (err) => {
          this.runInZone(() => {
            this.toast.error(
              'Activation failed',
              err?.error?.message || 'Could not activate tariff'
            );
            this.actionLoading = null;
          });
        },
      });
  }

  // ─── Delete ─────────────────────────────────────────────

  deleteTariff(tariff: TariffDto) {
    if (tariff.isActive) {
      this.toast.warning(
        'Cannot delete',
        'Activate another tariff first before deleting this one.'
      );
      return;
    }

    this.dialog
      .danger(
        'Delete Tariff',
        `Are you sure you want to delete "${tariff.name}"?`,
        'Delete Tariff'
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (!result.confirmed) return;

        this.actionLoading = tariff.id;
        this.cdr.detectChanges();

        this.tariffService
          .deleteTariff(tariff.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.runInZone(() => {
                this.tariffs = this.tariffs.filter((t) => t.id !== tariff.id);
                this.actionLoading = null;
                this.tariffService.invalidateCache();
                this.toast.success(
                  'Tariff deleted',
                  `"${tariff.name}" has been removed`
                );
              });
            },
            error: (err) => {
              this.runInZone(() => {
                this.toast.error(
                  'Delete failed',
                  err?.error?.message || 'Could not delete tariff'
                );
                this.actionLoading = null;
              });
            },
          });
      });
  }

  showSuccess(msg: string) {
    this.toast.success(msg);
  }
}