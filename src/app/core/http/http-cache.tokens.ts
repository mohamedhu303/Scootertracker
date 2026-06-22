import { HttpContextToken } from '@angular/common/http';

export const HTTP_CACHE_TTL = new HttpContextToken<number>(() => 0);
export const HTTP_FORCE_REFRESH = new HttpContextToken<boolean>(() => false);