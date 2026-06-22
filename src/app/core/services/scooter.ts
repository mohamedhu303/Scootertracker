import {
  Injectable, inject, PLATFORM_ID, NgZone
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  BehaviorSubject, Observable, of, Subscription, timer,
  fromEvent, EMPTY
} from 'rxjs';
import {
  filter, finalize, shareReplay, tap,
  switchMap, catchError
} from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ScooterDto {
  id: string;
  serialNumber: string;
  batteryLevel: number;
  status: string;
  modelName: string;
}

export interface PaginatedScooters {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  data: ScooterDto[];
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

@Injectable({
  providedIn: 'root',
})
export class ScooterService {
  private http       = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private ngZone     = inject(NgZone);
  private baseUrl    = environment.apiBaseUrl;

  private readonly LIST_TTL = 2 * 60 * 1000;       // 2 دقايق
  private readonly ITEM_TTL = 5 * 60 * 1000;       // 5 دقايق
  private readonly LIVE_TICK_MS = 30 * 1000;        // 30 ثانية

  private readonly LIST_CACHE_KEY = 'scooters_list_cache_v1';
  private readonly ITEM_CACHE_KEY = 'scooters_item_cache_v1';

  private listCache = new Map<string, CacheEntry<PaginatedScooters>>();
  private itemCache = new Map<string, CacheEntry<ScooterDto>>();

  private inFlightListRequests = new Map<string, Observable<PaginatedScooters>>();
  private inFlightItemRequests = new Map<string, Observable<ScooterDto>>();

  private listStreams = new Map<string, BehaviorSubject<PaginatedScooters | null>>();
  private itemStreams = new Map<string, BehaviorSubject<ScooterDto | null>>();

  // Live sync
  private liveSyncSub?: Subscription;
  private visibilitySub?: Subscription;
  private liveConsumers = 0;
  private lastLiveQuery = { pageIndex: 1, pageSize: 1000 };

  constructor() {
    this.restoreCacheFromStorage();
  }

  // =========================
  // Public API
  // =========================

  getScooters(
    pageIndex = 1,
    pageSize = 50,
    forceRefresh = false
  ): Observable<PaginatedScooters> {
    const key = this.buildListKey(pageIndex, pageSize);
    const cached = this.getValidListCache(key);

    if (cached && !forceRefresh) {
      this.pushListStream(key, cached);
      return of(cached);
    }

    return this.fetchScooters(pageIndex, pageSize, key);
  }

  watchScooters(
    pageIndex = 1,
    pageSize = 50,
    forceRefresh = false
  ): Observable<PaginatedScooters> {
    const key = this.buildListKey(pageIndex, pageSize);
    const stream = this.getOrCreateListStream(key);
    const cached = this.getValidListCache(key);

    if (cached) {
      this.emitInZone(() => stream.next(cached));
    }

    if (!cached || forceRefresh) {
      this.fetchScooters(pageIndex, pageSize, key).subscribe({
        next: (data) => this.emitInZone(() => stream.next(data)),
        error: () => {},
      });
    }

    return stream
      .asObservable()
      .pipe(filter((value): value is PaginatedScooters => value !== null));
  }

  refreshScooters(
    pageIndex = 1,
    pageSize = 50
  ): Observable<PaginatedScooters> {
    return this.getScooters(pageIndex, pageSize, true);
  }

  getScooterById(id: string, forceRefresh = false): Observable<ScooterDto> {
    const cached = this.getValidItemCache(id);

    if (cached && !forceRefresh) {
      this.pushItemStream(id, cached);
      return of(cached);
    }

    return this.fetchScooterById(id);
  }

  watchScooterById(id: string, forceRefresh = false): Observable<ScooterDto> {
    const stream = this.getOrCreateItemStream(id);
    const cached = this.getValidItemCache(id);

    if (cached) {
      this.emitInZone(() => stream.next(cached));
    }

    if (!cached || forceRefresh) {
      this.fetchScooterById(id).subscribe({
        next: (data) => this.emitInZone(() => stream.next(data)),
        error: () => {},
      });
    }

    return stream
      .asObservable()
      .pipe(filter((value): value is ScooterDto => value !== null));
  }

