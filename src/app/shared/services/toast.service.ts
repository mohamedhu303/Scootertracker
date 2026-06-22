import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  icon?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  toasts$ = this.toastsSubject.asObservable();

  private getIcon(type: string): string {
    const icons: Record<string, string> = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };
    return icons[type] || 'info';
  }

  private show(toast: Omit<Toast, 'id'>) {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const duration = toast.duration ?? 4000;
    const icon = toast.icon ?? this.getIcon(toast.type);

    const newToast: Toast = { ...toast, id, icon };
    const current = this.toastsSubject.value;
    this.toastsSubject.next([...current, newToast]);

    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }
  }

  success(title: string, message?: string, duration?: number) {
    this.show({ type: 'success', title, message, duration });
  }

  error(title: string, message?: string, duration?: number) {
    this.show({ type: 'error', title, message, duration: duration ?? 6000 });
  }

  warning(title: string, message?: string, duration?: number) {
    this.show({ type: 'warning', title, message, duration });
  }

  info(title: string, message?: string, duration?: number) {
    this.show({ type: 'info', title, message, duration });
  }

  remove(id: string) {
    const current = this.toastsSubject.value;
    this.toastsSubject.next(current.filter(t => t.id !== id));
  }

  clear() {
    this.toastsSubject.next([]);
  }
}