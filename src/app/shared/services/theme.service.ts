import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private readonly THEME_KEY = 'dashboard_theme';

  private themeSubject = new BehaviorSubject<Theme>('light');
  theme$ = this.themeSubject.asObservable();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem(this.THEME_KEY) as Theme;
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial: Theme = saved || (prefersDark ? 'dark' : 'light');
      this.setTheme(initial);
    }
  }

  setTheme(theme: Theme) {
    this.themeSubject.next(theme);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.THEME_KEY, theme);
      document.documentElement.setAttribute('data-theme', theme);

      if (theme === 'dark') {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    }
  }

  toggleTheme() {
    const current = this.themeSubject.value;
    this.setTheme(current === 'light' ? 'dark' : 'light');
  }

  isDark(): boolean {
    return this.themeSubject.value === 'dark';
  }

  getCurrentTheme(): Theme {
    return this.themeSubject.value;
  }
}