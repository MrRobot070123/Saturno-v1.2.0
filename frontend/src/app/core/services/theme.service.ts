import { Injectable, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

const STORAGE_KEY = 'saturno-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  theme = signal<AppTheme>(this.readInitialTheme());

  constructor() {
    this.apply(this.theme());
  }

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  set(theme: AppTheme): void {
    this.theme.set(theme);
    this.apply(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  private apply(theme: AppTheme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  private readInitialTheme(): AppTheme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    // Si el usuario nunca eligió, respeta la preferencia del sistema operativo.
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
