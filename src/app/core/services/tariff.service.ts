import { Injectable, inject, NgZone } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable, BehaviorSubject, Subscription, timer,
  of, catchError, tap, finalize, shareReplay,
  switchMap, filter, fromEvent, EMPTY, map
} from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TariffDto {
  id: string;
  name: string;
  unlockFee: number;
  perMinuteRate: number;
  isActive: boolean;
  createdAt: string;
}

export interface PaginatedTariffs {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  data: TariffDto[];
}

export interface TariffForCreationDto {
  name: string;
  unlockFee: number;
  perMinuteRate: number;
}

export interface TariffsData {
  tariffs: TariffDto[];
  updatedAt: number;
}

interface StoredTariffsData {
  savedAt: number;
  data: TariffsData;
}

@Injectable({ providedIn: 'root' })
export class TariffService {
  private http    = inject(HttpClient);
  private ngZone  = inject(NgZone);
  private baseUrl = environment.apiBaseUrl;

  private readonly STORAGE_KEY  = 'admin_tariffs_cache_v1';
  private readonly CACHE_TTL    = 5 * 60 * 1000;
  private readonly STORAGE_TTL  = 30 * 60 * 1000;
  private readonly LIVE_TICK_MS = 60 * 1000;

  private stateSubject = new BehaviorSubject<TariffsData | null>(null);
  readonly state$ = this.stateSubject.asObservable();

  private memoryCache: TariffsData | null = null;
  private memoryCacheTime = 0;
  private inflight$?: Observable<TariffsData>;

  private liveSyncSub?: Subscription;
  private visibilitySub?: Subscription;
  private liveConsumers = 0;

  constructor() {
    const stored = this.readFromStorage();
    if (stored) {
      this.setMemoryCache(stored);
      this.emitInZone(stored);
    }
  }

  // ─── Public API ──────────────────────────────────────────

  getTariffsData(forceRefresh = false): Observable<TariffsData> {
    if (!forceRefresh) {
      const cached = this.getCached();
      if (cached) {
        if (!this.stateSubject.value) {
          this.emitInZone(cached);
        }
        return of(cached);
      }
      if (this.inflight$) return this.inflight$;
    }
    return this.fetchTariffs();
  }

  getCached(): TariffsData | null {
    if (this.memoryCache && this.isMemoryCacheValid()) {
      return this.memoryCache;
    }
    const stored = this.readFromStorage();
    if (stored) {
      this.setMemoryCache(stored);
      return stored;
    }
    return null;
  }

  hasAnyData(): boolean {
    return !!this.memoryCache || !!this.stateSubject.value || this.readFromStorageRaw();
  }

  startLiveSync(): void {
    this.liveConsumers += 1;
    if (this.liveSyncSub) return;

    this.liveSyncSub = timer(this.LIVE_TICK_MS, this.LIVE_TICK_MS)
      .pipe(
        filter(() => this.isPageVisible()),
        switchMap(() => this.fetchTariffs().pipe(catchError(() => EMPTY)))
      ).subscribe();

    if (typeof document !== 'undefined') {
      this.visibilitySub = fromEvent(document, 'visibilitychange')
        .pipe(
          filter(() => this.isPageVisible()),
          switchMap(() => this.fetchTariffs().pipe(catchError(() => EMPTY)))
        ).subscribe();
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

  invalidateCache(): void {
    this.memoryCache = null;
    this.memoryCacheTime = 0;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(this.STORAGE_KEY);
    }
  }

  // ─── CRUD ─────────────────────────────────────────────────

  getTariffs(pageIndex = 1, pageSize = 50): Observable<PaginatedTariffs> {
    const params = new HttpParams()
      .set('PageIndex', pageIndex.toString())
      .set('PageSize', pageSize.toString());
    return this.http.get<PaginatedTariffs>(`${this.baseUrl}/api/Tariff`, { params });
  }

  getActiveTariff(): Observable<TariffDto> {
    return this.http.get<TariffDto>(`${this.baseUrl}/api/Tariff/active`);
  }

  createTariff(tariff: TariffForCreationDto): Observable<TariffDto> {
    return this.http.post<TariffDto>(`${this.baseUrl}/api/Tariff`, tariff);
  }

  activateTariff(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/Tariff/${id}/activate`, {});
  }

  deleteTariff(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/Tariff/${id}`);
  }

  // ─── Private ──────────────────────────────────────────────

  /**
   * يضمن إن الـ BehaviorSubject يـ emit جوا Angular Zone
   * عشان الـ Change Detection يشتغل automatic
   */
  private emitInZone(data: TariffsData): void {
    if (NgZone.isInAngularZone()) {
      this.stateSubject.next(data);
    } else {
      this.ngZone.run(() => {
        this.stateSubject.next(data);
      });
    }
  }

  private fetchTariffs(): Observable<TariffsData> {
    if (this.inflight$) return this.inflight$;

    const req$ = this.http
      .get<PaginatedTariffs>(`${this.baseUrl}/api/Tariff`, {
        params: new HttpParams()
          .set('PageIndex', '1')
          .set('PageSize', '50'),
      })
      .pipe(
        map((res) => ({
          tariffs: res?.data || [],
          updatedAt: Date.now(),
        } as TariffsData)),
        tap((data) => this.pushState(data)),
        finalize(() => { this.inflight$ = undefined; }),
        shareReplay(1)
      );

    this.inflight$ = req$;
    return req$;
  }

  private pushState(data: TariffsData): void {
    const current = this.stateSubject.value;

    this.setMemoryCache(data);
    this.writeToStorage(data);

    if (current && this.isSameData(current, data)) return;
    this.emitInZone(data);   // ← هنا التغيير المهم
  }

  private isSameData(a: TariffsData, b: TariffsData): boolean {
    if (a.tariffs.length !== b.tariffs.length) return false;
    return JSON.stringify(
      a.tariffs.map((t) => ({
        id: t.id, name: t.name,
        unlockFee: t.unlockFee,
        perMinuteRate: t.perMinuteRate,
        isActive: t.isActive
      }))
    ) === JSON.stringify(
      b.tariffs.map((t) => ({
        id: t.id, name: t.name,
        unlockFee: t.unlockFee,
        perMinuteRate: t.perMinuteRate,
        isActive: t.isActive
      }))
    );
  }

  private setMemoryCache(data: TariffsData): void {
    this.memoryCache = data;
    this.memoryCacheTime = Date.now();
  }

  private isMemoryCacheValid(): boolean {
    return Date.now() - this.memoryCacheTime < this.CACHE_TTL;
  }

  private readFromStorageRaw(): boolean {
    if (typeof sessionStorage === 'undefined') return false;
    return !!sessionStorage.getItem(this.STORAGE_KEY);
  }

  private readFromStorage(): TariffsData | null {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as StoredTariffsData;
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

  private writeToStorage(data: TariffsData): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({ savedAt: Date.now(), data } as StoredTariffsData)
      );
    } catch (e) {
      console.warn('Could not write tariffs cache:', e);
    }
  }

  private isPageVisible(): boolean {
    if (typeof document === 'undefined') return true;
    return !document.hidden;
  }
}