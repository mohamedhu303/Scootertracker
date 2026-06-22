import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable,
  BehaviorSubject,
  Subscription,
  timer,
  of,
  catchError,
  tap,
  finalize,
  shareReplay,
  switchMap,
  filter,
  fromEvent,
  EMPTY,
  map,
} from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CoordinateDto {
  longitude: number;
  latitude: number;
}

export interface ZoneDto {
  id: string;
  name: string;
  type: string;
  speedLimitKmH: number | null;
  isActive: boolean;
  boundary: CoordinateDto[];
}

export interface PaginatedZones {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  data?: ZoneDto[];
  items?: ZoneDto[];
}

export interface ZoneForCreationDto {
  name: string;
  type: string;
  speedLimitKmH: number | null;
  boundary: CoordinateDto[];
}

export interface ZoneForUpdateDto {
  name: string;
  type: string;
  speedLimitKmH: number | null;
  isActive: boolean;
  boundary: CoordinateDto[];
}

export interface ZonesData {
  zones: ZoneDto[];
  updatedAt: number;
}

interface StoredZonesData {
  savedAt: number;
  data: ZonesData;
}

@Injectable({ providedIn: 'root' })
export class ZoneService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  private readonly STORAGE_KEY = 'admin_zones_cache_v1';
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private readonly STORAGE_TTL = 30 * 60 * 1000;
  private readonly LIVE_TICK_MS = 10 * 60 * 1000;

  private stateSubject = new BehaviorSubject<ZonesData | null>(null);
  readonly state$ = this.stateSubject.asObservable();

  private memoryCache: ZonesData | null = null;
  private memoryCacheTime = 0;
  private inflight$?: Observable<ZonesData>;

  private liveSyncSub?: Subscription;
  private visibilitySub?: Subscription;
  private liveConsumers = 0;

  constructor() {
    const stored = this.readFromStorage();
    if (stored) {
      this.setMemoryCache(stored);
      this.stateSubject.next(stored);
    }
  }

  // ───────────────── Public API ─────────────────

  getZonesData(forceRefresh = false): Observable<ZonesData> {
    if (!forceRefresh) {
      const cached = this.getCached();
      if (cached) {
        if (!this.stateSubject.value) {
          this.stateSubject.next(cached);
        }
        return of(cached);
      }
      if (this.inflight$) return this.inflight$;
    }

    return this.fetchZones();
  }

  getCached(): ZonesData | null {
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
    return !!this.memoryCache || !!this.stateSubject.value || !!this.readFromStorageRaw();
  }

  startLiveSync(): void {
    this.liveConsumers += 1;
    if (this.liveSyncSub) return;

    this.liveSyncSub = timer(this.LIVE_TICK_MS, this.LIVE_TICK_MS)
      .pipe(
        filter(() => this.isPageVisible()),
        switchMap(() => this.fetchZones().pipe(catchError(() => EMPTY))),
      )
      .subscribe();

    if (typeof document !== 'undefined') {
      this.visibilitySub = fromEvent(document, 'visibilitychange')
        .pipe(
          filter(() => this.isPageVisible()),
          switchMap(() => this.fetchZones().pipe(catchError(() => EMPTY))),
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

  invalidateCache(): void {
    this.memoryCache = null;
    this.memoryCacheTime = 0;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(this.STORAGE_KEY);
    }
  }

  // ───────────────── CRUD ─────────────────

  getZones(pageIndex = 1, pageSize = 50, isActive?: boolean): Observable<PaginatedZones> {
    return this.requestZones(pageIndex, pageSize, isActive);
  }

  getZoneById(id: string): Observable<ZoneDto> {
    return this.http
      .get<any>(`${this.baseUrl}/api/Zone/${id}`)
      .pipe(map((z) => this.normalizeZone(z)));
  }

  createZone(zone: ZoneForCreationDto): Observable<ZoneDto> {
    const payload: ZoneForCreationDto = {
      ...zone,
      type: this.mapOutgoingType(zone.type),
      speedLimitKmH: zone.type === 'Slow' ? zone.speedLimitKmH : null,
      boundary: this.prepareBoundaryForApi(zone.boundary),
    };

    console.log('POST /api/Zone payload =>', payload);

    return this.http.post<any>(`${this.baseUrl}/api/Zone`, payload).pipe(
      tap((res) => console.log('POST /api/Zone raw =>', res)),
      map((z) => this.normalizeZone(z)),
      tap((created) => this.addZoneLocally(created)),
    );
  }

  updateZone(id: string, zone: ZoneForUpdateDto): Observable<ZoneDto> {
    const payload: ZoneForUpdateDto = {
      ...zone,
      type: this.mapOutgoingType(zone.type),
      speedLimitKmH: zone.type === 'Slow' ? zone.speedLimitKmH : null,
      boundary: this.prepareBoundaryForApi(zone.boundary),
    };

    console.log('PUT /api/Zone payload =>', payload);

    return this.http.put<any>(`${this.baseUrl}/api/Zone/${id}`, payload).pipe(
      tap((res) => console.log('PUT /api/Zone raw =>', res)),
      map((z) => this.normalizeZone(z)),
      tap((updated) => this.updateZoneLocally(updated)),
    );
  }

  deleteZone(id: string): Observable<boolean> {
    return this.http.delete<boolean>(`${this.baseUrl}/api/Zone/${id}`).pipe(
      tap((ok) => {
        if (ok) this.deleteZoneLocally(id);
      }),
    );
  }

  getZonesByLocation(longitude: number, latitude: number): Observable<ZoneDto[]> {
    const params = new HttpParams()
      .set('longitude', longitude.toString())
      .set('latitude', latitude.toString());

    return this.http.get<any>(`${this.baseUrl}/api/Zone/location`, { params }).pipe(
      map((res) => {
        if (Array.isArray(res)) return res.map((z) => this.normalizeZone(z));
        return this.extractZones(res);
      }),
    );
  }

  // ───────────────── Fetch ─────────────────

  private fetchZones(): Observable<ZonesData> {
    if (this.inflight$) return this.inflight$;

    const req$ = this.requestZones(1, 50).pipe(
      tap((res) => console.log('RAW GET /api/Zone response =>', res)),
      map((res) => {
        const incomingZones = this.extractZones(res);
        console.log('EXTRACTED ZONES =>', incomingZones);

        const currentZones = this.stateSubject.value?.zones || this.memoryCache?.zones || [];

        // لو الـ API رجعت فاضي وعندي داتا قديمة، احتفظ بالقديمة
        const finalZones =
          incomingZones.length > 0 ? this.mergeZones(currentZones, incomingZones) : currentZones;

        return {
          zones: finalZones,
          updatedAt: Date.now(),
        } as ZonesData;
      }),
      tap((data) => this.pushState(data)),
      catchError((err) => {
        console.error('GET /api/Zone failed =>', err);

        const fallback = this.stateSubject.value || this.memoryCache || this.readFromStorage();

        if (fallback) {
          return of(fallback);
        }

        throw err;
      }),
      finalize(() => {
        this.inflight$ = undefined;
      }),
      shareReplay(1),
    );

    this.inflight$ = req$;
    return req$;
  }

  private requestZones(
    pageIndex: number,
    pageSize: number,
    isActive?: boolean,
  ): Observable<PaginatedZones> {
    let params = new HttpParams()
      .set('PageIndex', pageIndex.toString())
      .set('PageSize', pageSize.toString());

    if (isActive !== undefined) {
      params = params.set('IsActive', isActive.toString());
    }

    return this.http.get<any>(`${this.baseUrl}/api/Zone`, { params }).pipe(
      tap((res) => console.log('GET /api/Zone raw JSON =>', JSON.stringify(res, null, 2))),
      map((res: any) => {
        const zones = this.extractZones(res);
        return {
          pageIndex: res?.pageIndex ?? pageIndex,
          pageSize: res?.pageSize ?? pageSize,
          totalCount: res?.totalCount ?? res?.count ?? zones.length,
          data: zones,
          items: zones,
        } as PaginatedZones;
      }),
    );
  }

  // ───────────────── Normalize / Extract ─────────────────

  private extractZones(res: any): ZoneDto[] {
    if (!res) return [];

    const candidates = [res, res?.data, res?.items, res?.results, res?.zones, res?.value];

    const raw = candidates.map((x) => this.toArray(x)).find((arr) => arr.length > 0) ?? [];

    return raw.map((z: any) => this.normalizeZone(z));
  }

  private normalizeZone(z: any): ZoneDto {
    return {
      id: z?.id ?? '',
      name: z?.name ?? '',
      type: this.normalizeType(z?.type),
      speedLimitKmH: z?.speedLimitKmH ?? z?.speedLimit ?? null,
      isActive: z?.isActive ?? true,
      boundary: this.normalizeBoundary(z?.boundary ?? z?.coordinates ?? z?.points ?? []),
    };
  }

  private normalizeBoundary(boundary: any): CoordinateDto[] {
    return this.toArray(boundary)
      .map((p: any) => ({
        latitude: Number(p?.latitude ?? p?.lat ?? 0),
        longitude: Number(p?.longitude ?? p?.lng ?? p?.lon ?? 0),
      }))
      .filter((p) => !isNaN(p.latitude) && !isNaN(p.longitude));
  }

  private normalizeType(type: any): string {
    const t = String(type ?? '')
      .replace(/\s+/g, '')
      .toLowerCase();

    if (t === 'parking') return 'Parking';
    if (t === 'noparking') return 'NoParking';
    if (t === 'slow' || t === 'slowzone' || t === 'slowspeed') return 'Slow';
    if (t === 'forbidden' || t === 'forbiddenzone') return 'Forbidden';

    return String(type ?? '');
  }

  private mergeZones(oldZones: ZoneDto[], newZones: ZoneDto[]): ZoneDto[] {
    const map = new Map<string, ZoneDto>();

    for (const z of oldZones) {
      if (z?.id) map.set(z.id, z);
    }

    for (const z of newZones) {
      if (z?.id) map.set(z.id, z);
    }

    return Array.from(map.values());
  }

  // ───────────────── Local Cache Mutations ─────────────────

  private addZoneLocally(zone: ZoneDto): void {
    const current = this.stateSubject.value?.zones || this.memoryCache?.zones || [];
    const updated = [zone, ...current.filter((z) => z.id !== zone.id)];
    this.pushState({ zones: updated, updatedAt: Date.now() });
  }

  private updateZoneLocally(zone: ZoneDto): void {
    const current = this.stateSubject.value?.zones || this.memoryCache?.zones || [];
    const updated = current.some((z) => z.id === zone.id)
      ? current.map((z) => (z.id === zone.id ? zone : z))
      : [zone, ...current];

    this.pushState({ zones: updated, updatedAt: Date.now() });
  }

  private deleteZoneLocally(id: string): void {
    const current = this.stateSubject.value?.zones || this.memoryCache?.zones || [];
    const updated = current.filter((z) => z.id !== id);
    this.pushState({ zones: updated, updatedAt: Date.now() });
  }

  // ───────────────── State / Cache ─────────────────

  private pushState(data: ZonesData): void {
    const current = this.stateSubject.value;

    this.setMemoryCache(data);
    this.writeToStorage(data);

    if (current && this.isSameData(current, data)) return;
    this.stateSubject.next(data);
  }

  private isSameData(a: ZonesData, b: ZonesData): boolean {
    if (a.zones.length !== b.zones.length) return false;

    return (
      JSON.stringify(
        a.zones.map((z) => ({
          id: z.id,
          name: z.name,
          type: z.type,
          isActive: z.isActive,
          speedLimitKmH: z.speedLimitKmH,
          boundaryCount: z.boundary?.length || 0,
        })),
      ) ===
      JSON.stringify(
        b.zones.map((z) => ({
          id: z.id,
          name: z.name,
          type: z.type,
          isActive: z.isActive,
          speedLimitKmH: z.speedLimitKmH,
          boundaryCount: z.boundary?.length || 0,
        })),
      )
    );
  }

  private setMemoryCache(data: ZonesData): void {
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

  private readFromStorage(): ZonesData | null {
    if (typeof sessionStorage === 'undefined') return null;

    const raw = sessionStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as StoredZonesData;

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

  private writeToStorage(data: ZonesData): void {
    if (typeof sessionStorage === 'undefined') return;

    try {
      sessionStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({ savedAt: Date.now(), data } as StoredZonesData),
      );
    } catch (e) {
      console.warn('Could not write zones cache:', e);
    }
  }

  private isPageVisible(): boolean {
    if (typeof document === 'undefined') return true;
    return !document.hidden;
  }

  private toArray(value: any): any[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.$values)) return value.$values;
    return [];
  }

  private mapOutgoingType(type: string): string {
    const t = String(type || '')
      .replace(/\s+/g, '')
      .toLowerCase();

    if (t === 'parking') return 'Parking';
    if (t === 'noparking') return 'NoParking';
    if (t === 'slow') return 'Slow';
    if (t === 'forbidden') return 'Forbidden';

    return type;
  }

  private prepareBoundaryForApi(boundary: CoordinateDto[]): CoordinateDto[] {
    if (!Array.isArray(boundary)) return [];

    const points = [...boundary];
    if (points.length < 2) return points;

    const first = points[0];
    const last = points[points.length - 1];

    const isClosed =
      Math.abs(first.latitude - last.latitude) < 0.00001 &&
      Math.abs(first.longitude - last.longitude) < 0.00001;

    // نخليها open بدل ما تكون أول نقطة مكررة في الآخر
    if (isClosed) {
      points.pop();
    }

    return points;
  }
}
