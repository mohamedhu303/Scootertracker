import {
  Component,
  inject,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  HostListener,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { animate, style, transition, trigger } from '@angular/animations';
import {
  NotificationService,
  AppNotification,
} from '../../services/notification.service';

@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('panelAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px) scale(0.95)' }),
        animate(
          '200ms ease-out',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' })
        ),
      ]),
      transition(':leave', [
        animate(
          '150ms ease-in',
          style({ opacity: 0, transform: 'translateY(-10px) scale(0.95)' })
        ),
      ]),
    ]),
  ],
  template: `
    @if (isOpen) {
      <div class="notification-panel" [@panelAnimation]>

        <!-- Header -->
        <div class="panel-header">
          <h3>Notifications</h3>
          <div class="header-actions">
            @if (unreadCount > 0) {
              <button class="mark-read-btn" (click)="markAllRead()">
                Mark all as read
              </button>
            }
            <button class="refresh-btn" (click)="refresh()" title="Refresh">
              <span class="material-icons">refresh</span>
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="panel-body">
          @if (notifications.length === 0) {
            <div class="empty-notifications">
              <span class="material-icons">notifications_off</span>
              <p>No notifications</p>
              <span class="empty-sub">Everything looks good!</span>
            </div>
          }

          @for (notification of notifications; track notification.id) {
            <div
              class="notification-item"
              [class.unread]="!notification.read"
              (click)="onNotificationClick(notification)"
            >
              <div
                class="notification-icon"
                [style.background]="notification.color + '15'"
                [style.color]="notification.color"
              >
                <span class="material-icons">{{ notification.icon }}</span>
              </div>
              <div class="notification-content">
                <div class="notification-title">{{ notification.title }}</div>
                <div class="notification-message">{{ notification.message }}</div>
                <div class="notification-time">
                  <span class="material-icons">schedule</span>
                  {{ getTimeAgo(notification.timestamp) }}
                </div>
              </div>
              @if (!notification.read) {
                <div class="unread-dot"></div>
              }
            </div>
          }
        </div>

      </div>
    }
  `,
  styles: [`
    :host {
      /* Light Mode */
      --np-surface:       #ffffff;
      --np-border:        #e2e8f0;
      --np-text:          #1e293b;
      --np-text-sec:      #64748b;
      --np-text-muted:    #94a3b8;
      --np-hover:         #f8fafc;
      --np-unread-bg:     #fafbff;
      --np-unread-hover:  #f0f2ff;
      --np-divider:       #f1f5f9;
      --np-accent:        #6366f1;
      --np-accent-bg:     #eef2ff;
      --np-success:       #10b981;
      --np-shadow:        0 20px 60px rgba(0, 0, 0, 0.15);
    }

    :host-context(.dark-mode),
    :host-context([data-theme='dark']),
    :host-context(body.dark-mode),
    :host-context(body[data-theme='dark']) {
      --np-surface:       #1f2937;
      --np-border:        #334155;
      --np-text:          #f8fafc;
      --np-text-sec:      #cbd5e1;
      --np-text-muted:    #94a3b8;
      --np-hover:         #334155;
      --np-unread-bg:     rgba(99, 102, 241, 0.08);
      --np-unread-hover:  rgba(99, 102, 241, 0.15);
      --np-divider:       #334155;
      --np-accent:        #818cf8;
      --np-accent-bg:     rgba(129, 140, 248, 0.15);
      --np-success:       #4ade80;
      --np-shadow:        0 20px 60px rgba(0, 0, 0, 0.5);
    }

    /* ⭐ أعلى z-index ممكن */
    .notification-panel {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 400px;
      max-height: 500px;
      background: var(--np-surface);
      border-radius: 16px;
      box-shadow: var(--np-shadow);
      border: 1px solid var(--np-border);
      z-index: 99999; /* ⭐ فوق كل حاجة */
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--np-border);

      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: var(--np-text);
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .mark-read-btn {
      background: none;
      border: none;
      color: var(--np-accent);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      transition: background 0.15s;

      &:hover { background: var(--np-accent-bg); }
    }

    .refresh-btn {
      background: none;
      border: none;
      color: var(--np-text-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      transition: background 0.15s, color 0.15s;

      &:hover {
        background: var(--np-hover);
        color: var(--np-text-sec);
      }

      .material-icons { font-size: 18px; }
    }

    .panel-body {
      overflow-y: auto;
      max-height: 420px;
    }

    .empty-notifications {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 20px;
      color: var(--np-text-muted);

      .material-icons {
        font-size: 48px;
        margin-bottom: 12px;
        color: var(--np-success);
      }

      p {
        font-size: 15px;
        font-weight: 600;
        color: var(--np-text-sec);
        margin: 0 0 4px;
      }

      .empty-sub { font-size: 13px; }
    }

    .notification-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 20px;
      cursor: pointer;
      transition: background 0.15s;
      position: relative;

      &:hover { background: var(--np-hover); }
      &:not(:last-child) { border-bottom: 1px solid var(--np-divider); }

      &.unread {
        background: var(--np-unread-bg);
        &:hover { background: var(--np-unread-hover); }
      }
    }

    .notification-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      .material-icons { font-size: 20px; }
    }

    .notification-content {
      flex: 1;
      min-width: 0;
    }

    .notification-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--np-text);
      margin-bottom: 2px;
    }

    .notification-message {
      font-size: 12px;
      color: var(--np-text-sec);
      line-height: 1.4;
      margin-bottom: 4px;
    }

    .notification-time {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--np-text-muted);

      .material-icons { font-size: 12px; }
    }

    .unread-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--np-accent);
      flex-shrink: 0;
      margin-top: 6px;
    }

    @media (max-width: 768px) {
      .notification-panel {
        position: fixed;
        top: 70px;
        right: 12px;
        left: 12px;
        width: auto;
      }
    }
  `]
})
export class NotificationPanelComponent implements OnDestroy {
  private notificationService = inject(NotificationService);
  private router              = inject(Router);
  private cdr                 = inject(ChangeDetectorRef);
  private elementRef          = inject(ElementRef);
  private destroy$            = new Subject<void>();

  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  notifications: AppNotification[] = [];
  unreadCount = 0;

