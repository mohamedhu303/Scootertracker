import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subscription,
  catchError,
  filter,
  finalize,
  forkJoin,
  fromEvent,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  timer
} from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardStats {
  activeRides: number;
  availableScooters: number;
  todayRevenue: number;
  totalUsers: number;
  offlineScooters: number;
  chargingScooters: number;
  maintenanceScooters: number;
}

export interface DashboardScooter {
  id: string;
  serialNumber: string;
  batteryLevel: number;
  status: string;
  modelName: string;
  location?: string;
}

export interface DashboardRide {
  id: string;
  userName: string;
  scooterId: string;
  startTime: string;
  status: string;
  cost?: number;
  duration?: number;
}

export interface DashboardData {
  stats: DashboardStats;
  scooters: DashboardScooter[];
  rides: DashboardRide[];
  updatedAt: number;
}

interface StoredDashboard {
  savedAt: number;
  data: DashboardData;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  // Cache settings
  private readonly STORAGE_KEY = 'admin_dashboard_cache_v1';
  private readonly CACHE_TTL = 30 * 1000;         // 30 seconds memory cache
  private readonly STORAGE_TTL = 5 * 60 * 1000;   // 5 minutes storage cache
  private readonly LIVE_TICK_MS = 15 * 1000;       // live sync every 15 seconds

  // State
  private stateSubject = new BehaviorSubject<DashboardData | null>(null);
  readonly state$ = this.stateSubject.asObservable();

  // Inflight deduplication
  private inflight$?: Observable<DashboardData>;

  // Live sync
  private liveSyncSub?: Subscription;
  private visibilitySub?: Subscription;
  private liveConsumers = 0;

  // Memory cache
  private memoryCache: DashboardData | null = null;
  private memoryCacheTime = 0;

  // ──────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────

  loadDashboard(forceRefresh: boolean = false): Observable<DashboardData> {
    if (!forceRefresh) {
      const cached = this.getCachedDashboard();
      if (cached) {
        this.stateSubject.next(cached);
        return of(cached);
      }

      if (this.inflight$) {
        return this.inflight$;
      }
    }

    return this.fetchDashboard(forceRefresh);
  }

  getCachedDashboard(): DashboardData | null {
    // 1) Check BehaviorSubject
    const stateValue = this.stateSubject.value;
    if (stateValue && this.isMemoryCacheValid()) {
      return stateValue;
    }

    // 2) Check memory cache
    if (this.memoryCache && this.isMemoryCacheValid()) {
      return this.memoryCache;
    }

    // 3) Check sessionStorage
    const stored = this.readFromStorage();
    if (stored) {
      this.setMemoryCache(stored);
      this.stateSubject.next(stored);
      return stored;
    }

    return null;
  }

  refreshDashboard(): Observable<DashboardData> {
    return this.loadDashboard(true);
  }

  startOverviewLiveSync(): void {
    this.liveConsumers += 1;

    if (this.liveSyncSub) {
      return;
    }

    this.liveSyncSub = timer(this.LIVE_TICK_MS, this.LIVE_TICK_MS)
      .pipe(
        filter(() => this.isPageVisible()),
        switchMap(() =>
          this.fetchDashboard(false).pipe(
            catchError((error) => {
              console.warn('Dashboard live sync error:', error);
              return EMPTY;
            })
          )
        )
      )
      .subscribe();

    if (typeof document !== 'undefined') {
      this.visibilitySub = fromEvent(document, 'visibilitychange')
        .pipe(
          filter(() => this.isPageVisible()),
          switchMap(() =>
            this.fetchDashboard(false).pipe(
              catchError((error) => {
                console.warn('Dashboard visibility sync error:', error);
                return EMPTY;
              })
            )
          )
        )
        .subscribe();
    }
  }

  stopOverviewLiveSync(): void {
    this.liveConsumers = Math.max(0, this.liveConsumers - 1);

    if (this.liveConsumers > 0) {
      return;
    }

    this.liveSyncSub?.unsubscribe();
    this.liveSyncSub = undefined;

    this.visibilitySub?.unsubscribe();
    this.visibilitySub = undefined;
  }

  // ──────────────────────────────────────────────
  // Fetch
  // ──────────────────────────────────────────────

  private fetchDashboard(forceRefresh: boolean): Observable<DashboardData> {
    if (!forceRefresh && this.inflight$) {
      return this.inflight$;
    }

    const request$ = forkJoin({
      scooters: this.http.get<any>(`${this.baseUrl}/api/Scooter`, {
        params: { PageIndex: '1', PageSize: '100' }
      }).pipe(
        catchError((error) => {
          console.warn('Scooters API error:', error);
          return of({ data: [] });
        })
      ),
      users: this.http.get<any>(`${this.baseUrl}/api/User`, {
        params: { PageIndex: '1', PageSize: '1' }
      }).pipe(
        catchError((error) => {
          console.warn('Users API error:', error);
          return of({ totalCount: 0 });
        })
      )
    }).pipe(
      map(({ scooters, users }) => this.buildDashboardData(scooters, users)),
      tap((data) => this.pushState(data)),
      finalize(() => {
        this.inflight$ = undefined;
      }),
      shareReplay(1)
    );

    this.inflight$ = request$;
    return request$;
  }

