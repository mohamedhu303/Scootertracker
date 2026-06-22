import {
  Component,
  signal,
  inject,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, fromEvent, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { DialogService } from '../../shared/services/dialog.service';
import { NotificationService } from '../../shared/services/notification.service';
import { ThemeService } from '../../shared/services/theme.service';
import { NotificationPanelComponent } from '../../shared/components/notification-panel/notification-panel.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, NotificationPanelComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private authService         = inject(AuthService);
  private dialog              = inject(DialogService);
  private themeService        = inject(ThemeService);
  private notificationService = inject(NotificationService);
  private cdr                 = inject(ChangeDetectorRef);
  private destroy$            = new Subject<void>();

  // ⏱️ Polling كل 10 دقايق
  private readonly POLLING_INTERVAL = 600000;

  // 📱 UI Signals
  isSidebarOpen      = signal(true);
  isMobile           = signal(false);
  isNotificationOpen = signal(false);

  // 📊 State
  admin: any   = null;
  unreadCount  = 0;
  isDark       = false;

  // 📋 Menu Items
  menuItems = [
    { icon: 'dashboard',            label: 'Dashboard',       route: '/app/dashboard' },
    { icon: 'map',                  label: 'Live Map',        route: '/app/live-map' },
    { icon: 'electric_scooter',     label: 'Scooters',        route: '/app/scooters' },
    { icon: 'people',               label: 'Users',           route: '/app/users' },
    { icon: 'route',                label: 'Rides',           route: '/app/rides' },
    { icon: 'photo_camera',         label: 'Parking Reviews', route: '/app/parking-reviews' },
    { icon: 'pin_drop',             label: 'Zones',           route: '/app/zones' },
    { icon: 'payments',             label: 'Tariffs',         route: '/app/tariffs' },
    { icon: 'admin_panel_settings', label: 'Create Admin',    route: '/app/create-admin' },
    { icon: 'analytics',            label: 'Analytics',       route: '/app/analytics' },
  ];

  // ============================================================
  // 🔄 LIFECYCLE
  // ============================================================

  ngOnInit() {
    this.admin = this.authService.getAdmin();
    this.checkScreenSize();

    // 🚀 Smart Polling
    // this.startSmartPolling();

    // 🔔 Listen to unread count
    this.notificationService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe((count) => {
        this.unreadCount = count;
        this.cdr.markForCheck();
      });

    // 🌓 Listen to theme
    this.themeService.theme$
      .pipe(takeUntil(this.destroy$))
      .subscribe((theme) => {
        this.isDark = theme === 'dark';
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    // this.notificationService.stopPolling();
  }

  // ============================================================
  // 🧠 SMART POLLING
  // ============================================================

  private startSmartPolling() {
    if (!document.hidden) {
      this.notificationService.startPolling(this.POLLING_INTERVAL);
    }

    fromEvent(document, 'visibilitychange')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (document.hidden) {
          this.notificationService.stopPolling();
        } else {
          this.notificationService.startPolling(this.POLLING_INTERVAL);
        }
      });
  }

  // ============================================================
  // 🎨 THEME
  // ============================================================

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  // ============================================================
  // 📱 RESPONSIVE
  // ============================================================

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    const mobile = window.innerWidth < 768;
    this.isMobile.set(mobile);
    if (mobile) {
      this.isSidebarOpen.set(false);
    }
  }

  // ============================================================
  // 🎛️ SIDEBAR
  // ============================================================

  toggleSidebar() {
    this.isSidebarOpen.update((v) => !v);
  }

  closeSidebarOnMobile() {
    if (this.isMobile()) {
      this.isSidebarOpen.set(false);
    }
  }

  // ============================================================
  // 🔔 NOTIFICATIONS
  // ============================================================

  toggleNotifications() {
    this.isNotificationOpen.update((v) => !v);
  }

  closeNotifications() {
    this.isNotificationOpen.set(false);
  }

  // ============================================================
  // 🚪 LOGOUT
  // ============================================================

  logout() {
    this.dialog
      .confirm('Logout', 'Are you sure you want to log out?')
      .subscribe((result) => {
        if (result.confirmed) {
          // this.notificationService.stopPolling();
          // this.notificationService.clearAll();
          this.authService.logout();
        }
      });
  }
}