  // ─── Live Sync (optional) ─────────────────────────────────

  startLiveSync(pageIndex = 1, pageSize = 1000): void {
    this.lastLiveQuery = { pageIndex, pageSize };
    this.liveConsumers += 1;
    if (this.liveSyncSub) return;

    this.liveSyncSub = timer(this.LIVE_TICK_MS, this.LIVE_TICK_MS)
      .pipe(
        filter(() => this.isPageVisible()),
        switchMap(() => this.refreshScooters(
          this.lastLiveQuery.pageIndex,
          this.lastLiveQuery.pageSize
        ).pipe(catchError(() => EMPTY)))
      )
      .subscribe();

    if (typeof document !== 'undefined') {
      this.visibilitySub = fromEvent(document, 'visibilitychange')
        .pipe(
          filter(() => this.isPageVisible()),
          switchMap(() => this.refreshScooters(
            this.lastLiveQuery.pageIndex,
            this.lastLiveQuery.pageSize
          ).pipe(catchError(() => EMPTY)))
        )
        .subscribe();
    }
  }

  stopLiveSync(): void {
    this.liveConsumers = Math.max(0, this.liveConsumers - 1);
    if (this.liveConsumers > 0) return;

    this.liveSyncSub?.unsubscribe();
    this.liveSyncSub = undefined;
    this.visibilitySub?.unsubscribe();
    this.visibilitySub = undefined;
  }

  // ─── CRUD ─────────────────────────────────────────────────

  createScooter(data: {
    serialNumber: string;
    modelId: string;
  }): Observable<ScooterDto> {
    return this.http.post<ScooterDto>(`${this.baseUrl}/api/Scooter`, data).pipe(
      tap((newScooter) => {
        this.setItemCache(newScooter.id, newScooter);
        this.addScooterToListCaches(newScooter);
      }),
    );
  }

  deleteScooter(id: string): Observable<boolean> {
    return this.http.delete<boolean>(`${this.baseUrl}/api/Scooter/${id}`).pipe(
      tap(() => {
        this.removeScooterFromCaches(id);
      }),
    );
  }

  unlockScooter(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/Scooter/${id}/unlock`, {}).pipe(
      tap(() => {
        this.patchScooterInCaches(id, { status: 'Available' });
      }),
    );
  }

  lockScooter(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/Scooter/${id}/lock`, {}).pipe(
      tap(() => {
        // بدل ما نـ invalidate كل حاجة، نـ patch بس
        this.patchScooterInCaches(id, { status: 'Maintenance' });
      }),
    );
  }