  // ──────────────────────────────────────────────
  // Build
  // ──────────────────────────────────────────────

  private buildDashboardData(scootersResponse: any, usersResponse: any): DashboardData {
    const scooterList: any[] = scootersResponse?.data || [];
    const totalUsers: number = usersResponse?.totalCount || 0;

    const availableScooters = scooterList.filter((s) => s.status === 'Available').length;
    const activeRides = scooterList.filter((s) => s.status === 'InUse').length;
    const chargingScooters = scooterList.filter((s) => s.status === 'Charging').length;
    const maintenanceScooters = scooterList.filter((s) => s.status === 'Maintenance').length;
    const offlineScooters = scooterList.filter((s) => s.status === 'Offline').length;

    const stats: DashboardStats = {
      activeRides,
      availableScooters,
      todayRevenue: 0,
      totalUsers,
      offlineScooters,
      chargingScooters,
      maintenanceScooters
    };

    const dashboardScooters: DashboardScooter[] = scooterList.slice(0, 6).map((s: any) => ({
      id: s.serialNumber || s.id,
      serialNumber: s.serialNumber,
      batteryLevel: s.batteryLevel,
      status: s.status,
      modelName: s.modelName,
      location: 'Cairo, Egypt'
    }));

    const rides: DashboardRide[] = this.buildMockRides(scooterList);

    return {
      stats,
      scooters: dashboardScooters,
      rides,
      updatedAt: Date.now()
    };
  }

  private buildMockRides(scooterList: any[]): DashboardRide[] {
    return [
      {
        id: 'ride-1',
        userName: 'Ahmed Ali',
        scooterId: scooterList[0]?.serialNumber || 'SC-1001',
        startTime: new Date().toISOString(),
        status: 'Active',
        cost: 0,
        duration: 0
      },
      {
        id: 'ride-2',
        userName: 'Sara Mohamed',
        scooterId: scooterList[1]?.serialNumber || 'SC-1002',
        startTime: new Date(Date.now() - 30 * 60000).toISOString(),
        status: 'Completed',
        cost: 25,
        duration: 15
      },
      {
        id: 'ride-3',
        userName: 'Omar Hassan',
        scooterId: scooterList[2]?.serialNumber || 'SC-1003',
        startTime: new Date(Date.now() - 60 * 60000).toISOString(),
        status: 'Completed',
        cost: 40,
        duration: 22
      },
      {
        id: 'ride-4',
        userName: 'Fatma Ibrahim',
        scooterId: scooterList[3]?.serialNumber || 'SC-1004',
        startTime: new Date(Date.now() - 90 * 60000).toISOString(),
        status: 'Completed',
        cost: 35,
        duration: 18
      },
      {
        id: 'ride-5',
        userName: 'Khaled Youssef',
        scooterId: scooterList[4]?.serialNumber || 'SC-1005',
        startTime: new Date(Date.now() - 120 * 60000).toISOString(),
        status: 'Active',
        cost: 0,
        duration: 0
      }
    ];
  }

  // ──────────────────────────────────────────────
  // State
  // ──────────────────────────────────────────────

  private pushState(nextState: DashboardData): void {
    const current = this.stateSubject.value;

    if (current && this.isSameData(current, nextState)) {
      return;
    }

    this.stateSubject.next(nextState);
    this.setMemoryCache(nextState);
    this.writeToStorage(nextState);
  }

  private isSameData(a: DashboardData, b: DashboardData): boolean {
    return JSON.stringify({
      stats: a.stats,
      scooters: a.scooters
    }) === JSON.stringify({
      stats: b.stats,
      scooters: b.scooters
    });
  }

  // ──────────────────────────────────────────────
  // Memory Cache
  // ──────────────────────────────────────────────

  private setMemoryCache(data: DashboardData): void {
    this.memoryCache = data;
    this.memoryCacheTime = Date.now();
  }

  private isMemoryCacheValid(): boolean {
    return Date.now() - this.memoryCacheTime < this.CACHE_TTL;
  }

  // ──────────────────────────────────────────────
  // Session Storage
  // ──────────────────────────────────────────────

  private readFromStorage(): DashboardData | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    const raw = sessionStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as StoredDashboard;

      if (!parsed?.savedAt || !parsed?.data) {
        sessionStorage.removeItem(this.STORAGE_KEY);
        return null;
      }

      if (Date.now() - parsed.savedAt > this.STORAGE_TTL) {
        sessionStorage.removeItem(this.STORAGE_KEY);
        return null;
      }

      return parsed.data;
    } catch {
      sessionStorage.removeItem(this.STORAGE_KEY);
      return null;
    }
  }

  private writeToStorage(data: DashboardData): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    const payload: StoredDashboard = {
      savedAt: Date.now(),
      data
    };

    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  private isPageVisible(): boolean {
    if (typeof document === 'undefined') {
      return true;
    }

    return !document.hidden;
  }
}