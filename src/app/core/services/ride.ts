import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  of,
  EMPTY,
  Subscription,
  Subject,
  timer,
  fromEvent
} from 'rxjs';
import {
  filter,
  finalize,
  shareReplay,
  tap,
  switchMap,
  catchError
} from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// ── Interfaces ──

export interface RideDto {
  id: string;
  scooterSerialNumber: string;
  userPhoneNumber: string;
  userName?: string;
  startTime: string;
  endTime: string | null;
  durationInMinutes: number | null;
  totalCost: number | null;
  status: string;
  endPhotoUrl: string | null;
  startLocation?: string;
  endLocation?: string | null;
}

export interface PaginatedRides {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  data: RideDto[];
}

export interface PendingParkingPhotoDto {
  rideId: string;
  endPhotoUrl: string;
  scooterSerialNumber: string;
  userPhoneNumber: string;
  endTime: string;
}

export interface PaginatedPendingPhotos {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  data: PendingParkingPhotoDto[];
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

interface StoredCacheMap<T> {
  savedAt: number;
  entries: [string, CacheEntry<T>][];
}

// ── Service ──

@Injectable({ providedIn: 'root' })
export class RideService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private baseUrl = environment.apiBaseUrl;

  // TTL
  private readonly LIST_TTL = 60 * 1000;
  private readonly PHOTOS_TTL = 30 * 1000;
  private readonly STORAGE_TTL = 3 * 60 * 1000;
  private readonly LIVE_TICK_MS = 10 * 60 * 1000; // 10 minutes

  // Storage keys
  private readonly LIST_STORAGE_KEY = 'admin_rides_list_cache_v1';
  private readonly PHOTOS_STORAGE_KEY = 'admin_rides_photos_cache_v1';

  // Memory caches
  private listCache = new Map<string, CacheEntry<PaginatedRides>>();
  private photosCache = new Map<string, CacheEntry<PaginatedPendingPhotos>>();

  // In-flight deduplication
  private inFlightList = new Map<string, Observable<PaginatedRides>>();
  private inFlightPhotos = new Map<string, Observable<PaginatedPendingPhotos>>();

  // Reactive streams (per key)
  private listStreams = new Map<string, BehaviorSubject<PaginatedRides | null>>();
  private photosStreams = new Map<string, BehaviorSubject<PaginatedPendingPhotos | null>>();

  // Live sync
  private liveConsumers = 0;
  private liveSyncSub?: Subscription;
  private visibilitySub?: Subscription;
  private liveSyncKey?: string;
  private liveSyncType?: 'list' | 'photos';

  constructor() {
    this.restoreFromStorage();
  }

  // ═══════════════════════════════
  //  RIDES LIST
  // ═══════════════════════════════

  getRides(
    pageIndex = 1,
    pageSize = 50,
    forceRefresh = false
  ): Observable<PaginatedRides> {
    const key = this.buildKey(pageIndex, pageSize);

    if (!forceRefresh) {
      const cached = this.getValidEntry(this.listCache, key);
      if (cached) {
        this.pushStream(this.listStreams, key, cached);
        return of(cached);
      }
      const inFlight = this.inFlightList.get(key);
      if (inFlight) return inFlight;
    }

    return this.fetchRides(pageIndex, pageSize, key);
  }

  getCachedRides(
    pageIndex = 1,
    pageSize = 50
  ): PaginatedRides | null {
    const key = this.buildKey(pageIndex, pageSize);
    return this.getValidEntry(this.listCache, key);
  }

  watchRides(
    pageIndex = 1,
    pageSize = 50,
    forceRefresh = false
  ): Observable<PaginatedRides> {
    const key = this.buildKey(pageIndex, pageSize);
    const stream = this.getOrCreateStream(this.listStreams, key);
    const cached = this.getValidEntry(this.listCache, key);

    if (cached) stream.next(cached);

    if (!cached || forceRefresh) {
      this.fetchRides(pageIndex, pageSize, key).subscribe({
        next: (data) => stream.next(data),
        error: () => {}
      });
    }

    return stream
      .asObservable()
      .pipe(filter((v): v is PaginatedRides => v !== null));
  }

  private fetchRides(
    pageIndex: number,
    pageSize: number,
    key: string
  ): Observable<PaginatedRides> {
    const existing = this.inFlightList.get(key);
    if (existing) return existing;

    const params = new HttpParams()
      .set('PageIndex', pageIndex.toString())
      .set('PageSize', pageSize.toString());

    const request$ = this.http
      .get<PaginatedRides>(`${this.baseUrl}/api/Ride`, { params })
      .pipe(
        tap((res) => this.setCache(this.listCache, key, res, this.LIST_TTL, this.listStreams)),
        finalize(() => this.inFlightList.delete(key)),
        shareReplay(1)
      );

    this.inFlightList.set(key, request$);
    return request$;
  }