  constructor() {
    this.notificationService.notifications$
      .pipe(takeUntil(this.destroy$))
      .subscribe((n) => {
        this.notifications = n;
        this.cdr.markForCheck();
      });

    this.notificationService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe((c) => {
        this.unreadCount = c;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // ⭐ Click Outside Detection
  // ============================================================

  /**
   * أي click في الـ document بنشيك:
   * - لو الـ panel مفتوح
   * - والـ click حصل برة الـ panel
   * - والـ click حصل برة زر الـ notification
   * → نقفل الـ panel
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.isOpen) return;

    const target = event.target as HTMLElement;
    const clickedInsidePanel = this.elementRef.nativeElement.contains(target);
    const clickedOnBellButton = target.closest('.notification-btn');

    // ❌ لو الضغط جوه الـ panel أو على زر الجرس → متعملش حاجة
    if (clickedInsidePanel || clickedOnBellButton) {
      return;
    }

    // ✅ ضغط برة → اقفل
    this.close.emit();
  }

  /**
   * ⌨️ ESC key لقفل الـ panel
   */
  @HostListener('document:keydown.escape')
  onEscapePressed() {
    if (this.isOpen) {
      this.close.emit();
    }
  }

  // ============================================================
  // Actions
  // ============================================================

  onNotificationClick(notification: AppNotification) {
    this.notificationService.markAsRead(notification.id);
    if (notification.route) {
      this.router.navigate([notification.route]);
    }
    this.close.emit();
  }

  markAllRead() {
    this.notificationService.markAllAsRead();
  }

  refresh() {
    this.notificationService.loadNotifications();
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return `${Math.floor(diffHours / 24)}d ago`;
  }
}