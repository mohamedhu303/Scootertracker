import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { of, finalize, shareReplay, tap } from 'rxjs';
import { HttpCacheStoreService } from './http-cache-store.service';
import { HTTP_CACHE_TTL, HTTP_FORCE_REFRESH } from './http-cache.tokens';

export const smartHttpCacheInterceptor: HttpInterceptorFn = (req, next) => {
  const cacheStore = inject(HttpCacheStoreService);

  if (req.method !== 'GET') {
    return next(req);
  }

  const ttl = req.context.get(HTTP_CACHE_TTL);
  const forceRefresh = req.context.get(HTTP_FORCE_REFRESH);

  if (ttl <= 0 || forceRefresh) {
    return next(req);
  }

  const cacheKey = req.urlWithParams;

  const cachedResponse = cacheStore.get(cacheKey);
  if (cachedResponse) {
    return of(cachedResponse);
  }

  const inflight = cacheStore.getInflight(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request$ = next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        cacheStore.set(cacheKey, event, ttl);
      }
    }),
    finalize(() => {
      cacheStore.clearInflight(cacheKey);
    }),
    shareReplay(1)
  );

  cacheStore.setInflight(cacheKey, request$);
  return request$;
};