import {
  Component, inject, OnDestroy,
  ChangeDetectorRef, NgZone, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ToastService, Toast } from '../../services/toast.service';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('toastAnimation', [
      transition(':enter', [
        style({ transform: 'translateX(120%) scale(0.9)', opacity: 0 }),
        animate('320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          style({ transform: 'translateX(0) scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('220ms cubic-bezier(0.4, 0, 1, 1)',
          style({ transform: 'translateX(120%) scale(0.95)', opacity: 0 }))
      ])
    ])
  ],
  template: `
    <div class="toast-container">
      @for (toast of toasts; track toast.id) {
        <div
          class="toast"
          [class]="'toast-' + toast.type"
          [@toastAnimation]
          (mouseenter)="pauseToast(toast.id)"
          (mouseleave)="resumeToast(toast.id)"
          role="alert"
          aria-live="polite"
        >
          <div class="toast-icon">
            <span class="material-icons">{{ toast.icon }}</span>
          </div>
          <div class="toast-content">
            <div class="toast-title">{{ toast.title }}</div>
            @if (toast.message) {
              <div class="toast-message">{{ toast.message }}</div>
            }
          </div>
          <button
            class="toast-close"
            (click)="dismiss(toast.id)"
            aria-label="Close notification"
            type="button"
          >
            <span class="material-icons">close</span>
          </button>
          <div
            class="toast-progress"
            [class]="'progress-' + toast.type"
            [style.animation-duration.ms]="getDuration(toast.type)"
            [class.paused]="pausedToasts.has(toast.id)"
            (animationend)="onProgressEnd(toast.id)"
          ></div>
        </div>
      }
    </div>
  `,
  styles: [`/* نفس الـ styles بتاعتك */`]
})
export class ToastComponent implements OnDestroy {
  private toastService = inject(ToastService);
  private cdr          = inject(ChangeDetectorRef);
  private ngZone       = inject(NgZone);
  private destroy$     = new Subject<void>();

  toasts: Toast[] = [];
  pausedToasts = new Set<string>();

  constructor() {
    // ✅ الحل: استخدم Promise.resolve عشان نتجنب
    // الـ detectChanges في وقت الـ initialization
    this.toastService.toasts$
      .pipe(takeUntil(this.destroy$))
      .subscribe(toasts => {
        Promise.resolve().then(() => {
          this.toasts = toasts;
          this.cdr.markForCheck(); // ✅ markForCheck بدل detectChanges
        });
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getDuration(type: string): number {
    const durations: Record<string, number> = {
      success: 4000,
      info:    4000,
      warning: 5000,
      error:   6000
    };
    return durations[type] ?? 4000;
  }

  onProgressEnd(id: string) {
    if (!this.pausedToasts.has(id)) {
      this.dismiss(id);
    }
  }

  pauseToast(id: string) {
    this.pausedToasts.add(id);
    this.cdr.markForCheck(); // ✅
  }

  resumeToast(id: string) {
    this.pausedToasts.delete(id);
    this.cdr.markForCheck(); // ✅
  }

  dismiss(id: string) {
    this.pausedToasts.delete(id);
    this.toastService.remove(id);
  }
}