  // ═══════════════════════════════
  //  PENDING PHOTOS
  // ═══════════════════════════════

  getPendingParkingPhotos(
    pageIndex = 1,
    pageSize = 10,
    forceRefresh = false
  ): Observable<PaginatedPendingPhotos> {
    const key = this.buildKey(pageIndex, pageSize);

    if (!forceRefresh) {
      const cached = this.getValidEntry(this.photosCache, key);
      if (cached) {
        this.pushStream(this.photosStreams, key, cached);
        return of(cached);
      }
      const inFlight = this.inFlightPhotos.get(key);
      if (inFlight) return inFlight;
    }

    return this.fetchPhotos(pageIndex, pageSize, key);
  }

  getCachedPhotos(
    pageIndex = 1,
    pageSize = 10
  ): PaginatedPendingPhotos | null {
    const key = this.buildKey(pageIndex, pageSize);
    return this.getValidEntry(this.photosCache, key);
  }

  watchPendingParkingPhotos(
    pageIndex = 1,
    pageSize = 10,
    forceRefresh = false
  ): Observable<PaginatedPendingPhotos> {
    const key = this.buildKey(pageIndex, pageSize);
    const stream = this.getOrCreateStream(this.photosStreams, key);
    const cached = this.getValidEntry(this.photosCache, key);

    if (cached) stream.next(cached);

    if (!cached || forceRefresh) {
      this.fetchPhotos(pageIndex, pageSize, key).subscribe({
        next: (data) => stream.next(data),
        error: () => {}
      });
    }

    return stream
      .asObservable()
      .pipe(filter((v): v is PaginatedPendingPhotos => v !== null));
  }

  private fetchPhotos(
    pageIndex: number,
    pageSize: number,
    key: string
  ): Observable<PaginatedPendingPhotos> {
    const existing = this.inFlightPhotos.get(key);
    if (existing) return existing;

    const params = new HttpParams()
      .set('PageIndex', pageIndex.toString())
      .set('PageSize', pageSize.toString());

    const request$ = this.http
      .get<PaginatedPendingPhotos>(
        `${this.baseUrl}/api/Ride/parking-photos/pending`,
        { params }
      )
      .pipe(
        tap((res) => this.setCache(this.photosCache, key, res, this.PHOTOS_TTL, this.photosStreams)),
        finalize(() => this.inFlightPhotos.delete(key)),
        shareReplay(1)
      );

    this.inFlightPhotos.set(key, request$);
    return request$;
  }

// ═══════════════════════════════
//  REVIEW ACTION
// ═══════════════════════════════

reviewParkingPhoto(
  rideId: string,
  review: {
    isApproved: boolean;
    rejectionReason: string | null;
    penaltyAmount: number;
  }
): Observable<any> {
  // ✅ ضيف rideId كـ query parameter كمان
  const params = new HttpParams().set('rideId', rideId);

  return this.http
    .post(
      `${this.baseUrl}/api/Ride/parking-photos/${rideId}/review`,
      review,
      { params }  // ← ده الإضافة المهمة
    )
    .pipe(tap(() => this.removePhotoFromCaches(rideId)));
}

  private removePhotoFromCaches(rideId: string): void {
    this.photosCache.forEach((entry, key) => {
      const exists = entry.data.data.some((p) => p.rideId === rideId);
      if (!exists) return;

      const filtered = entry.data.data.filter((p) => p.rideId !== rideId);
      const updated: PaginatedPendingPhotos = {
        ...entry.data,
        totalCount: Math.max(0, entry.data.totalCount - 1),
        data: filtered
      };

      this.photosCache.set(key, {
        data: updated,
        expiry: Date.now() + this.PHOTOS_TTL
      });
      this.pushStream(this.photosStreams, key, updated);
    });

    this.persistToStorage();
  }

  // ═══════════════════════════════
  //  LIVE SYNC
  // ═══════════════════════════════

  startPhotosLiveSync(pageIndex = 1, pageSize = 10): void {
    this.liveConsumers += 1;
    this.liveSyncKey = this.buildKey(pageIndex, pageSize);
    this.liveSyncType = 'photos';

    if (this.liveSyncSub) return;

    this.liveSyncSub = timer(this.LIVE_TICK_MS, this.LIVE_TICK_MS)
      .pipe(
        filter(() => this.isPageVisible()),
        switchMap(() =>
          this.fetchPhotos(pageIndex, pageSize, this.liveSyncKey!).pipe(
            catchError(() => EMPTY)
          )
        )
      )
      .subscribe();

    if (this.isBrowser()) {
      this.visibilitySub = fromEvent(document, 'visibilitychange')
        .pipe(
          filter(() => this.isPageVisible()),
          switchMap(() =>
            this.fetchPhotos(pageIndex, pageSize, this.liveSyncKey!).pipe(
              catchError(() => EMPTY)
            )
          )
        )
        .subscribe();
    }
  }

