import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  Subscription,
  forkJoin,
  timer,
  of,
  EMPTY,
} from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AppNotification {
  id: string;
  type: 'parking' | 'battery' | 'maintenance' | 'offline' | 'verification' | 'info';
  title: string;
  message: string;
  icon: string;
  color: string;
  route?: string;
  timestamp: Date;
  read: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private http    = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  // 📡 Subjects
  private notificationsSubject = new BehaviorSubject<AppNotification[]>([]);
  notifications$ = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();

  // ⏱️ Polling Subscription
  private pollingSubscription: Subscription | null = null;

  // 🚦 منع التحميل المتزامن
  private isLoading = false;

  // ============================================================
  // 🚀 POLLING CONTROL
  // ============================================================

  /**
   * ابدأ Polling للإشعارات
   * - بيمنع التشغيل المزدوج
   * - بيستخدم timer + switchMap عشان لو polling متأخر، يلغي القديم
   * - الافتراضي: 10 دقايق
   */
  startPolling(intervalMs: number = 600000) {
    // ❌ لو شغال بالفعل، متبدأش تاني
    if (this.pollingSubscription) {
      return;
    }

    this.pollingSubscription = timer(0, intervalMs)
      .pipe(
        switchMap(() => this.fetchNotifications())
      )
      .subscribe({
        next: (notifications) => {
          this.updateNotifications(notifications);
        },
        error: (err) => {
          console.error('Notification polling error:', err);
        },
      });
  }

  /**
   * وقف الـ Polling
   */
  stopPolling() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  /**
   * تحميل يدوي (لو محتاج تـ refresh)
   */
  loadNotifications() {
    // ❌ منع التحميل المتزامن
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;

    this.fetchNotifications().subscribe({
      next: (notifications) => {
        this.updateNotifications(notifications);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  // ============================================================
  // 📡 FETCH LOGIC
  // ============================================================

  /**
   * جلب البيانات من 3 APIs بالتوازي
   * - كل API لو فشل، يرجع قيمة فاضية بدل ما يكسر الباقي
   */
  private fetchNotifications() {
    return forkJoin({
      scooters: this.http
        .get<any>(`${this.baseUrl}/api/Scooter`, {
          params: { PageIndex: '1', PageSize: '100' },
        })
        .pipe(catchError(() => of({ data: [] }))),

      pendingPhotos: this.http
        .get<any>(`${this.baseUrl}/api/Ride/parking-photos/pending`, {
          params: { PageIndex: '1', PageSize: '10' },
        })
        .pipe(catchError(() => of({ data: [], totalCount: 0 }))),

      users: this.http
        .get<any>(`${this.baseUrl}/api/User`, {
          params: { PageIndex: '1', PageSize: '100' },
        })
        .pipe(catchError(() => of({ data: [] }))),
    }).pipe(
      map(({ scooters, pendingPhotos, users }) =>
        this.buildNotifications(scooters, pendingPhotos, users)
      ),
      catchError((err) => {
        console.error('Failed to fetch notifications:', err);
        return EMPTY;
      })
    );
  }

  // ============================================================
  // 🏗️ BUILD NOTIFICATIONS
  // ============================================================

  /**
   * بناء قائمة الإشعارات من البيانات
   */
  private buildNotifications(
    scooters: any,
    pendingPhotos: any,
    users: any
  ): AppNotification[] {
    const notifications: AppNotification[] = [];
    const scooterList = scooters?.data || [];
    const photoList   = pendingPhotos?.data || [];
    const pendingCount = pendingPhotos?.totalCount || photoList.length;
    const userList    = users?.data || [];

    // 1️⃣ Pending parking photos
    if (pendingCount > 0) {
      notifications.push({
        id: 'parking-pending',
        type: 'parking',
        title: 'Parking Photos Pending',
        message: `${pendingCount} parking photo${pendingCount > 1 ? 's' : ''} waiting for review`,
        icon: 'photo_camera',
        color: '#f59e0b',
        route: '/app/parking-reviews',
        timestamp: new Date(),
        read: false,
      });
    }

    // 2️⃣ Low battery scooters (below 20%)
    const lowBattery = scooterList.filter(
      (s: any) => s.batteryLevel < 20 && s.status !== 'Charging'
    );

    if (lowBattery.length > 0) {
      notifications.push({
        id: 'battery-low',
        type: 'battery',
        title: 'Low Battery Alert',
        message: `${lowBattery.length} scooter${
          lowBattery.length > 1 ? 's have' : ' has'
        } battery below 20%`,
        icon: 'battery_alert',
        color: '#ef4444',
        route: '/app/scooters',
        timestamp: new Date(),
        read: false,
      });

      // Critical battery (below 10%)
      const criticalBattery = lowBattery.filter((s: any) => s.batteryLevel < 10);
      criticalBattery.forEach((s: any) => {
        notifications.push({
          id: `battery-critical-${s.id}`,
          type: 'battery',
          title: `Critical Battery: ${s.serialNumber}`,
          message: `Battery at ${s.batteryLevel}% - needs immediate attention`,
          icon: 'battery_1_bar',
          color: '#dc2626',
          route: `/app/scooters/${s.id}`,
          timestamp: new Date(),
          read: false,
        });
      });
    }

    // 3️⃣ Scooters in maintenance
    const maintenance = scooterList.filter((s: any) => s.status === 'Maintenance');
    if (maintenance.length > 0) {
      notifications.push({
        id: 'maintenance-alert',
        type: 'maintenance',
        title: 'Scooters in Maintenance',
        message: `${maintenance.length} scooter${
          maintenance.length > 1 ? 's are' : ' is'
        } in maintenance mode`,
        icon: 'build',
        color: '#f59e0b',
        route: '/app/scooters',
        timestamp: new Date(),
        read: false,
      });
    }

    // 4️⃣ Offline scooters
    const offline = scooterList.filter((s: any) => s.status === 'Offline');
    if (offline.length > 0) {
      notifications.push({
        id: 'offline-alert',
        type: 'offline',
        title: 'Scooters Offline',
        message: `${offline.length} scooter${
          offline.length > 1 ? 's are' : ' is'
        } offline and unreachable`,
        icon: 'wifi_off',
        color: '#64748b',
        route: '/app/scooters',
        timestamp: new Date(),
        read: false,
      });
    }

    // 5️⃣ Users pending verification
    const pendingVerification = userList.filter(
      (u: any) => u.idVerificationStatus === 'Pending'
    );

    if (pendingVerification.length > 0) {
      notifications.push({
        id: 'verification-pending',
        type: 'verification',
        title: 'Users Pending Verification',
        message: `${pendingVerification.length} user${
          pendingVerification.length > 1 ? 's' : ''
        } waiting for ID verification`,
        icon: 'how_to_reg',
        color: '#6366f1',
        route: '/app/users',
        timestamp: new Date(),
        read: false,
      });
    }

    // 🔖 الحفاظ على حالة "read" للإشعارات القديمة
    const current = this.notificationsSubject.value;
    const readIds = current.filter((n) => n.read).map((n) => n.id);

    notifications.forEach((n) => {
      if (readIds.includes(n.id)) {
        n.read = true;
      }
    });

    return notifications;
  }

  // ============================================================
  // 🔄 UPDATE STATE
  // ============================================================

  private updateNotifications(notifications: AppNotification[]) {
    this.notificationsSubject.next(notifications);
    this.unreadCountSubject.next(
      notifications.filter((n) => !n.read).length
    );
  }

  // ============================================================
  // 📝 READ STATUS
  // ============================================================

  markAsRead(id: string) {
    const current = this.notificationsSubject.value;
    const notification = current.find((n) => n.id === id);

    if (notification && !notification.read) {
      notification.read = true;
      this.notificationsSubject.next([...current]);
      this.unreadCountSubject.next(current.filter((n) => !n.read).length);
    }
  }

  markAllAsRead() {
    const current = this.notificationsSubject.value;
    const hasUnread = current.some((n) => !n.read);

    if (hasUnread) {
      current.forEach((n) => (n.read = true));
      this.notificationsSubject.next([...current]);
      this.unreadCountSubject.next(0);
    }
  }

  // ============================================================
  // 🔍 GETTERS
  // ============================================================

  getNotifications(): AppNotification[] {
    return this.notificationsSubject.value;
  }

  getUnreadCount(): number {
    return this.unreadCountSubject.value;
  }

  /**
   * مسح كل الإشعارات (مفيد عند الـ logout)
   */
  clearAll() {
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
  }
}