import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, tap } from 'rxjs';

/**
 * 💾 Cache بسيط في الذاكرة
 * - بيـ cache الـ GET requests لمدة 30 ثانية
 * - بيوفر requests كتير لو المستخدم بيرجع لنفس الصفحة بسرعة
 */

interface CacheEntry {
  response: HttpResponse<any>;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 30000; // 30 ثانية

// ❌ Endpoints مش هتتـ cache (حساسة أو real-time)
const NO_CACHE_PATTERNS = [
  '/Auth/',
  '/notifications',
  '/Ride/active',
];

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  // ✅ نـ cache بس GET requests
  if (req.method !== 'GET') {
    return next(req);
  }

  // ✅ تجاهل الـ endpoints الحساسة
  if (NO_CACHE_PATTERNS.some(pattern => req.url.includes(pattern))) {
    return next(req);
  }

  const cacheKey = req.urlWithParams;
  const cached = cache.get(cacheKey);
  const now = Date.now();

  // ✅ لو موجود في الـ cache ولسه ساري
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return of(cached.response.clone());
  }

  // ✅ Request جديد + نحفظه في الـ cache
  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse && event.status === 200) {
        cache.set(cacheKey, {
          response: event.clone(),
          timestamp: now
        });

        // 🧹 نظافة: امسح الـ entries القديمة
        cleanOldEntries();
      }
    })
  );
};

/**
 * 🧹 امسح أي cache entry أقدم من ساعة
 */
function cleanOldEntries() {
  const now = Date.now();
  const ONE_HOUR = 3600000;

  cache.forEach((entry, key) => {
    if (now - entry.timestamp > ONE_HOUR) {
      cache.delete(key);
    }
  });
}

/**
 * 🗑️ امسح الـ cache كله (لو احتجت)
 */
export function clearHttpCache() {
  cache.clear();
}