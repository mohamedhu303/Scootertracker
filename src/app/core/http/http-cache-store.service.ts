import { Injectable } from '@angular/core';
import { HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

interface HttpCacheEntry {
  expiresAt: number;
  response: HttpResponse<unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class HttpCacheStoreService {
  private responseCache = new Map<string, HttpCacheEntry>();
  private inflightCache = new Map<string, Observable<HttpEvent<unknown>>>();

  get(key: string): HttpResponse<unknown> | null {
    const entry = this.responseCache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.responseCache.delete(key);
      return null;
    }

    return entry.response.clone();
  }

  set(key: string, response: HttpResponse<unknown>, ttl: number): void {
    this.responseCache.set(key, {
      response: response.clone(),
      expiresAt: Date.now() + ttl
    });
  }

  getInflight<T>(key: string): Observable<HttpEvent<T>> | null {
    return (this.inflightCache.get(key) as Observable<HttpEvent<T>>) || null;
  }

  setInflight<T>(key: string, request$: Observable<HttpEvent<T>>): void {
    this.inflightCache.set(key, request$ as Observable<HttpEvent<unknown>>);
  }

  clearInflight(key: string): void {
    this.inflightCache.delete(key);
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.responseCache.keys()) {
      if (key.startsWith(prefix)) {
        this.responseCache.delete(key);
      }
    }

    for (const key of this.inflightCache.keys()) {
      if (key.startsWith(prefix)) {
        this.inflightCache.delete(key);
      }
    }
  }

  invalidateExact(url: string): void {
    this.responseCache.delete(url);
    this.inflightCache.delete(url);
  }

  clearAll(): void {
    this.responseCache.clear();
    this.inflightCache.clear();
  }
}