  setMaintenance(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/Scooter/${id}/maintenance`, {}).pipe(
      tap(() => {
        this.patchScooterInCaches(id, { status: 'Maintenance' });
      }),
    );
  }

  retireScooter(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/Scooter/${id}/retire`, {}).pipe(
      tap(() => {
        this.patchScooterInCaches(id, { status: 'Retired' });
      }),
    );
  }

  pingScooter(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/Scooter/${id}/ping`, {});
  }

  clearCache(): void {
    this.listCache.clear();
    this.itemCache.clear();
    this.inFlightListRequests.clear();
    this.inFlightItemRequests.clear();

    this.listStreams.forEach((stream) => stream.next(null));
    this.itemStreams.forEach((stream) => stream.next(null));

    if (this.isBrowser()) {
      localStorage.removeItem(this.LIST_CACHE_KEY);
      localStorage.removeItem(this.ITEM_CACHE_KEY);
    }
  }

  // =========================
  // Internal Fetching
  // =========================

  private fetchScooters(
    pageIndex: number,
    pageSize: number,
    key: string,
  ): Observable<PaginatedScooters> {
    const inFlight = this.inFlightListRequests.get(key);
    if (inFlight) return inFlight;

    const params = new HttpParams()
      .set('PageIndex', pageIndex.toString())
      .set('PageSize', pageSize.toString());

    const request$ = this.http
      .get<PaginatedScooters>(`${this.baseUrl}/api/Scooter`, { params })
      .pipe(
        tap((response) => {
          this.setListCache(key, response);
          response.data.forEach((item) => this.setItemCache(item.id, item));
        }),
        finalize(() => {
          this.inFlightListRequests.delete(key);
        }),
        shareReplay(1),
      );

    this.inFlightListRequests.set(key, request$);
    return request$;
  }

  private fetchScooterById(id: string): Observable<ScooterDto> {
    const inFlight = this.inFlightItemRequests.get(id);
    if (inFlight) return inFlight;

    const request$ = this.http
      .get<ScooterDto>(`${this.baseUrl}/api/Scooter/${id}`)
      .pipe(
        tap((response) => this.setItemCache(id, response)),
        finalize(() => {
          this.inFlightItemRequests.delete(id);
        }),
        shareReplay(1),
      );

    this.inFlightItemRequests.set(id, request$);
    return request$;
  }

  // =========================
  // NgZone helper
  // =========================

  private emitInZone(fn: () => void): void {
    if (NgZone.isInAngularZone()) {
      fn();
    } else {
      this.ngZone.run(fn);
    }
  }

  // =========================
  // Cache Helpers
  // =========================

  private buildListKey(pageIndex: number, pageSize: number): string {
    return `${pageIndex}_${pageSize}`;
  }

  private getValidListCache(key: string): PaginatedScooters | null {
    const entry = this.listCache.get(key);
    if (!entry) return null;

    if (entry.expiry <= Date.now()) {
      this.listCache.delete(key);
      this.persistCacheToStorage();
      return null;
    }

    return entry.data;
  }

  private getValidItemCache(id: string): ScooterDto | null {
    const entry = this.itemCache.get(id);
    if (!entry) return null;

    if (entry.expiry <= Date.now()) {
      this.itemCache.delete(id);
      this.persistCacheToStorage();
      return null;
    }

    return entry.data;
  }

  private setListCache(key: string, data: PaginatedScooters): void {
    this.listCache.set(key, {
      data,
      expiry: Date.now() + this.LIST_TTL,
    });

    this.pushListStream(key, data);
    this.persistCacheToStorage();
  }

  private setItemCache(id: string, data: ScooterDto): void {
    this.itemCache.set(id, {
      data,
      expiry: Date.now() + this.ITEM_TTL,
    });

    this.pushItemStream(id, data);
    this.persistCacheToStorage();
  }

  private invalidateItemCache(id: string): void {
    this.itemCache.delete(id);
    this.persistCacheToStorage();
  }

  private invalidateAllListCaches(): void {
    this.listCache.clear();
    this.persistCacheToStorage();
  }

  // =========================
  // Streams
  // =========================

  private getOrCreateListStream(
    key: string
  ): BehaviorSubject<PaginatedScooters | null> {
    if (!this.listStreams.has(key)) {
      this.listStreams.set(key, new BehaviorSubject<PaginatedScooters | null>(null));
    }
    return this.listStreams.get(key)!;
  }

  private getOrCreateItemStream(
    id: string
  ): BehaviorSubject<ScooterDto | null> {
    if (!this.itemStreams.has(id)) {
      this.itemStreams.set(id, new BehaviorSubject<ScooterDto | null>(null));
    }
    return this.itemStreams.get(id)!;
  }

  private pushListStream(key: string, data: PaginatedScooters): void {
    const stream = this.getOrCreateListStream(key);
    this.emitInZone(() => stream.next(data));
  }

  private pushItemStream(id: string, data: ScooterDto): void {
    const stream = this.getOrCreateItemStream(id);
    this.emitInZone(() => stream.next(data));
  }

  // =========================
  // Cache Mutation Helpers
  // =========================

  private patchScooterInCaches(id: string, patch: Partial<ScooterDto>): void {
    const itemEntry = this.itemCache.get(id);

    if (itemEntry) {
      const updatedItem = { ...itemEntry.data, ...patch };
      this.itemCache.set(id, {
        data: updatedItem,
        expiry: Date.now() + this.ITEM_TTL,
      });
      this.pushItemStream(id, updatedItem);
    }

    this.listCache.forEach((entry, key) => {
      let changed = false;

      const updatedData = entry.data.data.map((item) => {
        if (item.id !== id) return item;
        changed = true;
        return { ...item, ...patch };
      });

      if (changed) {
        const updatedPage: PaginatedScooters = {
          ...entry.data,
          data: updatedData,
        };

        this.listCache.set(key, {
          data: updatedPage,
          expiry: Date.now() + this.LIST_TTL,
        });

        this.pushListStream(key, updatedPage);
      }
    });

    this.persistCacheToStorage();
  }

  private removeScooterFromCaches(id: string): void {
    this.itemCache.delete(id);
    this.itemStreams.get(id)?.next(null);

    this.listCache.forEach((entry, key) => {
      const exists = entry.data.data.some((item) => item.id === id);
      if (!exists) return;

      const updatedList = entry.data.data.filter((item) => item.id !== id);
      const updatedPage: PaginatedScooters = {
        ...entry.data,
        totalCount: Math.max(0, entry.data.totalCount - 1),
        data: updatedList,
      };

      this.listCache.set(key, {
        data: updatedPage,
        expiry: Date.now() + this.LIST_TTL,
      });

      this.pushListStream(key, updatedPage);
    });

    this.persistCacheToStorage();
  }

  private addScooterToListCaches(newScooter: ScooterDto): void {
    this.listCache.forEach((entry, key) => {
      const [pageIndexStr, pageSizeStr] = key.split('_');
      const pageIndex = Number(pageIndexStr);
      const pageSize = Number(pageSizeStr);

      let updatedItems = [...entry.data.data];
      const alreadyExists = updatedItems.some((item) => item.id === newScooter.id);

      if (!alreadyExists && pageIndex === 1) {
        updatedItems = [newScooter, ...updatedItems].slice(0, pageSize);
      }

      const updatedPage: PaginatedScooters = {
        ...entry.data,
        totalCount: alreadyExists
          ? entry.data.totalCount
          : entry.data.totalCount + 1,
        data: updatedItems,
      };

      this.listCache.set(key, {
        data: updatedPage,
        expiry: Date.now() + this.LIST_TTL,
      });

      this.pushListStream(key, updatedPage);
    });

    this.persistCacheToStorage();
  }

  // =========================
  // Local Storage
  // =========================

  private persistCacheToStorage(): void {
    if (!this.isBrowser()) return;

    const now = Date.now();

    const listEntries = Array.from(this.listCache.entries()).filter(
      ([, entry]) => entry.expiry > now,
    );

    const itemEntries = Array.from(this.itemCache.entries()).filter(
      ([, entry]) => entry.expiry > now,
    );

    try {
      localStorage.setItem(this.LIST_CACHE_KEY, JSON.stringify(listEntries));
      localStorage.setItem(this.ITEM_CACHE_KEY, JSON.stringify(itemEntries));
    } catch (e) {
      console.warn('Could not persist scooters cache:', e);
    }
  }

  private restoreCacheFromStorage(): void {
    if (!this.isBrowser()) return;

    try {
      const rawListCache = localStorage.getItem(this.LIST_CACHE_KEY);
      const rawItemCache = localStorage.getItem(this.ITEM_CACHE_KEY);
      const now = Date.now();

      if (rawListCache) {
        const parsed: [string, CacheEntry<PaginatedScooters>][]
          = JSON.parse(rawListCache);

        parsed.forEach(([key, entry]) => {
          if (entry.expiry > now) {
            this.listCache.set(key, entry);

            // ⭐ مهم: نـ push للـ stream عشان الـ component
            // اللي بيـ watch يستقبل الـ cached data فوراً
            const stream = this.getOrCreateListStream(key);
            stream.next(entry.data);
          }
        });
      }

      if (rawItemCache) {
        const parsed: [string, CacheEntry<ScooterDto>][]
          = JSON.parse(rawItemCache);

        parsed.forEach(([key, entry]) => {
          if (entry.expiry > now) {
            this.itemCache.set(key, entry);

            // نـ push للـ stream
            const stream = this.getOrCreateItemStream(key);
            stream.next(entry.data);
          }
        });
      }
    } catch {
      localStorage.removeItem(this.LIST_CACHE_KEY);
      localStorage.removeItem(this.ITEM_CACHE_KEY);
    }
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private isPageVisible(): boolean {
    if (typeof document === 'undefined') return true;
    return !document.hidden;
  }
}