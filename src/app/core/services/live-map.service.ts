import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  forkJoin,
  map,
  catchError,
  of,
  tap,
  finalize,
  shareReplay,
  BehaviorSubject,
  Subscription,
  timer,
  filter,
  switchMap,
  EMPTY,
  fromEvent,
} from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MapScooter {
  id: string;
  serialNumber: string;
  batteryLevel: number;
  latitude: number;
  longitude: number;
  status: string;
  modelName: string;
  unlockFee?: number;
  feePerMinute?: number;
}

export interface MapZone {
  id: string;
  name: string;
  type: string;
  speedLimitKmH?: number | null;
  boundary: { latitude: number; longitude: number }[];
}

export interface LiveMapData {
  scooters: MapScooter[];
  zones: MapZone[];
  updatedAt: number;
}

interface StoredMapData {
  savedAt: number;
  data: LiveMapData;
}

@Injectable({
  providedIn: 'root',
})
export class LiveMapService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  private readonly STORAGE_KEY = 'admin_live_map_cache_v4';
  private readonly CACHE_TTL = 30 * 1000;
  private readonly STORAGE_TTL = 2 * 60 * 1000;
  private readonly LIVE_TICK_MS = 10 * 60 * 1000; // 10 minutes

  private stateSubject = new BehaviorSubject<LiveMapData | null>(null);
  readonly state$ = this.stateSubject.asObservable();

  private memoryCache: LiveMapData | null = null;
  private memoryCacheTime = 0;
  private inflight$?: Observable<LiveMapData>;

  private liveSyncSub?: Subscription;
  private visibilitySub?: Subscription;
  private liveConsumers = 0;

  get snapshot(): LiveMapData | null {
    return this.stateSubject.value;
  }

  getLiveMap(forceRefresh: boolean = false): Observable<LiveMapData> {
    if (!forceRefresh) {
      const cached = this.getCached();
      if (cached) {
        if (!this.stateSubject.value) {
          this.stateSubject.next(cached);
        }
        return of(cached);
      }
      if (this.inflight$) {
        return this.inflight$;
      }
    }
    return this.fetchLiveMap();
  }

  getCached(): LiveMapData | null {
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

  startLiveSync(): void {
    this.liveConsumers += 1;
    if (this.liveSyncSub) return;

    this.liveSyncSub = timer(this.LIVE_TICK_MS, this.LIVE_TICK_MS)
      .pipe(
        filter(() => this.isPageVisible()),
        switchMap(() => this.fetchLiveMap().pipe(catchError(() => EMPTY))),
      )
      .subscribe();

    if (typeof document !== 'undefined') {
      this.visibilitySub = fromEvent(document, 'visibilitychange')
        .pipe(
          filter(() => this.isPageVisible()),
          switchMap(() => this.fetchLiveMap().pipe(catchError(() => EMPTY))),
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

  private fetchLiveMap(): Observable<LiveMapData> {
    if (this.inflight$) return this.inflight$;

    const request$ = forkJoin({
      liveMap: this.http
        .get<any>(`${this.baseUrl}/api/Scooter/live-map`)
        .pipe(catchError(() => of(null))),

      scootersDetails: this.http
        .get<any>(`${this.baseUrl}/api/Scooter`, {
          params: { PageIndex: '0', PageSize: '200' },
        })
        .pipe(catchError(() => of(null))),

      zones: this.http
        .get<any>(`${this.baseUrl}/api/Zone`, {
          params: { PageIndex: '0', PageSize: '100', IsActive: 'true' },
        })
        .pipe(catchError(() => of(null))),
    }).pipe(
      map(({ liveMap, scootersDetails, zones }) =>
        this.buildMapData(liveMap, scootersDetails, zones),
      ),
      tap((data) => this.pushState(data)),
      finalize(() => {
        this.inflight$ = undefined;
      }),
      shareReplay(1),
    );

    this.inflight$ = request$;
    return request$;
  }

  private buildMapData(liveMapRes: any, scootersDetailsRes: any, zonesRes: any): LiveMapData {
    // 1) Scooters with coordinates from live-map
    const scooterList: any[] =
      this.extractList(liveMapRes?.scooters) ??
      this.extractList(liveMapRes?.items) ??
      this.extractList(liveMapRes?.data) ??
      this.extractList(liveMapRes) ??
      [];

    // 2) Scooters details (with status) from /api/Scooter
    const detailsList: any[] =
      this.extractList(scootersDetailsRes?.items) ??
      this.extractList(scootersDetailsRes?.data) ??
      this.extractList(scootersDetailsRes) ??
      [];

    // 3) Build a lookup map: id → details
    const detailsMap = new Map<string, any>();
    detailsList.forEach((d) => {
      if (d?.id) detailsMap.set(d.id, d);
      if (d?.serialNumber) detailsMap.set(d.serialNumber, d);
    });

    // 4) Zones
    const zoneList: any[] =
      this.extractList(zonesRes?.items) ??
      this.extractList(zonesRes?.data) ??
      this.extractList(zonesRes) ??
      [];

    // 5) Merge: coordinates from liveMap + status from details
    const mappedScooters: MapScooter[] = scooterList
      .map((s: any) => {
        const lat = s?.latitude ?? s?.lat ?? s?.Latitude ?? null;
        const lng = s?.longitude ?? s?.lng ?? s?.lon ?? s?.Longitude ?? null;

        const details = detailsMap.get(s.id) ?? detailsMap.get(s.serialNumber) ?? {};

        const rawStatus =
          s?.status ?? details?.status ?? details?.Status ?? details?.currentStatus ?? null;

        return {
          id: s.id ?? s.Id,
          serialNumber: s.serialNumber ?? s.SerialNumber ?? '',
          batteryLevel: s.batteryLevel ?? details?.batteryLevel ?? 0,
          status: this.normalizeStatus(rawStatus),
          modelName: details?.modelName ?? details?.model ?? s.modelName ?? '',
          latitude: lat,
          longitude: lng,
          unlockFee: s.unlockFee ?? details?.unlockFee ?? 5,
          feePerMinute: s.feePerMinute ?? details?.feePerMinute ?? 1.5,
        };
      })
      .filter(
        (s) => s.latitude != null && s.longitude != null && s.latitude !== 0 && s.longitude !== 0,
      );

    const mappedZones: MapZone[] = zoneList.map((z: any) => ({
      id: z.id ?? z.Id,
      name: z.name ?? z.Name ?? '',
      type: z.type ?? z.Type ?? '',
      speedLimitKmH: z.speedLimitKmH ?? z.speedLimit ?? null,
      boundary: z.boundary ?? z.Boundary ?? [],
    }));

    return {
      scooters: mappedScooters,
      zones: mappedZones,
      updatedAt: Date.now(),
    };
  }

  private normalizeStatus(status: any): string {
    if (status === null || status === undefined || status === '') {
      return 'Available';
    }

    if (typeof status === 'number') {
      const enumMap: Record<number, string> = {
        0: 'Available',
        1: 'InUse',
        2: 'Charging',
        3: 'Maintenance',
        4: 'Offline',
      };
      return enumMap[status] ?? 'Offline';
    }

    const value = String(status)
      .trim()
      .toLowerCase()
      .replace(/[_\s-]/g, '');

    const map: Record<string, string> = {
      available: 'Available',
      inuse: 'InUse',
      charging: 'Charging',
      maintenance: 'Maintenance',
      offline: 'Offline',
      retired: 'Offline',
      idle: 'Available',
      active: 'Available',
    };

    return map[value] ?? String(status);
  }

  private extractList(value: any): any[] | null {
    if (!value) return null;
    if (Array.isArray(value)) return value;
    return null;
  }

  private pushState(data: LiveMapData): void {
    const current = this.stateSubject.value;
    if (current && this.isSameData(current, data)) return;

    this.setMemoryCache(data);
    this.stateSubject.next(data);
    this.writeToStorage(data);
  }

  private isSameData(a: LiveMapData, b: LiveMapData): boolean {
    return (
      JSON.stringify(
        a.scooters.map((s) => ({
          id: s.id,
          status: s.status,
          battery: s.batteryLevel,
          lat: s.latitude,
          lng: s.longitude,
        })),
      ) ===
      JSON.stringify(
        b.scooters.map((s) => ({
          id: s.id,
          status: s.status,
          battery: s.batteryLevel,
          lat: s.latitude,
          lng: s.longitude,
        })),
      )
    );
  }

  private setMemoryCache(data: LiveMapData): void {
    this.memoryCache = data;
    this.memoryCacheTime = Date.now();
  }

  private isMemoryCacheValid(): boolean {
    return Date.now() - this.memoryCacheTime < this.CACHE_TTL;
  }

  private readFromStorage(): LiveMapData | null {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as StoredMapData;
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

  private writeToStorage(data: LiveMapData): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({ savedAt: Date.now(), data } as StoredMapData),
      );
    } catch (e) {
      console.warn('Could not write map cache:', e);
    }
  }

  private isPageVisible(): boolean {
    if (typeof document === 'undefined') return true;
    return !document.hidden;
  }
}