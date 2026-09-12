import { Injectable, signal } from '@angular/core';

export interface BannerMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationBannerService {
  message = signal<BannerMessage | null>(null);
  private timeoutId?: ReturnType<typeof setTimeout>;

  showSuccess(text: string): void {
    this.show({ type: 'success', text });
  }

  showError(text: string): void {
    this.show({ type: 'error', text });
  }

  showInfo(text: string): void {
    this.show({ type: 'info', text });
  }

  private show(message: BannerMessage): void {
    this.message.set(message);
    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => this.message.set(null), 5000);
  }

  dismiss(): void {
    this.message.set(null);
  }
}
