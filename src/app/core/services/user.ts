import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { filter, finalize, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface UserDto {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  avatarUrl: string | null;
  idVerificationStatus: string;
  accountStatus: string;
  walletBalance: number;
  phoneVerified: boolean;
}

export interface PaginatedUsers {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  data: UserDto[];
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private baseUrl = environment.apiBaseUrl;

  private readonly LIST_TTL = 2 * 60 * 1000;
  private readonly ITEM_TTL = 5 * 60 * 1000;

  private readonly LIST_CACHE_KEY = 'users_list_cache_v1';
  private readonly ITEM_CACHE_KEY = 'users_item_cache_v1';

  private listCache = new Map<string, CacheEntry<PaginatedUsers>>();
  private itemCache = new Map<string, CacheEntry<UserDto>>();

  private inFlightListRequests = new Map<string, Observable<PaginatedUsers>>();
  private inFlightItemRequests = new Map<string, Observable<UserDto>>();

  private listStreams = new Map<string, BehaviorSubject<PaginatedUsers | null>>();
  private itemStreams = new Map<string, BehaviorSubject<UserDto | null>>();

  constructor() {
    this.restoreCacheFromStorage();
  }

  // =========================
  // Public API
  // =========================

  getUsers(pageIndex = 1, pageSize = 50, forceRefresh = false): Observable<PaginatedUsers> {
    const key = this.buildListKey(pageIndex, pageSize);
    const cached = this.getValidListCache(key);

    if (cached && !forceRefresh) {
      this.pushListStream(key, cached);
      return of(cached);
    }

    return this.fetchUsers(pageIndex, pageSize, key);
  }

  watchUsers(pageIndex = 1, pageSize = 50, forceRefresh = false): Observable<PaginatedUsers> {
    const key = this.buildListKey(pageIndex, pageSize);
    const stream = this.getOrCreateListStream(key);
    const cached = this.getValidListCache(key);

    if (cached) {
      stream.next(cached);
    }

    if (!cached || forceRefresh) {
      this.fetchUsers(pageIndex, pageSize, key).subscribe({
        next: (data) => stream.next(data),
        error: () => {},
      });
    }

    return stream
      .asObservable()
      .pipe(filter((value): value is PaginatedUsers => value !== null));
  }

  refreshUsers(pageIndex = 1, pageSize = 50): Observable<PaginatedUsers> {
    return this.getUsers(pageIndex, pageSize, true);
  }

  getUserById(id: string, forceRefresh = false): Observable<UserDto> {
    const cached = this.getValidItemCache(id);

    if (cached && !forceRefresh) {
      this.pushItemStream(id, cached);
      return of(cached);
    }

    return this.fetchUserById(id);
  }

  watchUserById(id: string, forceRefresh = false): Observable<UserDto> {
    const stream = this.getOrCreateItemStream(id);
    const cached = this.getValidItemCache(id);

    if (cached) {
      stream.next(cached);
    }

    if (!cached || forceRefresh) {
      this.fetchUserById(id).subscribe({
        next: (data) => stream.next(data),
        error: () => {},
      });
    }

    return stream.asObservable().pipe(filter((value): value is UserDto => value !== null));
  }

  suspendUser(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/User/${id}/suspend`, {}).pipe(
      tap(() => {
        this.patchUserInCaches(id, { accountStatus: 'Suspended' });
      })
    );
  }

  activateUser(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/User/${id}/activate`, {}).pipe(
      tap(() => {
        this.patchUserInCaches(id, { accountStatus: 'Active' });
      })
    );
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

  private fetchUsers(
    pageIndex: number,
    pageSize: number,
    key: string
  ): Observable<PaginatedUsers> {
    const inFlight = this.inFlightListRequests.get(key);
    if (inFlight) {
      return inFlight;
    }

    const params = new HttpParams()
      .set('PageIndex', pageIndex.toString())
      .set('PageSize', pageSize.toString());

    const request$ = this.http
      .get<PaginatedUsers>(`${this.baseUrl}/api/User`, { params })
      .pipe(
        tap((response) => {
          this.setListCache(key, response);

          (response.data || []).forEach((item) => {
            this.setItemCache(item.id, item);
          });
        }),
        finalize(() => {
          this.inFlightListRequests.delete(key);
        }),
        shareReplay(1)
      );

    this.inFlightListRequests.set(key, request$);
    return request$;
  }

  private fetchUserById(id: string): Observable<UserDto> {
    const inFlight = this.inFlightItemRequests.get(id);
    if (inFlight) {
      return inFlight;
    }

    const request$ = this.http.get<UserDto>(`${this.baseUrl}/api/User/${id}`).pipe(
      tap((response) => {
        this.setItemCache(id, response);
      }),
      finalize(() => {
        this.inFlightItemRequests.delete(id);
      }),
      shareReplay(1)
    );

    this.inFlightItemRequests.set(id, request$);
    return request$;
  }

  // =========================
  // Cache Helpers
  // =========================

  private buildListKey(pageIndex: number, pageSize: number): string {
    return `${pageIndex}_${pageSize}`;
  }

  private getValidListCache(key: string): PaginatedUsers | null {
    const entry = this.listCache.get(key);
    if (!entry) return null;
    if (entry.expiry <= Date.now()) {
      this.listCache.delete(key);
      this.persistCacheToStorage();
      return null;
    }
    return entry.data;
  }

  private getValidItemCache(id: string): UserDto | null {
    const entry = this.itemCache.get(id);
    if (!entry) return null;
    if (entry.expiry <= Date.now()) {
      this.itemCache.delete(id);
      this.persistCacheToStorage();
      return null;
    }
    return entry.data;
  }

  private setListCache(key: string, data: PaginatedUsers): void {
    this.listCache.set(key, { data, expiry: Date.now() + this.LIST_TTL });
    this.pushListStream(key, data);
    this.persistCacheToStorage();
  }

  private setItemCache(id: string, data: UserDto): void {
    this.itemCache.set(id, { data, expiry: Date.now() + this.ITEM_TTL });
    this.pushItemStream(id, data);
    this.persistCacheToStorage();
  }

  // =========================
  // Streams
  // =========================

  private getOrCreateListStream(key: string): BehaviorSubject<PaginatedUsers | null> {
    if (!this.listStreams.has(key)) {
      this.listStreams.set(key, new BehaviorSubject<PaginatedUsers | null>(null));
    }
    return this.listStreams.get(key)!;
  }

  private getOrCreateItemStream(id: string): BehaviorSubject<UserDto | null> {
    if (!this.itemStreams.has(id)) {
      this.itemStreams.set(id, new BehaviorSubject<UserDto | null>(null));
    }
    return this.itemStreams.get(id)!;
  }

  private pushListStream(key: string, data: PaginatedUsers): void {
    this.getOrCreateListStream(key).next(data);
  }

  private pushItemStream(id: string, data: UserDto): void {
    this.getOrCreateItemStream(id).next(data);
  }

  // =========================
  // Cache Mutation
  // =========================

  private patchUserInCaches(id: string, patch: Partial<UserDto>): void {
    const itemEntry = this.itemCache.get(id);

    if (itemEntry) {
      const updatedItem = { ...itemEntry.data, ...patch };
      this.itemCache.set(id, { data: updatedItem, expiry: Date.now() + this.ITEM_TTL });
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
        const updatedPage: PaginatedUsers = { ...entry.data, data: updatedData };
        this.listCache.set(key, { data: updatedPage, expiry: Date.now() + this.LIST_TTL });
        this.pushListStream(key, updatedPage);
      }
    });

    this.persistCacheToStorage();
  }

  // =========================
  // Local Storage
  // =========================

  private persistCacheToStorage(): void {
    if (!this.isBrowser()) return;

    const now = Date.now();
    const listEntries = Array.from(this.listCache.entries()).filter(([, e]) => e.expiry > now);
    const itemEntries = Array.from(this.itemCache.entries()).filter(([, e]) => e.expiry > now);

    try {
      localStorage.setItem(this.LIST_CACHE_KEY, JSON.stringify(listEntries));
      localStorage.setItem(this.ITEM_CACHE_KEY, JSON.stringify(itemEntries));
    } catch {}
  }

  private restoreCacheFromStorage(): void {
    if (!this.isBrowser()) return;

    try {
      const rawListCache = localStorage.getItem(this.LIST_CACHE_KEY);
      const rawItemCache = localStorage.getItem(this.ITEM_CACHE_KEY);
      const now = Date.now();

      if (rawListCache) {
        const parsed: [string, CacheEntry<PaginatedUsers>][] = JSON.parse(rawListCache);
        parsed.forEach(([key, entry]) => {
          if (entry.expiry > now) this.listCache.set(key, entry);
        });
      }

      if (rawItemCache) {
        const parsed: [string, CacheEntry<UserDto>][] = JSON.parse(rawItemCache);
        parsed.forEach(([key, entry]) => {
          if (entry.expiry > now) this.itemCache.set(key, entry);
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
}