  startRidesLiveSync(pageIndex = 1, pageSize = 50): void {
    this.liveConsumers += 1;
    this.liveSyncKey = this.buildKey(pageIndex, pageSize);
    this.liveSyncType = 'list';

    if (this.liveSyncSub) return;

    this.liveSyncSub = timer(this.LIVE_TICK_MS, this.LIVE_TICK_MS)
      .pipe(
        filter(() => this.isPageVisible()),
        switchMap(() =>
          this.fetchRides(pageIndex, pageSize, this.liveSyncKey!).pipe(
            catchError(() => EMPTY)
          )
        )
      )
      .subscribe();

    if (this.isBrowser()) {
      this.visibilitySub = fromEvent(document, 'visibilitychange')
        .pipe(
          filter(() => this.isPageVisible()),
          switchMap(() =>
            this.fetchRides(pageIndex, pageSize, this.liveSyncKey!).pipe(
              catchError(() => EMPTY)
            )
          )
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
    this.liveSyncKey = undefined;
    this.liveSyncType = undefined;
  }

  // ═══════════════════════════════
  //  GENERIC CACHE HELPERS
  // ═══════════════════════════════

  private buildKey(pageIndex: number, pageSize: number): string {
    return `${pageIndex}_${pageSize}`;
  }

  private getValidEntry<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiry <= Date.now()) {
      cache.delete(key);
      this.persistToStorage();
      return null;
    }
    return entry.data;
  }

  private setCache<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    data: T,
    ttl: number,
    streams: Map<string, BehaviorSubject<T | null>>
  ): void {
    cache.set(key, { data, expiry: Date.now() + ttl });
    this.pushStream(streams, key, data);
    this.persistToStorage();
  }

  private getOrCreateStream<T>(
    streams: Map<string, BehaviorSubject<T | null>>,
    key: string
  ): BehaviorSubject<T | null> {
    if (!streams.has(key)) {
      streams.set(key, new BehaviorSubject<T | null>(null));
    }
    return streams.get(key)!;
  }

  private pushStream<T>(
    streams: Map<string, BehaviorSubject<T | null>>,
    key: string,
    data: T
  ): void {
    this.getOrCreateStream(streams, key).next(data);
  }

  // ═══════════════════════════════
  //  STORAGE (sessionStorage)
  // ═══════════════════════════════

  private persistToStorage(): void {
    if (!this.isBrowser()) return;
    const now = Date.now();

    try {
      const listEntries = Array.from(this.listCache.entries()).filter(
        ([, e]) => e.expiry > now
      );
      const photosEntries = Array.from(this.photosCache.entries()).filter(
        ([, e]) => e.expiry > now
      );

      sessionStorage.setItem(
        this.LIST_STORAGE_KEY,
        JSON.stringify({ savedAt: now, entries: listEntries } as StoredCacheMap<PaginatedRides>)
      );
      sessionStorage.setItem(
        this.PHOTOS_STORAGE_KEY,
        JSON.stringify({ savedAt: now, entries: photosEntries } as StoredCacheMap<PaginatedPendingPhotos>)
      );
    } catch {}
  }

  private restoreFromStorage(): void {
    if (!this.isBrowser()) return;
    const now = Date.now();

    this.restoreMap(this.LIST_STORAGE_KEY, this.listCache, now);
    this.restoreMap(this.PHOTOS_STORAGE_KEY, this.photosCache, now);
  }

  private restoreMap<T>(
    storageKey: string,
    cache: Map<string, CacheEntry<T>>,
    now: number
  ): void {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as StoredCacheMap<T>;
      if (!parsed?.savedAt || !parsed?.entries) {
        sessionStorage.removeItem(storageKey);
        return;
      }

      if (now - parsed.savedAt > this.STORAGE_TTL) {
        sessionStorage.removeItem(storageKey);
        return;
      }

      parsed.entries.forEach(([key, entry]) => {
        if (entry.expiry > now) cache.set(key, entry);
      });
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }

  // ═══════════════════════════════
  //  CLEAR ALL
  // ═══════════════════════════════

  clearCache(): void {
    this.listCache.clear();
    this.photosCache.clear();
    this.inFlightList.clear();
    this.inFlightPhotos.clear();

    this.listStreams.forEach((s) => s.next(null));
    this.photosStreams.forEach((s) => s.next(null));

    if (this.isBrowser()) {
      sessionStorage.removeItem(this.LIST_STORAGE_KEY);
      sessionStorage.removeItem(this.PHOTOS_STORAGE_KEY);
    }
  }

  // ═══════════════════════════════
  //  UTILS
  // ═══════════════════════════════

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private isPageVisible(): boolean {
    if (typeof document === 'undefined') return true;
    return !document.hidden;
  }
}